import{ApiError,api,offlineFallback}from'./api';

export type Booking={id:string;tutor:{id:string;name:string};learner:{id:string;name:string};skillCode:string;skill:string;topic:string;notes:string;startsAt:string;durationMinutes:number;status:'scheduled'|'completed'|'cancelled';cancelReason:string|null;seriesId?:string;sessionCost?:number;currency?:string};
export type BookingInput={tutorId:string;skillCode?:string;topic:string;notes?:string;startsAt:string;durationMinutes:number};
export type LessonView='upcoming'|'past'|'cancelled';
export type Busy={startsAt:string;endsAt:string};
export type Student={id:string;name:string;learningGoals:string|null;skills:string[];sessions:number;upcoming:number;nextAt:string|null;lastAt:string|null};
export type StudentView='active'|'previous';
export type Students={items:Student[];active:number;previous:number};

export const endsAt=(b:{startsAt:string;durationMinutes:number})=>new Date(b.startsAt).getTime()+b.durationMinutes*60000;

export const scheduleService={
 /** Sessions starting in [from, to), on the side of the active workspace. */
 range:(from:Date,to:Date)=>offlineFallback(
  ()=>api<{items:Booking[]}>(`/bookings?from=${from.toISOString()}&to=${to.toISOString()}`).then(r=>r.items),
  async()=>[] as Booking[]),
 /** One tab of the lessons page, 20 at a time. */
 list:(view:LessonView,page=1)=>offlineFallback(
  ()=>api<{items:Booking[]}>(`/bookings?view=${view}&page=${page}`).then(r=>r.items),
  async()=>[] as Booking[]),
 /** A booking, or null when it is not one of yours. */
 get:(id:string)=>offlineFallback(
  ()=>api<{booking:Booking}>(`/bookings/${id}`).then(r=>r.booking).catch(problem=>{if(problem instanceof ApiError&&problem.status===404)return null;throw problem}),
  async()=>null),
 /** When the tutor is already taken, so booking only offers free times. */
 busy:(tutorId:string,from:Date,to:Date)=>offlineFallback(
  ()=>api<{items:Busy[]}>(`/tutors/${tutorId}/busy?from=${from.toISOString()}&to=${to.toISOString()}`).then(r=>r.items),
  async()=>[] as Busy[]),
 book:(input:BookingInput)=>offlineFallback(
  ()=>api<{booking:Booking}>('/bookings',{method:'POST',body:JSON.stringify(input)}).then(r=>r.booking),
  async()=>null),
 /** The tutor's learners, 20 a page. Active ones have a session coming up. */
 students:(view:StudentView,page=1)=>offlineFallback(
  ()=>api<Students>(`/tutor/students?view=${view}&page=${page}`),
  async():Promise<Students>=>({items:[],active:0,previous:0})),
 cancel:(id:string,reason='')=>api<{booking:Booking}>(`/bookings/${id}/cancel`,{method:'POST',body:JSON.stringify({reason})}).then(r=>r.booking),
 reschedule:(id:string,startsAt:string)=>api<{booking:Booking}>(`/bookings/${id}/reschedule`,{method:'POST',body:JSON.stringify({startsAt})}).then(r=>r.booking),
};
