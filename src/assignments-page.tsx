import{useState}from'react';
import{Link}from'react-router-dom';
import{ClipboardList,ExternalLink,Plus}from'lucide-react';
import{DashboardShell}from'./components';
import{PageTitle}from'./workspace-pages';
import{Dialog}from'./lessons-page';
import{useToast}from'./ui-feedback';
import{useLoader}from'./hooks/use-payments';
import{assignmentsService,type Assignment,type AssignmentView}from'./services/assignments.service';
import{scheduleService}from'./services/schedule.service';

type Role='student'|'tutor';

// Each tab is named for who the work is waiting on, which differs by side.
const TABS:Record<Role,[AssignmentView,string][]>={
 student:[['open','To do'],['submitted','Handed in'],['reviewed','Reviewed']],
 tutor:[['open','With learners'],['submitted','To review'],['reviewed','Reviewed']],
};
const STAMP:Record<Assignment['status'],string>={set:'Open',submitted:'Handed in',reviewed:'Reviewed'};

const errorOf=(problem:unknown,fallback:string)=>problem instanceof Error?problem.message:fallback;
const shortDate=(iso:string)=>new Date(iso).toLocaleDateString('en',{day:'numeric',month:'short'});
const overdue=(a:Assignment)=>a.status==='set'&&a.dueAt!==null&&new Date(a.dueAt).getTime()<Date.now();

export function AssignmentsPage({role}:{role:Role}){
 const[view,setView]=useState<AssignmentView>(role==='tutor'?'submitted':'open');
 const[setting,setSetting]=useState(false);
 const list=useLoader(()=>assignmentsService.list(view),[view]);
 const items=list.data?.items??[];
 const counts=list.data?.counts;

 return <DashboardShell role={role}>
  <PageTitle title="Assignments" text={role==='student'?'Work your tutors set after a session, and what they said about it.':'Work you set after a session. Review what comes back and it moves to Reviewed.'}/>
  <div className="assignment-bar">
   <div className="workspace-tabs">{TABS[role].map(([value,name])=>
    <button type="button" key={value} className={view===value?'active':''} onClick={()=>setView(value)}>{name.toUpperCase()}{counts?` · ${counts[value]}`:''}</button>)}</div>
   {role==='tutor'&&<button type="button" className="btn" onClick={()=>setSetting(true)}><Plus size={15}/> Set work</button>}
  </div>
  {list.error&&<p className="ledger-error">{list.error}</p>}
  {list.loading&&!list.data?<div className="workspace-skeleton">{[1,2,3].map(i=><i key={i}/>)}</div>
   :!items.length?<section className="workspace-empty"><ClipboardList/><h3>Nothing here</h3>
     <p>{emptyText(role,view)}</p></section>
   :<ol className="assignment-sheets">{items.map(assignment=>
     <AssignmentSheet key={assignment.id} assignment={assignment} role={role} onChange={list.reload}/>)}</ol>}
  {setting&&<Dialog title="Set work" text="It follows one session, and the learner is told straight away." onClose={()=>setSetting(false)}>
   <SetWorkForm onDone={async()=>{setSetting(false);await list.reload()}}/>
  </Dialog>}
 </DashboardShell>;
}

function emptyText(role:Role,view:AssignmentView){
 if(role==='student')return view==='open'?'Nothing to do right now. Work your tutor sets after a session lands here.':view==='submitted'?'Work you hand in waits here for your tutor.':'Reviewed work and feedback are kept here.';
 return view==='open'?'Work you set appears here until the learner hands it in.':view==='submitted'?'Nothing is waiting for your review.':'Reviewed work is kept here.';
}

/* One piece of work as a line on a sheet: the due date in the margin, the work in the middle and
   its state stamped on the right. Opening it shows the answer and the next step. */
function AssignmentSheet({assignment,role,onChange}:{assignment:Assignment;role:Role;onChange:()=>Promise<void>}){
 const[open,setOpen]=useState(false);
 const other=role==='student'?assignment.tutor:assignment.learner;
 return <li className={`assignment-sheet state-${assignment.status}${overdue(assignment)?' overdue':''}`}>
  <button type="button" className="sheet-line" onClick={()=>setOpen(!open)} aria-expanded={open}>
   <span className="sheet-due">{assignment.dueAt?<><small>DUE</small><b>{shortDate(assignment.dueAt)}</b></>:<small>NO DATE</small>}</span>
   <span className="sheet-copy"><strong>{assignment.title}</strong><small>{assignment.topic} · {role==='student'?'from':'for'} {other.name}</small></span>
   <span className="sheet-stamp">{overdue(assignment)?'Overdue':STAMP[assignment.status]}</span>
  </button>
  {open&&<div className="sheet-detail">
   {assignment.instructions&&<p className="sheet-instructions">{assignment.instructions}</p>}
   {(assignment.answer||assignment.answerUrl)&&<div className="sheet-answer"><small>{role==='student'?'Your answer':`${other.name.split(' ')[0]}’s answer`}</small>
    {assignment.answer&&<p>{assignment.answer}</p>}
    {assignment.answerUrl&&<a href={assignment.answerUrl} target="_blank" rel="noreferrer">{assignment.answerUrl} <ExternalLink size={12}/></a>}</div>}
   {assignment.feedback&&<div className="sheet-feedback"><small>Feedback</small><p>{assignment.feedback}</p></div>}
   {role==='student'&&assignment.status!=='reviewed'&&<SubmitForm assignment={assignment} onDone={onChange}/>}
   {role==='tutor'&&assignment.status==='submitted'&&<ReviewForm assignment={assignment} onDone={onChange}/>}
  </div>}
 </li>;
}

