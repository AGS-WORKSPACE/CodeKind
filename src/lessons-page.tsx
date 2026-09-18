import{useState}from'react';
import{Link}from'react-router-dom';
import{CalendarDays,Clock,X}from'lucide-react';
import{DashboardShell,SkillBadge}from'./components';
import{PageTitle}from'./workspace-pages';
import{useToast}from'./ui-feedback';
import{useLoader}from'./hooks/use-payments';
import{FreeTimes,timeLabel}from'./free-times';
import{MessageButton}from'./messages-page';
import{endsAt,scheduleService,type Booking,type LessonView}from'./services/schedule.service';

const TABS:[LessonView,string][]=[['upcoming','Upcoming'],['past','Past'],['cancelled','Cancelled']];
const dayKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const initialsOf=(name:string)=>name.split(' ').map(part=>part[0]).join('').slice(0,2).toUpperCase();

/** Every session this workspace booked or teaches, by tab. Upcoming ones can be joined, moved or cancelled. */
export function LessonsPage({role}:{role:'student'|'tutor'}){
 const teaching=role==='tutor';
 const[view,setView]=useState<LessonView>('upcoming');
 const[cancelling,setCancelling]=useState<Booking|null>(null);
 const[moving,setMoving]=useState<Booking|null>(null);
 const lessons=useLoader(()=>scheduleService.list(view),[view]);
 const rows=lessons.data??[];
 const done=async()=>{setCancelling(null);setMoving(null);await lessons.reload()};

 return <DashboardShell role={role}>
  <PageTitle title={teaching?'Lessons':'My lessons'} text="Join upcoming sessions, move or cancel them, and look back on past ones." action={teaching?undefined:'Book a lesson'}/>
  <div className="workspace-tabs">{TABS.map(([value,name])=><button type="button" className={view===value?'active':''} onClick={()=>setView(value)} key={value}>{name.toUpperCase()}</button>)}</div>
  {lessons.error&&<p className="ledger-error">{lessons.error}</p>}
  {lessons.loading&&!lessons.data?<div className="workspace-skeleton">{[1,2,3].map(i=><i key={i}/>)}</div>
   :!rows.length?<div className="workspace-empty"><CalendarDays/><h3>No {view} lessons</h3><p>{view==='upcoming'?(teaching?'Sessions learners book with you appear here.':'Book a tutor and your session appears here.'):'They will appear here.'}</p>{view==='upcoming'&&!teaching&&<Link className="btn" to="/tutors">Find a tutor</Link>}</div>
   :<div className="lesson-list">{rows.map(booking=><LessonCard key={booking.id} booking={booking} teaching={teaching} onCancel={()=>setCancelling(booking)} onMove={()=>setMoving(booking)}/>)}</div>}
  {cancelling&&<CancelDialog booking={cancelling} teaching={teaching} onClose={()=>setCancelling(null)} onDone={done}/>}
  {moving&&<RescheduleDialog booking={moving} onClose={()=>setMoving(null)} onDone={done}/>}
 </DashboardShell>;
}

function LessonCard({booking,teaching,onCancel,onMove}:{booking:Booking;teaching:boolean;onCancel:()=>void;onMove:()=>void}){
 const other=teaching?booking.learner:booking.tutor;
 const start=new Date(booking.startsAt);
 const upcoming=booking.status==='scheduled'&&endsAt(booking)>Date.now();
 const started=start.getTime()<=Date.now();
 const status=booking.status==='cancelled'?'cancelled':upcoming?'upcoming':'completed';
 return <article className="lesson-card">
  <div className="avatar">{initialsOf(other.name)}</div>
  <div className="lesson-info">
   <div>{booking.skill&&<SkillBadge>{booking.skill}</SkillBadge>}<span className={`status ${status}`}>{status==='completed'?'PAST':status.toUpperCase()}</span></div>
   <h3>{booking.topic}</h3>
   <p>{teaching?'with learner':'with'} {other.name}</p>
   <div className="lesson-meta">
    <span><CalendarDays/> {start.toLocaleDateString('en',{weekday:'short',month:'short',day:'numeric'})}</span>
    <span><Clock/> {timeLabel(booking.startsAt)}</span>
    <span>{booking.durationMinutes} minutes</span>
   </div>
   {booking.notes&&<small>Notes: {booking.notes}</small>}
   {booking.cancelReason&&<small>Reason: {booking.cancelReason}</small>}
  </div>
  <div className="lesson-actions">
   {upcoming&&<Link to={`/lesson/${booking.id}/lobby`} className="btn">{started?'Join now':teaching?'Open lobby':'Join lesson'}</Link>}
   <MessageButton userId={other.id} label={`Message ${other.name.split(' ')[0]}`}/>
   {upcoming&&!started&&<><button type="button" className="btn ghost" onClick={onMove}>Reschedule</button><button type="button" className="text-danger" onClick={onCancel}>Cancel</button></>}
  </div>
 </article>;
}

