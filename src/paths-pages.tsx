import{useState}from'react';
import{Link,useLocation,useParams}from'react-router-dom';
import{ArrowRight,BookOpen,Check}from'lucide-react';
import{DashboardShell}from'./components';
import{useAuth}from'./auth';
import{useLoader}from'./hooks/use-payments';
import{useToast}from'./ui-feedback';
import{nextModule,pathsService,type PathModule,type PathProgress}from'./services/paths.service';
import{tutorService}from'./services/tutor.service';

const errorOf=(problem:unknown,fallback:string)=>problem instanceof Error?problem.message:fallback;
const plural=(count:number,word:string)=>`${count} ${word}${count===1?'':'s'}`;

/* A path drawn as a line with a station per module: passed stations are filled, the one you are
   on is ringed, the rest are open. With onToggle, a station is a button that ticks it off. */
export function RouteLine({modules,done,onToggle,busy}:{modules:PathModule[];done:string[];onToggle?:(module:PathModule)=>void;busy?:string|null}){
 const current=nextModule(modules,done);
 return <ol className="route-line">
  {modules.map((module,index)=>{
   const passed=done.includes(module.id);
   const state=passed?'passed':module.id===current?.id&&onToggle?'current':'ahead';
   const stop=<span className="route-stop" aria-hidden="true">{passed&&<Check size={12} strokeWidth={3}/>}</span>;
   return <li key={module.id} className={`route-station ${state}`}>
    {onToggle
     ?<button type="button" className="route-node" disabled={busy===module.id} onClick={()=>onToggle(module)}
       aria-label={passed?`Mark ${module.title} not done`:`Mark ${module.title} done`}>{stop}</button>
     :<span className="route-node">{stop}</span>}
    <div className="route-copy">
     <small>{String(index+1).padStart(2,'0')}{state==='current'?' · you are here':''}</small>
     <strong>{module.title}</strong>
     {module.description&&<p>{module.description}</p>}
    </div>
   </li>;
  })}
 </ol>;
}

/** The same route in miniature, for lists: one dot per module. */
function MiniRoute({count,done=0}:{count:number;done?:number}){
 return <span className="mini-route" aria-label={`${done} of ${count} modules done`}>
  {Array.from({length:count},(_,index)=><i key={index} className={index<done?'passed':''}/>)}
 </span>;
}

/** Published paths for everyone, or the learner's own when inside the student workspace. */
export function LearningPaths(){
 const{pathname}=useLocation();
 if(pathname==='/student/learning-paths')return <MyPaths/>;
 return <main>
  <section className="page-hero"><span className="pill"><BookOpen size={15}/> Structured learning, human guidance</span>
   <h1>Go from curious to capable</h1>
   <p>Each path breaks a subject into modules you work through at your own pace, with a tutor beside you when you want one.</p></section>
  <section className="section"><PathList/></section>
 </main>;
}

function PathList(){
 const paths=useLoader(()=>pathsService.list(),[]);
 if(paths.loading&&!paths.data)return <div className="workspace-skeleton">{[1,2,3].map(i=><i key={i}/>)}</div>;
 const items=paths.data??[];
 if(!items.length)return <section className="workspace-empty"><BookOpen/><h3>No paths published yet</h3>
  <p>Paths are being written. Until then, book the sessions you need and your tutor will plan the route with you.</p>
  <Link className="btn" to="/tutors">Find a tutor</Link></section>;
 return <ol className="path-index">{items.map((path,index)=><li key={path.id}>
  <Link to={`/learning-paths/${path.slug}`}>
   <span className="path-number">{String(index+1).padStart(2,'0')}</span>
   <span className="path-copy"><strong>{path.title}</strong>{path.summary&&<small>{path.summary}</small>}</span>
   <span className="path-meta"><em className={`level level-${path.level}`}>{path.level}</em>
    <MiniRoute count={path.moduleCount}/><small>{plural(path.moduleCount,'module')}{path.learners?` · ${plural(path.learners,'learner')}`:''}</small></span>
   <ArrowRight className="path-go" size={18}/>
  </Link>
 </li>)}</ol>;
}

function MyPaths(){
 const mine=useLoader(()=>pathsService.mine(),[]);
 const items=mine.data??[];
 return <DashboardShell role="student">
  <div className="workspace-title"><div><h1>My learning paths</h1><p>Where you are on each path you have started.</p></div>
   <div><Link className="btn" to="/learning-paths"><BookOpen size={16}/> Browse paths</Link></div></div>
  {mine.error&&<p className="ledger-error">{mine.error}</p>}
  {mine.loading&&!mine.data?<div className="workspace-skeleton">{[1,2].map(i=><i key={i}/>)}</div>
   :!items.length?<section className="workspace-empty"><BookOpen/><h3>You are not on a path yet</h3>
     <p>Pick a path and your progress on it is kept here.</p><Link className="btn" to="/learning-paths">Browse paths</Link></section>
   :<ol className="path-index">{items.map(({path,progress},index)=>{
     const modules=path.modules??[];
     const next=nextModule(modules,progress.done);
     return <li key={path.id}><Link to={`/learning-paths/${path.slug}`}>
      <span className="path-number">{String(index+1).padStart(2,'0')}</span>
      <span className="path-copy"><strong>{path.title}</strong>
       <small>{progress.completedAt?'Finished — every module done':next?`Next: ${next.title}`:'No modules yet'}</small></span>
      <span className="path-meta"><MiniRoute count={modules.length} done={progress.done.length}/>
       <small>{progress.done.length} of {plural(modules.length,'module')}</small></span>
      <ArrowRight className="path-go" size={18}/>
     </Link></li>;
    })}</ol>}
 </DashboardShell>;
}

