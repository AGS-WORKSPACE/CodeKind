import{ApiError,api,offlineFallback}from'./api';
import{ledgerRepository}from'../mocks/ledger.repository';
import type{SessionPayment}from'../types/payments';

export type Booking={id:string;tutor:{id:string;name:string};learner:{id:string;name:string};skillCode:string;skill:string;topic:string;notes:string;startsAt:string;durationMinutes:number;status:'scheduled'|'completed'|'cancelled';cancelReason:string|null};
export type BookingInput={tutorId:string;skillCode?:string;topic:string;notes?:string;startsAt:string;durationMinutes:number};
export type LessonView='upcoming'|'past'|'cancelled';
export type Busy={startsAt:string;endsAt:string};

export const endsAt=(b:{startsAt:string;durationMinutes:number})=>new Date(b.startsAt).getTime()+b.durationMinutes*60000;

// Offline, and for the browser-only demo sessions, bookings are read from the demo payments ledger.
const fromPayment=(p:SessionPayment):Booking=>({id:p.sessionId,tutor:{id:p.payeeId,name:p.payeeName},learner:{id:p.payerId,name:p.payerName},skillCode:'',skill:p.skill??'',topic:p.topic,notes:'',startsAt:p.startsAt??p.createdAt,durationMinutes:p.scheduledMinutes,status:p.status==='CANCELLED'?'cancelled':p.status==='HELD'?'scheduled':'completed',cancelReason:null});
const demoBookings=async()=>(await ledgerRepository.payments()).map(fromPayment);
const demoView=async(view:LessonView)=>(await demoBookings()).filter(b=>
 view==='cancelled'?b.status==='cancelled':view==='upcoming'?b.status==='scheduled'&&endsAt(b)>Date.now():b.status!=='cancelled'&&endsAt(b)<=Date.now());
const demoBooking=async(id:string)=>(await demoBookings()).find(b=>b.id===id)??null;

export const scheduleService={
 /** Sessions starting in [from, to), on the side of the active workspace. */
 range:(from:Date,to:Date)=>offlineFallback(
  ()=>api<{items:Booking[]}>(`/bookings?from=${from.toISOString()}&to=${to.toISOString()}`).then(r=>r.items),
  async()=>(await demoBookings()).filter(b=>{const start=new Date(b.startsAt);return b.status==='scheduled'&&start>=from&&start<to})),
 /** One tab of the lessons page, 20 at a time. */
 list:(view:LessonView,page=1)=>offlineFallback(
  ()=>api<{items:Booking[]}>(`/bookings?view=${view}&page=${page}`).then(r=>r.items),
  ()=>demoView(view)),
 /** A booking, or null. Demo sessions exist only in this browser, so they are looked up there too. */
 get:(id:string)=>offlineFallback(
  ()=>api<{booking:Booking}>(`/bookings/${id}`).then(r=>r.booking).catch(problem=>{if(problem instanceof ApiError&&problem.status===404)return demoBooking(id);throw problem}),
  ()=>demoBooking(id)),
 /** When the tutor is already taken, so booking only offers free times. */
 busy:(tutorId:string,from:Date,to:Date)=>offlineFallback(
  ()=>api<{items:Busy[]}>(`/tutors/${tutorId}/busy?from=${from.toISOString()}&to=${to.toISOString()}`).then(r=>r.items),
  async()=>[] as Busy[]),
 book:(input:BookingInput)=>offlineFallback(
  ()=>api<{booking:Booking}>('/bookings',{method:'POST',body:JSON.stringify(input)}).then(r=>r.booking),
  async()=>null),
 cancel:(id:string,reason='')=>api<{booking:Booking}>(`/bookings/${id}/cancel`,{method:'POST',body:JSON.stringify({reason})}).then(r=>r.booking),
 reschedule:(id:string,startsAt:string)=>api<{booking:Booking}>(`/bookings/${id}/reschedule`,{method:'POST',body:JSON.stringify({startsAt})}).then(r=>r.booking),
};
