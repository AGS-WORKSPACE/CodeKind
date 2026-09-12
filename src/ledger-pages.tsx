import{useState}from'react';
import{AlertTriangle,Clock,FastForward,Flag,Scale,ShieldCheck,Wallet}from'lucide-react';
import{DashboardShell,StatCard}from'./components';
import{useToast}from'./ui-feedback';
import{useLoader,useOwner,type WorkspaceRole}from'./hooks/use-payments';
import{ledgerService}from'./services/ledger.service';
import{bpsToPercent,formatDateTime,formatMoney,relativeTime}from'./lib/money';
import type{Appeal,AppealReason,SessionPayment}from'./types/payments';

const statusText:Record<SessionPayment['status'],string>={
 HELD:'In escrow',PENDING:'Pending',PAID:'Paid',FLAGGED:'Flagged by appeal',APPEAL_SETTLEMENT:'Appeal settled',CANCELLED:'Cancelled',
};
export const appealReasons:[AppealReason,string][]=[
 ['TUTOR_NO_SHOW','The tutor never joined'],
 ['LEFT_EARLY','The tutor left early'],
 ['WRONG_DURATION','The billed time is wrong'],
 ['QUALITY','The session was not what was agreed'],
 ['OTHER','Something else'],
];

export function StatusPill({status}:{status:SessionPayment['status']}){
 return <span className={`ledger-status ${status.toLowerCase()}`}>{statusText[status]}</span>;
}

/** Where the 24-hour grace period stands, in the words the person reading it needs. */
function GraceNote({payment,payee}:{payment:SessionPayment;payee:boolean}){
 if(payment.status==='HELD')return <small className="grace held"><Wallet size={13}/> Held until the session is taught</small>;
 if(payment.status==='PENDING'&&payment.maturesAt)return <small className="grace"><Clock size={13}/> {payee?'Clears':'Appeal window closes'} {relativeTime(payment.maturesAt)}</small>;
 if(payment.status==='FLAGGED')return <small className="grace flagged"><Flag size={13}/> Frozen while the appeal is reviewed</small>;
 if(payment.status==='PAID'&&payment.paidAt)return <small className="grace paid"><ShieldCheck size={13}/> Paid {formatDateTime(payment.paidAt)}</small>;
 if(payment.status==='APPEAL_SETTLEMENT'&&payment.settlement)return <small className="grace settled"><Scale size={13}/> Settled by an admin {formatDateTime(payment.settlement.resolvedAt)}</small>;
 return null;
}

const canAppeal=(payment:SessionPayment)=>payment.status==='PENDING'&&Boolean(payment.maturesAt)&&new Date(payment.maturesAt!).getTime()>Date.now();

