import{useState}from'react';
import{useSearchParams}from'react-router-dom';
import{Ban,CalendarX,Check,RotateCcw,Search,ShieldCheck}from'lucide-react';
import{useToast}from'./ui-feedback';
import{useLoader}from'./hooks/use-payments';
import{Dialog}from'./lessons-page';
import{adminControlService,type AdminPerson,type AdminTeamMember,type AuditEntry}from'./services/admin-users.service';
import{formatMoney,formatDateTime,relativeTime}from'./lib/money';
import type{Booking}from'./services/schedule.service';
import type{CurrencyCode}from'./types/payments';

const ROLES:[string,string][]=[['','Everyone'],['learner','Learners'],['tutor','Tutors'],['organisation','Organisations'],['admin','Admins']];
const errorOf=(problem:unknown,fallback:string)=>problem instanceof Error?problem.message:fallback;
const money=(minor:number,currency?:string)=>currency?formatMoney(minor,currency as CurrencyCode):'—';

/** One search box and two pickers, shared by the directory and the session list. */
function Filters({children}:{children:React.ReactNode}){
 return <div className="admin-filters">{children}</div>;
}

function Pages({page,total,pageSize,onPage}:{page:number;total:number;pageSize:number;onPage:(page:number)=>void}){
 const last=Math.max(1,Math.ceil(total/pageSize));
 if(last<2)return null;
 return <div className="results-pages">
  <button className="btn ghost small" disabled={page<=1} onClick={()=>onPage(page-1)}>Back</button>
  <span>{page} of {last}</span>
  <button className="btn ghost small" disabled={page>=last} onClick={()=>onPage(page+1)}>Next</button>
 </div>;
}

export function AdminPeople(){
 // The header search lands here with a name or email already typed.
 const[params]=useSearchParams();
 const[filters,setFilters]=useState({q:params.get('q')??'',role:'',state:''});
 const[page,setPage]=useState(1);
 const[acting,setActing]=useState<AdminPerson|null>(null);
 const people=useLoader(()=>adminControlService.people({...filters,page}),[filters.q,filters.role,filters.state,page]);
 const rows=people.data?.items??[];
 const set=(key:keyof typeof filters,value:string)=>{setFilters(current=>({...current,[key]:value}));setPage(1)};

 return <div className="admin-page">
  <header className="admin-page-head">
   <div><span>People</span><h1>Everyone on the platform</h1><p>Every account, what they have done here, and whether they are still allowed in.</p></div>
  </header>
  <Filters>
   <label className="admin-search"><Search size={15}/><input value={filters.q} onChange={e=>set('q',e.target.value)} placeholder="Name or email"/></label>
   <select value={filters.role} onChange={e=>set('role',e.target.value)}>{ROLES.map(([value,label])=><option key={label} value={value}>{label}</option>)}</select>
   <select value={filters.state} onChange={e=>set('state',e.target.value)}>
    <option value="">Any state</option><option value="suspended">Suspended</option><option value="unverified">Email not verified</option>
   </select>
   <span className="admin-count">{people.data?.total??0} accounts</span>
  </Filters>
  {people.error&&<p className="ledger-error">{people.error}</p>}
  {people.loading&&!rows.length?<div className="workspace-skeleton"><i/><i/></div>
   :!rows.length?<div className="api-state"><Search/><h3>Nobody matches that</h3><p>Try another name, email or filter.</p></div>
   :<ol className="register">{rows.map(person=><PersonRow key={person.id} person={person} onAct={()=>setActing(person)}/>)}</ol>}
  <Pages page={page} total={people.data?.total??0} pageSize={people.data?.pageSize??25} onPage={setPage}/>
  {acting&&<SuspendDialog person={acting} onClose={()=>setActing(null)} onDone={async()=>{setActing(null);await people.reload()}}/>}
 </div>;
}

function PersonRow({person,onAct}:{person:AdminPerson;onAct:()=>void}){
 return <li className={person.suspended?'register-row suspended':'register-row'}>
  <div className="register-who">
   <strong>{person.name}</strong>
   <small>{person.email}</small>
   <div className="register-tags">
    {person.workspaces.map(role=><span key={role} className="register-tag">{role}</span>)}
    {person.tutorState&&person.tutorState!=='approved'&&<span className="register-tag warn">tutor {person.tutorState}</span>}
    {!person.verified&&<span className="register-tag warn">email not verified</span>}
   </div>
   {person.suspended&&<p className="register-reason"><Ban size={13}/> Suspended {person.suspendedAt?relativeTime(person.suspendedAt):''} · {person.suspensionReason}</p>}
  </div>
  <dl className="register-figures">
   <div><dt>Booked</dt><dd>{person.booked}</dd></div>
   <div><dt>Taught</dt><dd>{person.taught}</dd></div>
   <div><dt>Spent</dt><dd>{money(person.spent,person.currency)}</dd></div>
   <div><dt>Earned</dt><dd>{money(person.earned,person.currency)}</dd></div>
   <div><dt>Joined</dt><dd>{new Date(person.joinedAt).toLocaleDateString('en',{day:'numeric',month:'short',year:'numeric'})}</dd></div>
  </dl>
  <button type="button" className={person.suspended?'btn ghost small':'text-danger'} onClick={onAct}>
   {person.suspended?<><RotateCcw size={13}/> Let back in</>:'Suspend'}
  </button>
 </li>;
}

