import{api,offlineFallback}from'./api';
import{ledgerRepository,type LedgerQuery}from'../mocks/ledger.repository';
import type{AppealInput,EscrowInput,ResolutionInput}from'../mocks/payments.store';
import type{Appeal,EarningsSummary,SessionPayment}from'../types/payments';

const query=(params:Record<string,string|undefined>)=>{
 const search=new URLSearchParams();
 for(const[key,value]of Object.entries(params))if(value)search.set(key,value);
 return search.toString();
};

export const ledgerService={
 payments:(filters:LedgerQuery={})=>offlineFallback(
  ()=>api<{items:SessionPayment[]}>(`/session-payments?${query(filters)}`).then(r=>r.items),
  ()=>ledgerRepository.payments(filters)),

 payment:(id:string)=>offlineFallback(
  ()=>api<{payment:SessionPayment}>(`/session-payments/${id}`).then(r=>r.payment),
  ()=>ledgerRepository.payment(id)),

 bySession:(sessionId:string)=>offlineFallback(
  ()=>api<{payment:SessionPayment|null}>(`/session-payments/by-session/${sessionId}`).then(r=>r.payment),
  ()=>ledgerRepository.bySession(sessionId)),

 /** Booking: escrows the scheduled duration against the payer's wallet. */
 create:(input:EscrowInput)=>offlineFallback(
  ()=>api<{payment:SessionPayment}>('/session-payments',{method:'POST',body:JSON.stringify(input)}).then(r=>r.payment),
  ()=>ledgerRepository.create(input)),

 /** End of session: bills the attended time and starts the 24-hour grace period. */
 settle:(paymentId:string,attendedSeconds:number)=>offlineFallback(
  ()=>api<{payment:SessionPayment}>(`/session-payments/${paymentId}/settle`,{method:'POST',body:JSON.stringify({attendedSeconds})}).then(r=>r.payment),
  ()=>ledgerRepository.settle(paymentId,attendedSeconds)),

 cancel:(paymentId:string,reason:string)=>offlineFallback(
  ()=>api<{payment:SessionPayment}>(`/session-payments/${paymentId}/cancel`,{method:'POST',body:JSON.stringify({reason})}).then(r=>r.payment),
  ()=>ledgerRepository.cancel(paymentId,reason)),

 earnings:(payeeId:string)=>offlineFallback(
  ()=>api<{summaries:EarningsSummary[]}>(`/session-payments/earnings?payeeId=${payeeId}`).then(r=>r.summaries),
  ()=>ledgerRepository.earnings(payeeId)),

 appeals:(filters:{appellantId?:string;respondentId?:string;status?:Appeal['status']}={})=>offlineFallback(
  ()=>api<{items:Appeal[]}>(`/appeals?${query(filters)}`).then(r=>r.items),
  ()=>ledgerRepository.appeals(filters)),

 appeal:(id:string)=>offlineFallback(
  ()=>api<{appeal:Appeal}>(`/appeals/${id}`).then(r=>r.appeal),
  ()=>ledgerRepository.appeal(id)),

 openAppeal:(input:AppealInput)=>offlineFallback(
  ()=>api<{appeal:Appeal}>('/appeals',{method:'POST',body:JSON.stringify(input)}).then(r=>r.appeal),
  ()=>ledgerRepository.openAppeal(input)),

 withdrawAppeal:(appealId:string)=>offlineFallback(
  ()=>api<{appeal:Appeal}>(`/appeals/${appealId}/withdraw`,{method:'POST'}).then(r=>r.appeal),
  ()=>ledgerRepository.withdrawAppeal(appealId)),

 /** Admin only: pays either side, or both, out of the money the session collected. */
 resolveAppeal:(appealId:string,input:ResolutionInput)=>offlineFallback(
  ()=>api<{appeal:Appeal}>(`/admin/appeals/${appealId}/resolve`,{method:'POST',body:JSON.stringify(input)}).then(r=>r.appeal),
  ()=>ledgerRepository.resolveAppeal(appealId,input)),

 /* Preview affordance with no backend counterpart: the server matures rows on a schedule. */
 fastForwardGrace:(paymentId:string)=>ledgerRepository.fastForwardGrace(paymentId),
};