export function SessionPaymentsPage({role}:{role:WorkspaceRole}){
 const owner=useOwner(role);
 const toast=useToast();
 const payee=role!=='student';
 const[appealing,setAppealing]=useState<SessionPayment|null>(null);

 const payments=useLoader(()=>ledgerService.payments(payee?{payeeId:owner.ownerId}:{payerId:owner.ownerId}),[owner.ownerId,payee]);
 const earnings=useLoader(()=>payee?ledgerService.earnings(owner.ownerId):Promise.resolve([]),[owner.ownerId,payee]);

 const rows=payments.data??[];
 const totals=earnings.data??[];
 const spent=rows.filter(p=>p.status!=='CANCELLED').reduce((sum,p)=>sum+(p.status==='HELD'?p.heldAmount:p.grossAmount),0);
 const currency=rows[0]?.currency??'USD';

 /* Preview-only: the server matures rows on a schedule, so without this a reviewer would have to
    wait a day to see pending become paid. */
 const fastForward=async(payment:SessionPayment)=>{
  try{await ledgerService.fastForwardGrace(payment.id);await payments.reload();await earnings.reload();toast('Grace period skipped — payment released')}
  catch(problem){toast(problem instanceof Error?problem.message:'Could not release that payment')}
 };

 return <DashboardShell role={role}>
  <div className="dash-welcome">
   <div>
    <h1>{payee?'Earnings ledger':'Session payments'}</h1>
    <p>{payee
     ?'Every session you taught, what it earned, and when it clears. Money stays pending for 24 hours so learners can appeal.'
     :'Every session you paid for. You have 24 hours after a session ends to appeal what you were charged.'}</p>
   </div>
  </div>

  <div className="stats-grid">
   {payee?<>
    <StatCard label="Pending" value={formatMoney(totals.reduce((s,t)=>s+t.pending,0),totals[0]?.currency??currency)} trend="Clears after the grace period" icon={<Clock/>}/>
    <StatCard label="Frozen by appeals" value={formatMoney(totals.reduce((s,t)=>s+t.flagged,0),totals[0]?.currency??currency)} trend="Awaiting a decision" icon={<Flag/>}/>
    <StatCard label="Paid out" value={formatMoney(totals.reduce((s,t)=>s+t.paid,0),totals[0]?.currency??currency)} trend="Already in your wallet" icon={<ShieldCheck/>}/>
    <StatCard label="Wallet balance" value={formatMoney(totals.reduce((s,t)=>s+t.available,0),totals[0]?.currency??currency)} trend="Available to withdraw" icon={<Wallet/>}/>
   </>:<>
    <StatCard label="Sessions" value={String(rows.length)} trend="Across your history" icon={<Clock/>}/>
    <StatCard label="Total charged" value={formatMoney(spent,currency)} trend="Escrow plus settled sessions" icon={<Wallet/>}/>
    <StatCard label="Open appeals" value={String(rows.filter(p=>p.status==='FLAGGED').length)} trend="Being reviewed" icon={<Flag/>}/>
    <StatCard label="In escrow" value={formatMoney(rows.filter(p=>p.status==='HELD').reduce((s,p)=>s+p.heldAmount,0),currency)} trend="Held for upcoming sessions" icon={<ShieldCheck/>}/>
   </>}
  </div>

  <div className="panel wallet-panel">
   <h3>{payee?'Sessions taught':'Sessions paid'}</h3>
   {payments.error&&<p className="ledger-error">{payments.error}</p>}
   {payments.loading&&!rows.length?<p className="org-empty">Loading the ledger…</p>
    :!rows.length?<p className="org-empty">No session payments yet.</p>
    :<div className="ledger-list">{rows.map(payment=><article key={payment.id} className="ledger-row">
     <div className="ledger-main">
      <div className="ledger-title"><strong>{payment.topic}</strong><StatusPill status={payment.status}/></div>
      <p>{payee?`Taught for ${payment.payerName}`:`with ${payment.payeeName}`} · {payment.source==='LEARNING_AD'?'from your learning ad':'direct booking'}</p>
      <div className="ledger-meta">
       <span>{formatMoney(payment.hourlyRate,payment.currency)}/hour</span>
       <span>{payment.billedMinutes===null?`${payment.scheduledMinutes} min scheduled`:`${payment.billedMinutes} of ${payment.scheduledMinutes} min billed`}</span>
       <span>{payment.currency}</span>
       {payment.status!=='HELD'&&payment.status!=='CANCELLED'&&<span>fee {bpsToPercent(payment.platformFeeBps)}%</span>}
      </div>
      <GraceNote payment={payment} payee={payee}/>
      {payment.settlement&&<p className="settlement-note">
       Settlement · {payment.payerName} {formatMoney(payment.settlement.appellantAmount,payment.currency)} · {payment.payeeName} {formatMoney(payment.settlement.respondentAmount,payment.currency)}
       <span>{payment.settlement.note}</span>
      </p>}
     </div>
     <div className="ledger-amounts">
      <b>{payee
       ?formatMoney(payment.status==='APPEAL_SETTLEMENT'?payment.settlement?.respondentAmount??0:payment.netAmount,payment.currency)
       :formatMoney(payment.status==='HELD'?payment.heldAmount:payment.grossAmount,payment.currency)}</b>
      <span>{payee?'your share':payment.status==='HELD'?'held':'charged'}</span>
      {payee&&payment.grossAmount>0&&<small>gross {formatMoney(payment.grossAmount,payment.currency)} · fee {formatMoney(payment.platformFee,payment.currency)}</small>}
      <div className="ledger-actions">
       {!payee&&canAppeal(payment)&&<button type="button" className="text-danger" onClick={()=>setAppealing(payment)}>Appeal this charge</button>}
       {payee&&payment.status==='PENDING'&&<button type="button" className="text-link" onClick={()=>fastForward(payment)}><FastForward size={13}/> Demo: skip grace</button>}
      </div>
     </div>
    </article>)}</div>}
  </div>

  {appealing&&<AppealDialog
   payment={appealing} appellantId={owner.ownerId} onClose={()=>setAppealing(null)}
   onDone={async()=>{await payments.reload();toast('Appeal submitted — this payment is now frozen')}}/>}
 </DashboardShell>;
}