function SuspendDialog({person,onClose,onDone}:{person:AdminPerson;onClose:()=>void;onDone:()=>Promise<void>}){
 const toast=useToast();
 const[reason,setReason]=useState('');
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);

 const act=async()=>{
  setBusy(true);setError(null);
  try{
   if(person.suspended){await adminControlService.restore(person.id);toast(`${person.name} can sign in again`)}
   else{await adminControlService.suspend(person.id,reason);toast(`${person.name} is suspended`)}
   await onDone();
  }catch(problem){setError(errorOf(problem,'That did not work. Try again.'))}
  finally{setBusy(false)}
 };

 return <Dialog
  title={person.suspended?`Let ${person.name} back in?`:`Suspend ${person.name}?`}
  text={person.suspended
   ?'They will be able to sign in again straight away. Their sessions and money are unchanged.'
   :'They are signed out everywhere and cannot sign in. Sessions already booked stay in the calendar until someone cancels them.'}
  onClose={onClose}>
  {!person.suspended&&<label className="sheet-form">Why<textarea rows={3} value={reason} onChange={e=>setReason(e.target.value)} placeholder="What happened, in a line the person will read" autoFocus/></label>}
  {error&&<p className="ledger-error">{error}</p>}
  <div className="dialog-actions">
   <button className="btn ghost" onClick={onClose}>Cancel</button>
   <button className={person.suspended?'btn':'btn danger'} disabled={busy} onClick={act}>
    {busy?'Working…':person.suspended?'Let them back in':'Suspend the account'}</button>
  </div>
 </Dialog>;
}

const VIEWS:[string,string][]=[['','Every session'],['upcoming','Upcoming'],['past','Past'],['cancelled','Cancelled']];

export function AdminBookings(){
 const[filters,setFilters]=useState({q:'',view:''});
 const[page,setPage]=useState(1);
 const[cancelling,setCancelling]=useState<Booking|null>(null);
 const bookings=useLoader(()=>adminControlService.bookings({...filters,page}),[filters.q,filters.view,page]);
 const rows=bookings.data?.items??[];
 const set=(key:keyof typeof filters,value:string)=>{setFilters(current=>({...current,[key]:value}));setPage(1)};

 return <div className="admin-page">
  <header className="admin-page-head">
   <div><span>Lessons</span><h1>Every session booked</h1><p>What is coming up, what has been taught, and what was called off.</p></div>
  </header>
  <Filters>
   <label className="admin-search"><Search size={15}/><input value={filters.q} onChange={e=>set('q',e.target.value)} placeholder="Topic, tutor or learner"/></label>
   <select value={filters.view} onChange={e=>set('view',e.target.value)}>{VIEWS.map(([value,label])=><option key={label} value={value}>{label}</option>)}</select>
   <span className="admin-count">{bookings.data?.total??0} sessions</span>
  </Filters>
  {bookings.error&&<p className="ledger-error">{bookings.error}</p>}
  {bookings.loading&&!rows.length?<div className="workspace-skeleton"><i/><i/></div>
   :!rows.length?<div className="api-state"><CalendarX/><h3>No sessions match that</h3><p>Try another search or view.</p></div>
   :<ol className="board">{rows.map(booking=><BookingRow key={booking.id} booking={booking} onCancel={()=>setCancelling(booking)}/>)}</ol>}
  <Pages page={page} total={bookings.data?.total??0} pageSize={bookings.data?.pageSize??25} onPage={setPage}/>
  {cancelling&&<CancelDialog booking={cancelling} onClose={()=>setCancelling(null)} onDone={async()=>{setCancelling(null);await bookings.reload()}}/>}
 </div>;
}

/** A session as a line on a departure board: when, what, who, and where it stands. */
function BookingRow({booking,onCancel}:{booking:Booking;onCancel:()=>void}){
 const starts=new Date(booking.startsAt);
 const ahead=booking.status==='scheduled'&&starts.getTime()>Date.now();
 return <li className={`board-row state-${booking.status}`}>
  <time dateTime={booking.startsAt}>
   <b>{starts.toLocaleDateString('en',{day:'2-digit',month:'short'})}</b>
   <span>{starts.toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit',hour12:false})}</span>
  </time>
  <div className="board-what">
   <strong>{booking.topic}</strong>
   <small>{booking.tutor.name} → {booking.learner.name} · {booking.durationMinutes} min{booking.skill?` · ${booking.skill}`:''}</small>
   {booking.cancelReason&&<small className="board-reason">{booking.cancelReason}</small>}
  </div>
  <span className={`ledger-status ${booking.status}`}>{booking.status}</span>
  {ahead&&<button type="button" className="text-danger" onClick={onCancel}>Cancel</button>}
 </li>;
}

function CancelDialog({booking,onClose,onDone}:{booking:Booking;onClose:()=>void;onDone:()=>Promise<void>}){
 const toast=useToast();
 const[reason,setReason]=useState('');
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);

 const cancel=async()=>{
  setBusy(true);setError(null);
  try{
   await adminControlService.cancelBooking(booking.id,reason);
   toast('The session is cancelled and the money returned');
   await onDone();
  }catch(problem){setError(errorOf(problem,'That did not work. Try again.'))}
  finally{setBusy(false)}
 };

 return <Dialog title="Cancel this session?" text={`${booking.topic} · ${formatDateTime(booking.startsAt)}. Whatever is held for it goes back to ${booking.learner.name}, and both people are told it was support who cancelled.`} onClose={onClose}>
  <label className="sheet-form">Why<textarea rows={3} value={reason} onChange={e=>setReason(e.target.value)} placeholder="What both people will be told" autoFocus/></label>
  {error&&<p className="ledger-error">{error}</p>}
  <div className="dialog-actions">
   <button className="btn ghost" onClick={onClose}>Keep it</button>
   <button className="btn danger" disabled={busy} onClick={cancel}>{busy?'Cancelling…':'Cancel the session'}</button>
  </div>
 </Dialog>;
}