export function LearningPathDetail(){
 const{slug='' }=useParams();
 const{user}=useAuth();
 const toast=useToast();
 const path=useLoader(()=>pathsService.get(slug),[slug]);
 const progress=useLoader(()=>user?pathsService.progress(slug):Promise.resolve(null),[slug,user?.id]);
 const[mine,setMine]=useState<PathProgress|null>(null);
 const[busy,setBusy]=useState<string|null>(null);
 const[error,setError]=useState<string|null>(null);
 const current=mine??progress.data;

 const act=async(key:string,run:()=>Promise<PathProgress|null>,done?:string)=>{
  setBusy(key);setError(null);
  try{const next=await run();setMine(next??{enrolled:false,startedAt:null,completedAt:null,done:[]});if(done)toast(done)}
  catch(problem){setError(errorOf(problem,'That did not work. Try again.'))}
  finally{setBusy(null)}
 };

 if(path.loading&&!path.data)return <main className="detail"><p className="org-empty">Loading this path…</p></main>;
 if(!path.data)return <main className="detail"><section className="workspace-empty"><BookOpen/><h3>This path is not available</h3>
  <p>{path.error??'It may have been unpublished.'}</p><Link className="btn" to="/learning-paths">All paths</Link></section></main>;

 const p=path.data;
 const modules=p.modules??[];
 const done=current?.done??[];
 const toggle=(module:PathModule)=>act(module.id,()=>pathsService.mark(slug,module.id,!done.includes(module.id)));

 return <main className="detail path-detail">
  <div className="detail-hero">
   <span><em className={`level level-${p.level}`}>{p.level}</em> · {plural(modules.length,'module')}</span>
   <h1>{p.title}</h1>
   {p.summary&&<p>{p.summary}</p>}
   {!user?<Link className="btn" to="/login">Log in to start this path <ArrowRight/></Link>
    :!current?.enrolled?<button className="btn" disabled={busy==='enrol'} onClick={()=>act('enrol',()=>pathsService.enrol(slug),'You are on the path')}>{busy==='enrol'?'Starting…':'Start this path'} <ArrowRight/></button>
    :<div className="path-standing">
      <MiniRoute count={modules.length} done={done.length}/>
      <span>{current.completedAt?'Finished. Every module is done.':`${done.length} of ${modules.length} done`}</span>
      <button type="button" className="text-link" disabled={busy==='leave'} onClick={()=>act('leave',async()=>{await pathsService.leave(slug);return null},'You left the path')}>Leave path</button>
     </div>}
   {error&&<p className="ledger-error">{error}</p>}
  </div>
  <div className="detail-layout">
   <section>
    <h2>The route</h2>
    {current?.enrolled&&<p className="route-hint">Tap a station when you have finished that module.</p>}
    <RouteLine modules={modules} done={done} busy={busy} onToggle={current?.enrolled?toggle:undefined}/>
   </section>
   <aside>{p.skillCode&&<PathTutors skill={p.skillCode}/>}</aside>
  </div>
 </main>;
}

/** Tutors who teach the path's subject, for when a learner wants help on the way. */
function PathTutors({skill}:{skill:string}){
 const tutors=useLoader(()=>tutorService.list(new URLSearchParams({skill,sort:'rating'})),[skill]);
 const items=(tutors.data?.items??[]).slice(0,3);
 return <>
  <h3>Tutors for this path</h3>
  {!items.length?<p className="org-empty">No approved tutors teach this yet.</p>
   :items.map(t=><Link className="tutor-mini" to={`/tutor/${t.id}`} key={t.id}><div className="avatar sm">{t.image}</div>
     <span><strong>{t.name}</strong><small>{t.reviews?`★ ${t.rating.toFixed(1)} · `:''}${t.price}/hour</small></span></Link>)}
  <Link className="text-link" to={`/tutors/${skill}`}>All tutors for this subject</Link>
 </>;
}

/** The student dashboard panel: the path started most recently, and the next module on it. */
export function CurrentPath(){
 const mine=useLoader(()=>pathsService.mine(),[]);
 const first=mine.data?.[0];
 if(mine.error)return <p className="ledger-error">{mine.error}</p>;
 if(!mine.data)return <p className="org-empty">Loading your path…</p>;
 if(!first)return <><p className="org-empty">Start a learning path to see your progress here.</p>
  <Link className="text-link" to="/learning-paths">Browse learning paths <ArrowRight size={14}/></Link></>;
 const modules=first.path.modules??[];
 const next=nextModule(modules,first.progress.done);
 return <Link className="current-path" to={`/learning-paths/${first.path.slug}`}>
  <strong>{first.path.title}</strong>
  <MiniRoute count={modules.length} done={first.progress.done.length}/>
  <small>{first.progress.completedAt?'Finished':next?`Next: ${next.title}`:''}</small>
 </Link>;
}