function SubmitForm({assignment,onDone}:{assignment:Assignment;onDone:()=>Promise<void>}){
 const toast=useToast();
 const[answer,setAnswer]=useState(assignment.answer);
 const[link,setLink]=useState(assignment.answerUrl);
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);
 const send=async(event:React.FormEvent)=>{
  event.preventDefault();
  setBusy(true);setError(null);
  try{await assignmentsService.submit(assignment.id,answer,link);toast('Handed in');await onDone()}
  catch(problem){setError(errorOf(problem,'Your work could not be handed in.'))}
  finally{setBusy(false)}
 };
 return <form className="sheet-form" onSubmit={send}>
  <label>Your answer<textarea value={answer} onChange={event=>setAnswer(event.target.value)} placeholder="Explain what you did, or paste your code"/></label>
  <label>Link to your work <span>optional</span><input value={link} onChange={event=>setLink(event.target.value)} placeholder="https://github.com/…"/></label>
  {error&&<p className="ledger-error">{error}</p>}
  <button className="btn" disabled={busy}>{busy?'Handing in…':assignment.status==='submitted'?'Replace my answer':'Hand it in'}</button>
 </form>;
}

function ReviewForm({assignment,onDone}:{assignment:Assignment;onDone:()=>Promise<void>}){
 const toast=useToast();
 const[feedback,setFeedback]=useState('');
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);
 const send=async(event:React.FormEvent)=>{
  event.preventDefault();
  setBusy(true);setError(null);
  try{await assignmentsService.review(assignment.id,feedback);toast('Feedback sent');await onDone()}
  catch(problem){setError(errorOf(problem,'Your feedback could not be sent.'))}
  finally{setBusy(false)}
 };
 return <form className="sheet-form" onSubmit={send}>
  <label>Feedback<textarea value={feedback} onChange={event=>setFeedback(event.target.value)} placeholder="What worked, what to fix, and what to try next"/></label>
  {error&&<p className="ledger-error">{error}</p>}
  <button className="btn" disabled={busy}>{busy?'Sending…':'Send feedback'}</button>
 </form>;
}

/** Setting work, either after a chosen session or, on a lesson summary, after that one. */
export function SetWorkForm({bookingId,onDone}:{bookingId?:string;onDone:()=>Promise<void>}){
 const toast=useToast();
 // Work usually follows a session that has happened, so recent ones come first.
 const sessions=useLoader(async()=>bookingId?[]:[...await scheduleService.list('past'),...await scheduleService.list('upcoming')],[bookingId]);
 const[session,setSession]=useState(bookingId??'');
 const[title,setTitle]=useState('');
 const[instructions,setInstructions]=useState('');
 const[due,setDue]=useState('');
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);

 const send=async(event:React.FormEvent)=>{
  event.preventDefault();
  if(!session){setError('Choose the session this work follows.');return}
  setBusy(true);setError(null);
  try{
   await assignmentsService.set({bookingId:session,title,instructions,dueAt:due?new Date(`${due}T23:59:00`).toISOString():null});
   toast('Work set');
   setTitle('');setInstructions('');setDue('');
   await onDone();
  }catch(problem){setError(errorOf(problem,'That work could not be set.'))}
  finally{setBusy(false)}
 };

 return <form className="sheet-form" onSubmit={send}>
  {!bookingId&&<label>After which session?
   <select value={session} onChange={event=>setSession(event.target.value)}>
    <option value="">{sessions.loading?'Loading your sessions…':'Choose a session'}</option>
    {(sessions.data??[]).map(b=><option key={b.id} value={b.id}>{b.learner.name} · {b.topic} · {shortDate(b.startsAt)}</option>)}
   </select></label>}
  <label>Title<input value={title} onChange={event=>setTitle(event.target.value)} placeholder="Refactor the fetch into a custom hook"/></label>
  <label>Instructions<textarea value={instructions} onChange={event=>setInstructions(event.target.value)} placeholder="What to do, and what good looks like"/></label>
  <label>Due <span>optional</span><input type="date" value={due} onChange={event=>setDue(event.target.value)}/></label>
  {error&&<p className="ledger-error">{error}</p>}
  <button className="btn" disabled={busy}>{busy?'Setting…':'Set this work'}</button>
 </form>;
}

/** The homework on a lesson summary: the tutor sets it there, the learner sees what was set. */
export function SessionHomework({bookingId,role}:{bookingId:string;role:Role}){
 const work=useLoader(()=>assignmentsService.forSession(bookingId),[bookingId]);
 const items=work.data??[];
 return <div className="summary-homework">
  <h2>Homework</h2>
  {items.length>0&&<ul>{items.map(a=><li key={a.id}><strong>{a.title}</strong><small>{a.dueAt?`Due ${shortDate(a.dueAt)}`:'No due date'} · {STAMP[a.status]}</small></li>)}</ul>}
  {role==='tutor'
   ?<SetWorkForm bookingId={bookingId} onDone={work.reload}/>
   :!items.length?<p className="org-empty">Your tutor has not set anything for this session.</p>
   :<Link className="text-link" to="/student/assignments">Open your assignments</Link>}
 </div>;
}
