import type{Appeal,CurrencyCode,EarningsSummary,SessionPayment}from'../types/payments';
import{cancel,delay,escrow,fastForwardGrace,findWallet,mutate,openAppeal,resolveAppeal,settle,snapshot,withdrawAppeal,type AppealInput,type EscrowInput,type ResolutionInput}from'./payments.store';

export type LedgerQuery={payerId?:string;payeeId?:string;status?:SessionPayment['status']};

const newestFirst=(a:SessionPayment,b:SessionPayment)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime();

/** A tutor's money in three states: still maturing, frozen by an appeal, and already in the wallet. */
const summarise=(payments:SessionPayment[],available:(currency:CurrencyCode)=>number):EarningsSummary[]=>{
 const byCurrency=new Map<CurrencyCode,EarningsSummary>();
 const row=(currency:CurrencyCode)=>{
  const existing=byCurrency.get(currency);
  if(existing)return existing;
  const created:EarningsSummary={currency,pending:0,flagged:0,paid:0,available:available(currency)};
  byCurrency.set(currency,created);
  return created;
 };
 for(const payment of payments){
  const bucket=row(payment.currency);
  if(payment.status==='PENDING')bucket.pending+=payment.netAmount;
  else if(payment.status==='FLAGGED')bucket.flagged+=payment.netAmount;
  else if(payment.status==='PAID')bucket.paid+=payment.netAmount;
  else if(payment.status==='APPEAL_SETTLEMENT')bucket.paid+=payment.settlement?.respondentAmount??0;
 }
 return [...byCurrency.values()];
};

export const ledgerRepository={
 payments:async(query:LedgerQuery={})=>{
  const rows=snapshot().payments.filter(p=>
   (!query.payerId||p.payerId===query.payerId)&&
   (!query.payeeId||p.payeeId===query.payeeId||p.payeeOrgId===query.payeeId)&&
   (!query.status||p.status===query.status));
  return delay(rows.sort(newestFirst));
 },

 payment:async(id:string)=>delay(snapshot().payments.find(p=>p.id===id)??null),

 /** The classroom knows its session id, not the payment id. */
 bySession:async(sessionId:string)=>delay(snapshot().payments.find(p=>p.sessionId===sessionId)??null),

 /** Booking, from either a direct booking or an accepted ad application. */
 create:async(input:EscrowInput)=>delay(mutate(store=>escrow(store,input))),

 /** Called when the classroom session ends; attended time decides the bill. */
 settle:async(paymentId:string,attendedSeconds:number)=>delay(mutate(store=>settle(store,paymentId,attendedSeconds))),

 cancel:async(paymentId:string,reason:string)=>delay(mutate(store=>cancel(store,paymentId,reason))),

 earnings:async(payeeId:string)=>{
  const store=snapshot();
  const mine=store.payments.filter(p=>p.payeeId===payeeId||p.payeeOrgId===payeeId);
  return delay(summarise(mine,currency=>findWallet(store,payeeId,currency)?.available??0));
 },

 appeals:async(query:{appellantId?:string;respondentId?:string;status?:Appeal['status']}={})=>{
  const rows=snapshot().appeals.filter(a=>
   (!query.appellantId||a.appellantId===query.appellantId)&&
   (!query.respondentId||a.respondentId===query.respondentId)&&
   (!query.status||a.status===query.status));
  return delay(rows.reverse());
 },

 appeal:async(id:string)=>delay(snapshot().appeals.find(a=>a.id===id)??null),

 openAppeal:async(input:AppealInput)=>delay(mutate(store=>openAppeal(store,input))),
 withdrawAppeal:async(appealId:string)=>delay(mutate(store=>withdrawAppeal(store,appealId))),
 resolveAppeal:async(appealId:string,input:ResolutionInput)=>delay(mutate(store=>resolveAppeal(store,appealId,input))),

 /** Preview-only: skip the wait so the pending → paid transition can be demonstrated. */
 fastForwardGrace:async(paymentId:string)=>delay(mutate(store=>fastForwardGrace(store,paymentId))),
};
