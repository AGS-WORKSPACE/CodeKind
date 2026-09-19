import{useState}from'react';
import{Link}from'react-router-dom';
import{Users}from'lucide-react';
import{DashboardShell}from'./components';
import{useLoader}from'./hooks/use-payments';
import{scheduleService,type Student,type StudentView}from'./services/schedule.service';
import{PageTitle}from'./workspace-pages';
import{initials}from'./tutor-dashboard';
import{MessageButton}from'./messages-page';
import{Dialog}from'./lessons-page';
import{ProposeSchedule}from'./series-panel';
import{relativeTime}from'./lib/money';

const PER_PAGE=20;
const dateOf=(iso:string)=>new Date(iso).toLocaleDateString('en',{weekday:'short',month:'short',day:'numeric'});

export function TutorStudents(){
 const[view,setView]=useState<StudentView>('active');
 const[page,setPage]=useState(1);
 const students=useLoader(()=>scheduleService.students(view,page),[view,page]);
 const data=students.data;
 const total=data?data[view]:0;
 const pages=Math.max(1,Math.ceil(total/PER_PAGE));
 const choose=(next:StudentView)=>{setView(next);setPage(1)};
 const[proposing,setProposing]=useState<Student|null>(null);

 return <DashboardShell role="tutor">
  <PageTitle title="My students" text="Learners who have booked you, and when you see them next."/>
  <div className="workspace-tabs">
   <button type="button" className={view==='active'?'active':''} onClick={()=>choose('active')}>ACTIVE{data?` (${data.active})`:''}</button>
   <button type="button" className={view==='previous'?'active':''} onClick={()=>choose('previous')}>PREVIOUS{data?` (${data.previous})`:''}</button>
  </div>
  {students.error&&<p className="ledger-error">{students.error}</p>}
  {!data?<div className="workspace-skeleton">{[1,2,3].map(i=><i key={i}/>)}</div>
   :!data.items.length?<div className="workspace-empty"><Users/><h3>{view==='active'?'No active students':'No previous students'}</h3>
    <p>{view==='active'?'Learners with a session booked with you appear here.':'Learners without an upcoming session move here.'}</p></div>
   :<div className="student-table live">{data.items.map(s=><StudentRow key={s.id} student={s} onPropose={()=>setProposing(s)}/>)}</div>}
  {proposing&&<Dialog title={`A schedule for ${proposing.name}`} text="The same days and time each week. They accept it, then pay for each session when it opens." onClose={()=>setProposing(null)}>
   <ProposeSchedule learner={proposing} onDone={()=>setProposing(null)}/>
  </Dialog>}
  {pages>1&&<nav className="results-pages" aria-label="Pages">
   <button type="button" className="btn ghost small" disabled={page<=1} onClick={()=>setPage(page-1)}>Previous</button>
   <span>Page {page} of {pages}</span>
   <button type="button" className="btn ghost small" disabled={page>=pages} onClick={()=>setPage(page+1)}>Next</button>
  </nav>}
 </DashboardShell>;
}

function StudentRow({student,onPropose}:{student:Student;onPropose:()=>void}){
 return <article>
  <div className="avatar">{initials(student.name)}</div>
  <div><h3>{student.name}</h3><p>{student.skills.join(', ')||'No skill chosen'}</p></div>
  <span><small>Learning goal</small>{student.learningGoals||'Not shared yet'}</span>
  <span><small>Sessions</small>{student.sessions} held{student.upcoming?` · ${student.upcoming} booked`:''}</span>
  {student.nextAt
   ?<span><small>Next session</small>{dateOf(student.nextAt)} ({relativeTime(student.nextAt)})</span>
   :<span><small>Last session</small>{student.lastAt?dateOf(student.lastAt):'—'}</span>}
  <span className="student-actions"><MessageButton userId={student.id} className="text-link"/><button type="button" className="text-link" onClick={onPropose}>Schedule</button><Link className="text-link" to="/tutor/lessons">Lessons</Link></span>
 </article>;
}
