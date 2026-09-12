import{useState}from'react';
import{Link}from'react-router-dom';
import{CalendarDays,Clock,Lock,Video}from'lucide-react';
import{SkillBadge}from'./components';
import{ConfirmModal,useToast}from'./ui-feedback';
import{useLoader,useOwner,type WorkspaceRole}from'./hooks/use-payments';
import{ledgerService}from'./services/ledger.service';
import{formatMoney,relativeTime}from'./lib/money';
import type{SessionPayment}from'./types/payments';

const initials=(name:string)=>name.split(' ').map(part=>part[0]).join('').slice(0,2).toUpperCase();
const soonest=(a:SessionPayment,b:SessionPayment)=>new Date(a.startsAt??a.createdAt).getTime()-new Date(b.startsAt??b.createdAt).getTime();

/** Every booked, funded session that has not been taught yet, soonest first. */
export function useScheduledSessions(role:WorkspaceRole){
 const owner=useOwner(role);
 const teaching=role!=='student';
 const sessions=useLoader(()=>ledgerService.payments(teaching?{payeeId:owner.ownerId,status:'HELD'}:{payerId:owner.ownerId,status:'HELD'}),[owner.ownerId,teaching]);
 return{...sessions,owner,teaching,rows:(sessions.data??[]).slice().sort(soonest)};
}

export function ScheduledSessions({role,limit,compact=false}:{role:WorkspaceRole;limit?:number;compact?:boolean}){
 const{rows,loading,error,reload,teaching}=useScheduledSessions(role);
 const[cancelling,setCancelling]=useState<SessionPayment|null>(null);
 const toast=useToast();
 const visible=limit?rows.slice(0,limit):rows;

 /* Cancelling before the session returns the whole escrow, so the learner is told the amount. */
 const cancel=async(session:SessionPayment)=>{
  setCancelling(null);
  try{
   await ledgerService.cancel(session.id,'Cancelled by the learner');
   await reload();
   toast(`Session cancelled · ${formatMoney(session.heldAmount,session.currency)} returned to your wallet`);
  }catch(problem){toast(problem instanceof Error?problem.message:'That session could not be cancelled')}
 };

 return <div className="panel wallet-panel scheduled-panel">
  <div className="panel-head">
   <h3>{teaching?'Sessions to teach':'Scheduled sessions'}</h3>
   {Boolean(rows.length)&&<span className="scheduled-count">{rows.length} booked</span>}
  </div>
  {error&&<p className="ledger-error">{error}</p>}
  {loading&&!visible.length?<p className="org-empty">Loading your schedule…</p>
   :!visible.length?<p className="org-empty">{teaching?'No sessions booked with you yet.':'Nothing booked yet. Book a tutor or post a learning ad to get started.'}</p>
   :<div className="session-list">{visible.map(session=>{
    const other=teaching?session.payerName:session.payeeName;
    const when=session.startsAt?new Date(session.startsAt):null;
    return <article key={session.id} className="session-card">
     <div className="avatar">{initials(other)}</div>
     <div className="session-info">
      <div className="session-tags">
       {session.skill&&<SkillBadge>{session.skill}</SkillBadge>}
       <span className="ledger-status held">{when?`starts ${relativeTime(when.toISOString())}`:'awaiting a time'}</span>
       {session.source==='LEARNING_AD'&&<span className="ledger-status">from your ad</span>}
      </div>
      <h4>{session.topic}</h4>
      <p>with {other}</p>
      <div className="session-meta">
       {when&&<span><CalendarDays size={13}/> {when.toLocaleDateString('en',{weekday:'short',month:'short',day:'numeric'})}</span>}
       {when&&<span><Clock size={13}/> {when.toLocaleTimeString('en',{hour:'numeric',minute:'2-digit'})}</span>}
       <span>{session.scheduledMinutes} minutes</span>
       <span>{formatMoney(session.hourlyRate,session.currency)}/hour</span>
      </div>
      {!compact&&<small className="session-escrow"><Lock size={12}/> {formatMoney(session.heldAmount,session.currency)} held in escrow · {teaching?'you are paid for the minutes you teach':'billed per minute, the rest comes back'}</small>}
     </div>
     <div className="session-actions">
      <Link className="btn" to={`/lesson/${session.sessionId}/lobby`}><Video size={15}/> {teaching?'Start session':'Join session'}</Link>
      {!compact&&!teaching&&<button type="button" className="text-danger" onClick={()=>setCancelling(session)}>Cancel</button>}
     </div>
    </article>;
   })}</div>}

  <ConfirmModal
   open={Boolean(cancelling)}
   title="Cancel this session?"
   description={cancelling?`${cancelling.payeeName} will be notified and the ${formatMoney(cancelling.heldAmount,cancelling.currency)} held for this session goes straight back to your wallet.`:''}
   confirmLabel="Cancel session"
   onClose={()=>setCancelling(null)}
   onConfirm={()=>cancelling&&cancel(cancelling)}/>
 </div>;
}

/** The dashboard's "next session" card: the soonest booked session, and the way into its lobby. */
export function NextSessionPanel({role}:{role:WorkspaceRole}){
 const{rows,loading,teaching}=useScheduledSessions(role);
 const[next,following]=rows;
 const box=(session:SessionPayment)=>{
  const when=session.startsAt?new Date(session.startsAt):null;
  return{
   day:when?String(when.getDate()).padStart(2,'0'):'--',
   month:when?when.toLocaleDateString('en',{month:'short'}).toUpperCase():'TBC',
   when:when?relativeTime(when.toISOString()).toUpperCase():'TIME TO CONFIRM',
   other:teaching?session.payerName:session.payeeName,
  };
 };
 return <section className="panel next">
  <div className="panel-head">
   <h2>{teaching?'Next session to teach':'Next session'}</h2>
   <Link className="text-link" to={teaching?'/tutor/lessons':'/student/lessons'}>View all</Link>
  </div>
  {!next?<p className="org-empty">{loading?'Loading your schedule…':teaching?'No sessions booked with you yet.':'Nothing booked yet. Find a tutor or post a learning ad.'}</p>
   :<div className="next-card">
    <div className="datebox"><b>{box(next).day}</b><span>{box(next).month}</span></div>
    <div>
     <span className="eyebrow">{box(next).when}</span>
     <h3>{next.topic}</h3>
     <p>with {box(next).other} · {formatMoney(next.heldAmount,next.currency)} held</p>
    </div>
    <Link className="btn" to={`/lesson/${next.sessionId}/lobby`}>{teaching?'Start session':'Join session'}</Link>
   </div>}
  {following&&<div className="next-card muted">
   <div className="datebox"><b>{box(following).day}</b><span>{box(following).month}</span></div>
   <div><h3>{following.topic}</h3><p>with {box(following).other}</p></div>
  </div>}
 </section>;
}
