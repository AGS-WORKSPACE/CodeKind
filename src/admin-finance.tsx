import{useState}from'react';
import{Scale}from'lucide-react';
import{useAuth}from'./auth';
import{useToast}from'./ui-feedback';
import{useLoader}from'./hooks/use-payments';
import{ledgerService}from'./services/ledger.service';
import{StatusPill,appealReasons}from'./ledger-pages';
import{bpsToPercent,formatDateTime,formatMoney,relativeTime,toMajor,toMinor}from'./lib/money';
import type{Appeal,SessionPayment}from'./types/payments';

/** The whole session-payment ledger, which is the money view the finance team works from. */
export function AdminSessionPayments(){
 const[status,setStatus]=useState<SessionPayment['status']|'ALL'>('ALL');
 const payments=useLoader(()=>ledgerService.payments(status==='ALL'?{}:{status}),[status]);
 const rows=payments.data??[];
 const total=(pick:(payment:SessionPayment)=>number)=>rows.reduce((sum,payment)=>sum+pick(payment),0);
 const currency=rows[0]?.currency??'USD';

 return <div className="admin-page">
  <header className="admin-page-head">
   <div><h1>Session payments</h1><p>One row per session: what the learner was charged, what the tutor earns, and where it is in the grace period.</p></div>
   <label className="inline-select">Status
    <select value={status} onChange={event=>setStatus(event.target.value as SessionPayment['status']|'ALL')}>
     {['ALL','HELD','PENDING','FLAGGED','PAID','APPEAL_SETTLEMENT','CANCELLED'].map(value=><option key={value} value={value}>{value.replace('_',' ').toLowerCase()}</option>)}
    </select>
   </label>
  </header>

  <div className="admin-metrics">
   <article><p>Rows</p><h3>{rows.length}</h3><span>matching this filter</span></article>
   <article><p>Gross collected</p><h3>{formatMoney(total(p=>p.grossAmount),currency)}</h3><span>captured from learners</span></article>
   <article><p>Platform fees</p><h3>{formatMoney(total(p=>p.platformFee),currency)}</h3><span>platform revenue</span></article>
   <article><p>Owed to tutors</p><h3>{formatMoney(total(p=>p.status==='PENDING'||p.status==='FLAGGED'?p.netAmount:0),currency)}</h3><span>pending and frozen</span></article>
  </div>

  {payments.error&&<p className="ledger-error">{payments.error}</p>}
  <div className="panel wallet-panel">
   {payments.loading&&!rows.length?<p className="org-empty">Loading the ledger…</p>
    :!rows.length?<p className="org-empty">No session payments with this status.</p>
    :<table className="org-table ledger-table"><thead><tr><th>Session</th><th>Parties</th><th>Billing</th><th>Gross</th><th>Fee</th><th>Net to tutor</th><th>Status</th></tr></thead><tbody>
     {rows.map(payment=><tr key={payment.id}>
      <td><strong>{payment.topic}</strong><span>{payment.id} · {payment.source==='LEARNING_AD'?'learning ad':'direct booking'}</span></td>
      <td><strong>{payment.payerName}</strong><span>→ {payment.payeeName}</span></td>
      <td>{payment.billedMinutes===null?`${payment.scheduledMinutes} min scheduled`:`${payment.billedMinutes}/${payment.scheduledMinutes} min`}<span>{formatMoney(payment.hourlyRate,payment.currency)}/hr · {bpsToPercent(payment.platformFeeBps)}%</span></td>
      <td className="amount">{formatMoney(payment.status==='HELD'?payment.heldAmount:payment.grossAmount,payment.currency)}</td>
      <td className="amount">{formatMoney(payment.platformFee,payment.currency)}</td>
      <td className="amount">{formatMoney(payment.netAmount,payment.currency)}</td>
      <td><StatusPill status={payment.status}/>{payment.maturesAt&&payment.status==='PENDING'&&<span>clears {relativeTime(payment.maturesAt)}</span>}</td>
     </tr>)}
    </tbody></table>}
  </div>
 </div>;
}