export function Dialog({title,text,onClose,children}:{title:string;text:string;onClose:()=>void;children:React.ReactNode}){
 return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
  <div className="modal lesson-dialog" role="dialog" aria-modal="true" aria-labelledby="lesson-dialog-title" onMouseDown={e=>e.stopPropagation()}>
   <button type="button" className="modal-close" aria-label="Close" onClick={onClose}><X/></button>
   <h2 id="lesson-dialog-title">{title}</h2><p>{text}</p>{children}
  </div>
 </div>;
}

function CancelDialog({booking,teaching,onClose,onDone}:{booking:Booking;teaching:boolean;onClose:()=>void;onDone:()=>Promise<void>}){
 const[reason,setReason]=useState('');
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState('');
 const toast=useToast();
 const other=teaching?booking.learner:booking.tutor;
 const cancel=async()=>{
  setBusy(true);setError('');
  try{
   await scheduleService.cancel(booking.id,reason);
   // Money still lives in the demo ledger, so return any escrow it holds for this session.
   toast(`Session cancelled. ${other.name.split(' ')[0]} has been told.`);
   await onDone();
  }catch(problem){setError(problem instanceof Error?problem.message:'The session could not be cancelled');setBusy(false)}
 };
 return <Dialog title="Cancel this session?" text={`${other.name} will be notified${teaching?'':' and any money held for it is returned to your wallet'}.`} onClose={onClose}>
  <textarea className="reject-reason" rows={3} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Let them know why (optional)"/>
  {error&&<div className="form-error">{error}</div>}
  <div><button type="button" className="btn ghost" onClick={onClose}>Keep session</button><button type="button" className="btn danger" disabled={busy} onClick={cancel}>{busy?'Cancelling…':'Cancel session'}</button></div>
 </Dialog>;
}

function RescheduleDialog({booking,onClose,onDone}:{booking:Booking;onClose:()=>void;onDone:()=>Promise<void>}){
 const[date,setDate]=useState(()=>dayKey(new Date(booking.startsAt)));
 const[startsAt,setStartsAt]=useState('');
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState('');
 const toast=useToast();
 const move=async()=>{
  setBusy(true);setError('');
  try{await scheduleService.reschedule(booking.id,startsAt);toast('Session moved. The other person has been told.');await onDone()}
  catch(problem){setError(problem instanceof Error?problem.message:'The session could not be moved');setBusy(false)}
 };
 return <Dialog title="Move this session" text={`Pick a new time with ${booking.tutor.name}. It stays ${booking.durationMinutes} minutes long.`} onClose={onClose}>
  <label className="lesson-dialog-date">Date<input type="date" min={dayKey(new Date())} value={date} onChange={e=>{setDate(e.target.value);setStartsAt('')}}/></label>
  {date&&<FreeTimes tutorId={booking.tutor.id} date={date} duration={booking.durationMinutes} value={startsAt} onChange={setStartsAt} ignoreStart={booking.startsAt}/>}
  {error&&<div className="form-error">{error}</div>}
  <div><button type="button" className="btn ghost" onClick={onClose}>Keep current time</button><button type="button" className="btn" disabled={busy||!startsAt} onClick={move}>{busy?'Moving…':startsAt?`Move to ${timeLabel(startsAt)}`:'Choose a time'}</button></div>
 </Dialog>;
}