function AppealDialog({payment,appellantId,onClose,onDone}:{payment:SessionPayment;appellantId:string;onClose:()=>void;onDone:()=>Promise<void>}){
 const[reason,setReason]=useState<AppealReason>('LEFT_EARLY');
 const[details,setDetails]=useState('');
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);

 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();
  if(details.trim().length<15){setError('Please describe what happened in a sentence or two.');return}
  setBusy(true);
  try{await ledgerService.openAppeal({sessionPaymentId:payment.id,appellantId,reason,details:details.trim()});await onDone();onClose()}
  catch(problem){setError(problem instanceof Error?problem.message:'The appeal could not be created.')}
  finally{setBusy(false)}
 };

 return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
  <form className="modal wallet-modal" onMouseDown={event=>event.stopPropagation()} onSubmit={submit}>
   <h2>Appeal this session charge</h2>
   <p>{payment.topic} with {payment.payeeName} · {formatMoney(payment.grossAmount,payment.currency)} for {payment.billedMinutes} minutes.</p>
   <label>What went wrong?
    <select value={reason} onChange={event=>setReason(event.target.value as AppealReason)}>
     {appealReasons.map(([value,text])=><option key={value} value={value}>{text}</option>)}
    </select>
   </label>
   <label>Tell us what happened
    <textarea value={details} onChange={event=>setDetails(event.target.value)} placeholder="The more specific you are, the faster this can be reviewed…" rows={4}/>
   </label>
   <small className="modal-hint"><AlertTriangle size={13}/> The tutor’s payment is frozen until an admin decides. Appeals close {payment.maturesAt?relativeTime(payment.maturesAt):'24 hours after the session'}.</small>
   {error&&<p className="ledger-error">{error}</p>}
   <div><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn danger" disabled={busy}>{busy?'Submitting…':'Submit appeal'}</button></div>
  </form>
 </div>;
}

const appealStatusText:Record<Appeal['status'],string>={OPEN:'Open',UNDER_REVIEW:'Under review',RESOLVED:'Resolved',REJECTED:'Rejected',WITHDRAWN:'Withdrawn'};

export function AppealsPage({role}:{role:WorkspaceRole}){
 const owner=useOwner(role);
 const toast=useToast();
 const asAppellant=role==='student';
 const appeals=useLoader(()=>ledgerService.appeals(asAppellant?{appellantId:owner.ownerId}:{respondentId:owner.ownerId}),[owner.ownerId,asAppellant]);

 const withdrawOne=async(appeal:Appeal)=>{
  try{await ledgerService.withdrawAppeal(appeal.id);await appeals.reload();toast('Appeal withdrawn — the payment resumes its grace period')}
  catch(problem){toast(problem instanceof Error?problem.message:'Could not withdraw that appeal')}
 };

 const rows=appeals.data??[];
 return <DashboardShell role={role}>
  <div className="dash-welcome"><div>
   <h1>Appeals</h1>
   <p>{asAppellant?'Sessions you have disputed. An admin reviews each one and decides how the money is split.':'Sessions a learner has disputed. Your payment stays frozen until an admin decides.'}</p>
  </div></div>
  <div className="panel wallet-panel">
   {appeals.loading&&!rows.length?<p className="org-empty">Loading appeals…</p>
    :!rows.length?<p className="org-empty">{asAppellant?'You have not appealed any session.':'No appeals have been raised against you.'}</p>
    :<div className="ledger-list">{rows.map(appeal=><article key={appeal.id} className="ledger-row">
     <div className="ledger-main">
      <div className="ledger-title"><strong>{appealReasons.find(([value])=>value===appeal.reason)?.[1]??appeal.reason}</strong><span className={`ledger-status ${appeal.status.toLowerCase()}`}>{appealStatusText[appeal.status]}</span></div>
      <p>{asAppellant?`Against ${appeal.respondentName}`:`Raised by ${appeal.appellantName}`} · session {appeal.sessionId}</p>
      <p className="appeal-details">“{appeal.details}”</p>
      {appeal.resolutionNote&&<p className="settlement-note">Admin decision · {appeal.resolutionNote}<span>Resolved by {appeal.reviewedBy} {appeal.resolvedAt?formatDateTime(appeal.resolvedAt):''}</span></p>}
     </div>
     <div className="ledger-amounts">
      <span>{formatDateTime(appeal.createdAt)}</span>
      {asAppellant&&(appeal.status==='OPEN'||appeal.status==='UNDER_REVIEW')&&<div className="ledger-actions"><button type="button" className="text-link" onClick={()=>withdrawOne(appeal)}>Withdraw appeal</button></div>}
     </div>
    </article>)}</div>}
  </div>
 </DashboardShell>;
}