/** Appeal resolution: manual by design, and the only way a flagged payment ever moves again. */
export function AdminAppeals(){
 const{user}=useAuth();
 const toast=useToast();
 const[resolving,setResolving]=useState<Appeal|null>(null);
 const appeals=useLoader(()=>ledgerService.appeals(),[]);
 const payments=useLoader(()=>ledgerService.payments(),[]);
 const rows=appeals.data??[];
 const open=rows.filter(appeal=>appeal.status==='OPEN'||appeal.status==='UNDER_REVIEW');
 const paymentFor=(appeal:Appeal)=>(payments.data??[]).find(payment=>payment.id===appeal.sessionPaymentId);

 return <div className="admin-page">
  <header className="admin-page-head">
   <div><h1>Appeals</h1><p>Each open appeal freezes a tutor payment. Decide how much goes to the learner, to the tutor, or to both.</p></div>
  </header>

  <div className="admin-metrics">
   <article><p>Open</p><h3>{open.length}</h3><span>awaiting a decision</span></article>
   <article><p>Resolved</p><h3>{rows.filter(a=>a.status==='RESOLVED').length}</h3><span>settled by an admin</span></article>
   <article><p>Withdrawn</p><h3>{rows.filter(a=>a.status==='WITHDRAWN').length}</h3><span>dropped by the learner</span></article>
   <article><p>Frozen value</p><h3>{formatMoney(open.reduce((sum,appeal)=>sum+(paymentFor(appeal)?.netAmount??0),0),paymentFor(open[0]??rows[0]??({} as Appeal))?.currency??'USD')}</h3><span>tutor money on hold</span></article>
  </div>

  <div className="panel wallet-panel">
   {appeals.loading&&!rows.length?<p className="org-empty">Loading appeals…</p>
    :!rows.length?<p className="org-empty">No appeals have been raised.</p>
    :<div className="ledger-list">{rows.map(appeal=>{
     const payment=paymentFor(appeal);
     return <article key={appeal.id} className="ledger-row">
      <div className="ledger-main">
       <div className="ledger-title">
        <strong>{appealReasons.find(([value])=>value===appeal.reason)?.[1]??appeal.reason}</strong>
        <span className={`ledger-status ${appeal.status.toLowerCase()}`}>{appeal.status.replace('_',' ').toLowerCase()}</span>
        {payment&&<StatusPill status={payment.status}/>}
       </div>
       <p>{appeal.appellantName} against {appeal.respondentName} · {payment?.topic??appeal.sessionId} · raised {formatDateTime(appeal.createdAt)}</p>
       <p className="appeal-details">“{appeal.details}”</p>
       {payment&&<div className="ledger-meta">
        <span>{payment.billedMinutes}/{payment.scheduledMinutes} min billed</span>
        <span>gross {formatMoney(payment.grossAmount,payment.currency)}</span>
        <span>fee {formatMoney(payment.platformFee,payment.currency)}</span>
        <span>tutor net {formatMoney(payment.netAmount,payment.currency)}</span>
       </div>}
       {payment?.settlement&&<p className="settlement-note">
        Settled · learner {formatMoney(payment.settlement.appellantAmount,payment.currency)} · tutor {formatMoney(payment.settlement.respondentAmount,payment.currency)} · platform kept {formatMoney(payment.settlement.platformRetained,payment.currency)}
        <span>{payment.settlement.note} — {payment.settlement.resolvedBy}</span>
       </p>}
      </div>
      <div className="ledger-amounts">
       {(appeal.status==='OPEN'||appeal.status==='UNDER_REVIEW')&&payment&&
        <button type="button" className="btn small" onClick={()=>setResolving(appeal)}><Scale size={14}/> Resolve</button>}
      </div>
     </article>;
    })}</div>}
  </div>

  {resolving&&paymentFor(resolving)&&<ResolveDialog
   appeal={resolving} payment={paymentFor(resolving)!} resolvedBy={user?`${user.firstName} ${user.lastName}`:'Admin'}
   onClose={()=>setResolving(null)}
   onDone={async()=>{await Promise.all([appeals.reload(),payments.reload()]);toast('Appeal resolved and the payment settled')}}/>}
 </div>;
}

