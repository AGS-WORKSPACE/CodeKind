import{api}from'./api';
import type{Appeal,AppealReason,EarningsSummary,SessionPayment}from'../types/payments';

export type LedgerQuery={status?:SessionPayment['status'];asPayee?:boolean};
export type AppealInput={sessionPaymentId:string;reason:AppealReason;details:string};

const query=(params:Record<string,string|undefined>)=>{
 const search=new URLSearchParams();
 for(const[key,value]of Object.entries(params))if(value)search.set(key,value);
 return search.toString();
};

/* The session ledger. Ownership comes from the session cookie, so a person only ever sees their
   own side; the admin pages use admin-payments.service. */
export const ledgerService={
 payments:(filters:LedgerQuery={},userId?:string)=>
  api<{items:SessionPayment[]}>(`/session-payments?${query({status:filters.status,payeeId:filters.asPayee?userId:undefined})}`).then(r=>r.items),

 payment:(id:string)=>api<{payment:SessionPayment}>(`/session-payments/${id}`).then(r=>r.payment),

 bySession:(sessionId:string)=>api<{payment:SessionPayment|null}>(`/session-payments/by-session/${sessionId}`).then(r=>r.payment),

 earnings:()=>api<{summaries:EarningsSummary[]}>('/session-payments/earnings').then(r=>r.summaries),

 /** Ending a session bills the time both people were in the room and starts the grace period. */
 endSession:(sessionId:string)=>api<{payment:SessionPayment}>(`/sessions/${sessionId}/end`,{method:'POST'}).then(r=>r.payment),

 appeals:(asRespondent=false,userId?:string)=>
  api<{items:Appeal[]}>(`/appeals?${query({respondentId:asRespondent?userId:undefined})}`).then(r=>r.items),

 appeal:(id:string)=>api<{appeal:Appeal}>(`/appeals/${id}`).then(r=>r.appeal),

 openAppeal:(input:AppealInput)=>api<{appeal:Appeal}>('/appeals',{method:'POST',body:JSON.stringify(input)}).then(r=>r.appeal),

 withdrawAppeal:(appealId:string)=>api<{appeal:Appeal}>(`/appeals/${appealId}/withdraw`,{method:'POST'}).then(r=>r.appeal),
};
