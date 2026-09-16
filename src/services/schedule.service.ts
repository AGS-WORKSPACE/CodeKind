import{api,offlineFallback}from'./api';
import{ledgerRepository}from'../mocks/ledger.repository';
import type{SessionPayment}from'../types/payments';

export type Booking={id:string;tutor:{id:string;name:string};learner:{id:string;name:string};skillCode:string;skill:string;topic:string;notes:string;startsAt:string;durationMinutes:number;status:'scheduled'|'completed'|'cancelled';cancelReason:string|null};
export type BookingInput={tutorId:string;skillCode?:string;topic:string;notes?:string;startsAt:string;durationMinutes:number};

// Offline, the calendar shows the demo sessions held in the payments ledger.
const fromPayment=(p:SessionPayment):Booking=>({id:p.sessionId,tutor:{id:p.payeeId,name:p.payeeName},learner:{id:p.payerId,name:p.payerName},skillCode:'',skill:p.skill??'',topic:p.topic,notes:'',startsAt:p.startsAt??p.createdAt,durationMinutes:p.scheduledMinutes,status:'scheduled',cancelReason:null});
const offlineRange=async(from:Date,to:Date)=>(await ledgerRepository.payments({status:'HELD'})).map(fromPayment).filter(b=>{const start=new Date(b.startsAt);return start>=from&&start<to});

export const scheduleService={
 /** Sessions starting in [from, to), on the side of the active workspace. */
 range:(from:Date,to:Date)=>offlineFallback(
  ()=>api<{items:Booking[]}>(`/bookings?from=${from.toISOString()}&to=${to.toISOString()}`).then(r=>r.items),
  ()=>offlineRange(from,to)),
 book:(input:BookingInput)=>offlineFallback(
  ()=>api<{booking:Booking}>('/bookings',{method:'POST',body:JSON.stringify(input)}).then(r=>r.booking),
  async()=>null),
 cancel:(id:string,reason='')=>api<{booking:Booking}>(`/bookings/${id}/cancel`,{method:'POST',body:JSON.stringify({reason})}).then(r=>r.booking),
 reschedule:(id:string,startsAt:string)=>api<{booking:Booking}>(`/bookings/${id}/reschedule`,{method:'POST',body:JSON.stringify({startsAt})}).then(r=>r.booking),
};