function ResolveDialog({appeal,payment,resolvedBy,onClose,onDone}:{appeal:Appeal;payment:SessionPayment;resolvedBy:string;onClose:()=>void;onDone:()=>Promise<void>}){
 const major=(minor:number)=>String(toMajor(minor,payment.currency));
 const[appellant,setAppellant]=useState('0');
 const[respondent,setRespondent]=useState(major(payment.netAmount));
 const[note,setNote]=useState('');
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);

 const appellantMinor=toMinor(appellant,payment.currency);
 const respondentMinor=toMinor(respondent,payment.currency);
 const retained=payment.grossAmount-appellantMinor-respondentMinor;

 const preset=(learner:number,tutor:number)=>{setAppellant(major(learner));setRespondent(major(tutor))};

 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();
  if(!note.trim()){setError('Record why you decided this — both parties see it.');return}
  if(retained<0){setError('The settlement awards more than this session collected.');return}
  setBusy(true);
  try{
   await ledgerService.resolveAppeal(appeal.id,{appellantAmount:appellantMinor,respondentAmount:respondentMinor,note:note.trim(),resolvedBy});
   await onDone();
   onClose();
  }catch(problem){setError(problem instanceof Error?problem.message:'The appeal could not be resolved.')}
  finally{setBusy(false)}
 };

 return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
  <form className="modal wallet-modal wide" onMouseDown={event=>event.stopPropagation()} onSubmit={submit}>
   <h2>Resolve appeal</h2>
   <p>{payment.topic} · {appeal.appellantName} against {appeal.respondentName}</p>
   <div className="resolve-facts">
    <span><b>{formatMoney(payment.grossAmount,payment.currency)}</b>collected</span>
    <span><b>{formatMoney(payment.platformFee,payment.currency)}</b>platform fee</span>
    <span><b>{formatMoney(payment.netAmount,payment.currency)}</b>tutor net</span>
    <span><b>{payment.billedMinutes}/{payment.scheduledMinutes}</b>minutes billed</span>
   </div>
   <p className="appeal-details">“{appeal.details}”</p>

   <div className="resolve-presets">
    <button type="button" onClick={()=>preset(payment.grossAmount,0)}>Refund the learner in full</button>
    <button type="button" onClick={()=>preset(0,payment.netAmount)}>Pay the tutor in full</button>
    <button type="button" onClick={()=>preset(Math.floor(payment.grossAmount/2),payment.grossAmount-Math.floor(payment.grossAmount/2))}>Split the session evenly</button>
   </div>

   <div className="modal-row">
    <label>To {appeal.appellantName} (learner)<input inputMode="decimal" value={appellant} onChange={event=>setAppellant(event.target.value)}/></label>
    <label>To {appeal.respondentName} (tutor)<input inputMode="decimal" value={respondent} onChange={event=>setRespondent(event.target.value)}/></label>
   </div>
   <small className={retained<0?'modal-hint error':'modal-hint'}>
    Platform keeps {formatMoney(retained,payment.currency)} of the {formatMoney(payment.grossAmount,payment.currency)} collected.
    {retained<0&&' A settlement cannot award more than the session collected.'}
   </small>
   <label>Decision note<textarea value={note} onChange={event=>setNote(event.target.value)} rows={3} placeholder="What you found, and why the money is split this way…"/></label>
   {error&&<p className="ledger-error">{error}</p>}
   <div><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy||retained<0}>{busy?'Settling…':'Settle appeal'}</button></div>
  </form>
 </div>;
}
