import{useEffect,useState}from'react';
import{Link,useNavigate}from'react-router-dom';
import{ArrowDown,ArrowUp,Plus,Trash2}from'lucide-react';
import{useToast}from'./ui-feedback';
import{useLoader}from'./hooks/use-payments';
import{referenceService}from'./services/reference.service';
import{pathsService,type PathInput,type PathLevel}from'./services/paths.service';
import{RouteLine}from'./paths-pages';

type Draft=PathInput&{id?:string};
const EMPTY:Draft={title:'',summary:'',level:'beginner',skillCode:'',published:false,modules:[{title:'',description:''}]};

/** Learning paths in the admin centre: the list, or one path's editor when a slug is given. */
export function AdminPaths({slug}:{slug?:string}){
 return slug?<PathEditor slug={slug}/>:<PathTable/>;
}

function PathTable(){
 const paths=useLoader(()=>pathsService.all(),[]);
 const items=paths.data??[];
 return <div className="admin-page">
  <header className="admin-page-head">
   <div><h1>Learning paths</h1><p>Paths learners can enrol in. A draft stays hidden until you publish it; editing a live path keeps learners' progress on the modules you keep.</p></div>
   <Link className="btn" to="/admin/learning-paths/new"><Plus size={15}/> New path</Link>
  </header>
  {paths.error&&<p className="ledger-error">{paths.error}</p>}
  {!paths.data?<p className="org-empty">Loading paths…</p>
   :!items.length?<p className="org-empty">No paths yet. Write the first one.</p>
   :<table className="admin-table"><thead><tr><th>Path</th><th>Level</th><th>Modules</th><th>Learners</th><th>State</th><th/></tr></thead>
    <tbody>{items.map(path=><tr key={path.id}>
     <td><strong>{path.title}</strong><small>/{path.slug}</small></td>
     <td>{path.level}</td><td>{path.moduleCount}</td><td>{path.learners}</td>
     <td><span className={path.published?'admin-status active':'admin-status draft'}>{path.published?'Published':'Draft'}</span></td>
     <td><Link className="text-link" to={`/admin/learning-paths/${path.slug}`}>Edit</Link></td>
    </tr>)}</tbody></table>}
 </div>;
}

function PathEditor({slug}:{slug:string}){
 const toast=useToast();
 const navigate=useNavigate();
 const creating=slug==='new';
 const existing=useLoader(()=>creating?Promise.resolve(null):pathsService.draft(slug),[slug]);
 const skills=useLoader(()=>referenceService.list('skills',()=>[]),[]);
 const[draft,setDraft]=useState<Draft>(EMPTY);
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);

 useEffect(()=>{
  const path=existing.data;
  if(!path)return;
  setDraft({id:path.id,title:path.title,summary:path.summary,level:path.level,skillCode:path.skillCode??'',published:path.published,
   modules:(path.modules??[]).map(m=>({id:m.id,title:m.title,description:m.description}))});
 },[existing.data]);

 const set=<K extends keyof Draft>(key:K,value:Draft[K])=>setDraft(current=>({...current,[key]:value}));
 const setModule=(index:number,field:'title'|'description',value:string)=>
  set('modules',draft.modules.map((m,i)=>i===index?{...m,[field]:value}:m));
 const move=(index:number,by:number)=>{
  const modules=[...draft.modules];
  const [taken]=modules.splice(index,1);
  modules.splice(index+by,0,taken!);
  set('modules',modules);
 };

 const save=async(event:React.FormEvent)=>{
  event.preventDefault();
  setBusy(true);setError(null);
  try{
   const saved=await pathsService.save({...draft,modules:draft.modules},draft.id);
   toast(saved.published?'Path saved and live':'Draft saved');
   navigate(`/admin/learning-paths/${saved.slug}`,{replace:true});
  }catch(problem){setError(problem instanceof Error?problem.message:'That path could not be saved.')}
  finally{setBusy(false)}
 };

 if(!creating&&existing.loading&&!existing.data)return <div className="admin-page"><p className="org-empty">Loading…</p></div>;
 if(!creating&&!existing.data)return <div className="admin-page"><p className="ledger-error">{existing.error??'That path does not exist.'}</p></div>;

 // The preview needs ids for its stations, so unsaved modules borrow their position.
 const preview=draft.modules.map((m,i)=>({id:m.id??`new-${i}`,position:i+1,title:m.title||'Untitled module',description:m.description}));

 return <div className="admin-page">
  <header className="admin-page-head">
   <div><Link className="text-link" to="/admin/learning-paths">← All paths</Link><h1>{creating?'New path':draft.title||'Untitled path'}</h1>
    <p>Removing a module deletes learners' progress on it. Renaming or reordering keeps it.</p></div>
  </header>
  <form className="path-editor" onSubmit={save}>
   <div className="admin-settings">
    <label>Title<input value={draft.title} onChange={e=>set('title',e.target.value)} placeholder="Python from zero"/></label>
    <label>Summary<textarea value={draft.summary} onChange={e=>set('summary',e.target.value)} placeholder="Who it is for and where it ends"/></label>
    <label>Level<select value={draft.level} onChange={e=>set('level',e.target.value as PathLevel)}>
     <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
    <label>Subject <span>links the path to tutors who teach it</span><select value={draft.skillCode} onChange={e=>set('skillCode',e.target.value)}>
     <option value="">None</option>
     {(skills.data??[]).map(skill=><option key={skill.code} value={skill.code}>{skill.category?`${skill.category} · `:''}{skill.label}</option>)}
    </select></label>

    <fieldset className="module-editor"><legend>Modules</legend>
     {draft.modules.map((module,index)=><div className="module-row" key={module.id??`new-${index}`}>
      <b>{String(index+1).padStart(2,'0')}</b>
      <div>
       <input value={module.title} onChange={e=>setModule(index,'title',e.target.value)} placeholder="Module title" aria-label={`Module ${index+1} title`}/>
       <textarea value={module.description} onChange={e=>setModule(index,'description',e.target.value)} placeholder="What the learner does in it"/>
      </div>
      <span>
       <button type="button" aria-label="Move up" disabled={index===0} onClick={()=>move(index,-1)}><ArrowUp size={14}/></button>
       <button type="button" aria-label="Move down" disabled={index===draft.modules.length-1} onClick={()=>move(index,1)}><ArrowDown size={14}/></button>
       <button type="button" aria-label="Remove module" onClick={()=>set('modules',draft.modules.filter((_,i)=>i!==index))}><Trash2 size={14}/></button>
      </span>
     </div>)}
     <button type="button" className="btn ghost" onClick={()=>set('modules',[...draft.modules,{title:'',description:''}])}><Plus size={14}/> Add module</button>
    </fieldset>

    <label className="publish-toggle"><input type="checkbox" checked={draft.published} onChange={e=>set('published',e.target.checked)}/> Published — learners can find and enrol in it</label>
    {error&&<p className="ledger-error">{error}</p>}
    <button className="btn" disabled={busy}>{busy?'Saving…':'Save path'}</button>
   </div>
   <aside className="path-preview"><small>AS LEARNERS SEE IT</small><h2>{draft.title||'Untitled path'}</h2><RouteLine modules={preview} done={[]}/></aside>
  </form>
 </div>;
}