const PERMISSION_NAMES:Record<string,string>={'*':'Everything','wallets.adjust':'Adjust wallets','appeals.resolve':'Resolve appeals','settings.write':'Change settings','session_payments.read':'Read payments','tutors.approve':'Approve tutors','reference.manage':'Manage reference lists','paths.write':'Write learning paths','users.suspend':'Suspend accounts','bookings.cancel':'Cancel sessions'};

export function AdminTeam(){
 const toast=useToast();
 const team=useLoader(()=>adminControlService.team(),[]);
 const[busy,setBusy]=useState<string|null>(null);
 const rows=team.data?.items??[];
 const keys=team.data?.keys??[];

 const toggle=async(member:AdminTeamMember,key:string,granted:boolean)=>{
  setBusy(member.id+key);
  try{
   await adminControlService.setPermission(member.id,key,granted);
   toast(`${granted?'Granted':'Removed'} ${PERMISSION_NAMES[key]??key} for ${member.name}`);
   await team.reload();
  }catch(problem){toast(errorOf(problem,'That did not work'))}
  finally{setBusy(null)}
 };

 return <div className="admin-page">
  <header className="admin-page-head">
   <div><span>Platform</span><h1>Administrators</h1><p>Who runs the platform, and what each of them is allowed to do. Only a super admin can change this.</p></div>
  </header>
  {team.error&&<p className="ledger-error">{team.error}</p>}
  {team.loading&&!rows.length?<div className="workspace-skeleton"><i/><i/></div>
   :<div className="admin-team">{rows.map(member=>{
    const all=member.permissions.includes('*');
    return <article key={member.id} className="admin-card">
     <header><strong>{member.name}</strong><small>{member.email}</small></header>
     {all&&<p className="admin-card-note"><ShieldCheck size={14}/> Super admin — may do anything, including granting these.</p>}
     <div className="permission-grid">{keys.filter(key=>key!=='*').map(key=>{
      const held=all||member.permissions.includes(key);
      return <button key={key} type="button" className={held?'permission on':'permission'} disabled={all||busy===member.id+key}
       aria-pressed={held} onClick={()=>toggle(member,key,!held)}>
       {held&&<Check size={12}/>}{PERMISSION_NAMES[key]??key}
      </button>;
     })}</div>
    </article>;
   })}</div>}
 </div>;
}

const ACTION_NAMES:Record<string,string>={'user.suspend':'suspended','user.restore':'let back in','booking.cancel':'cancelled the session','admin.permission':'changed permissions','settings.write':'set','tutor.status':'reviewed the tutor','appeal.resolve':'resolved the appeal'};

/** What administrators have done, newest first. Read only: the trail is not editable. */
export function AdminAudit(){
 const[page,setPage]=useState(1);
 const trail=useLoader(()=>adminControlService.audit(page),[page]);
 const rows=trail.data?.items??[];

 return <div className="admin-page">
  <header className="admin-page-head">
   <div><span>Platform</span><h1>Audit trail</h1><p>Every action an administrator took against an account, a session or the platform's settings.</p></div>
  </header>
  {trail.error&&<p className="ledger-error">{trail.error}</p>}
  {trail.loading&&!rows.length?<div className="workspace-skeleton"><i/><i/></div>
   :!rows.length?<div className="api-state"><ShieldCheck/><h3>Nothing recorded yet</h3><p>Actions appear here as soon as an admin takes one.</p></div>
   :<ol className="trail">{rows.map(entry=><TrailLine key={entry.id} entry={entry}/>)}</ol>}
  <Pages page={page} total={trail.data?.total??0} pageSize={trail.data?.pageSize??25} onPage={setPage}/>
 </div>;
}

function TrailLine({entry}:{entry:AuditEntry}){
 return <li className="trail-line">
  <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
  <span><strong>{entry.admin}</strong> {ACTION_NAMES[entry.action]??entry.action} <i>{entry.subject}</i> {entry.subjectId.slice(0,8)}</span>
  {entry.detail&&<small>{entry.detail}</small>}
 </li>;
}
