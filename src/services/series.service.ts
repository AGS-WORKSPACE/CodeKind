import{api}from'./api';
import type{CurrencyCode}from'../types/payments';

export type SeriesStatus='proposed'|'accepted'|'declined'|'cancelled';
export type Series={
 id:string;tutor:{id:string;name:string};learner:{id:string;name:string};
 topic:string;notes:string;weekdays:number[];startTime:string;timezone:string;durationMinutes:number;
 startsOn:string;endsOn:string;currency:CurrencyCode;sessionCost:number;status:SeriesStatus;
 sessions:number;done:number;ahead:number;firstAt:string;
};
export type SeriesInput={learnerId:string;skillCode:string;topic:string;notes:string;weekdays:number[];startTime:string;durationMinutes:number;startsOn:string;endsOn:string};

/* A standing schedule: the tutor proposes, the learner accepts, and each session is paid for only
   when the learner opens it. */
export const seriesService={
 list:()=>api<{items:Series[]}>('/series').then(r=>r.items),
 propose:(input:SeriesInput)=>api<{series:Series}>('/series',{method:'POST',body:JSON.stringify(input)}).then(r=>r.series),
 accept:(id:string)=>api<{series:Series}>(`/series/${id}/accept`,{method:'POST'}).then(r=>r.series),
 decline:(id:string)=>api<{series:Series}>(`/series/${id}/decline`,{method:'POST'}).then(r=>r.series),
 cancel:(id:string,reason='')=>api<{series:Series}>(`/series/${id}/cancel`,{method:'POST',body:JSON.stringify({reason})}).then(r=>r.series),
};

export const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/** How many sessions a schedule makes, counted the same way the server does. */
export function countSessions(weekdays:number[],startsOn:string,endsOn:string){
 if(!startsOn||!endsOn||!weekdays.length)return 0;
 let count=0;
 for(let day=new Date(`${startsOn}T00:00:00Z`);day<=new Date(`${endsOn}T00:00:00Z`);day.setUTCDate(day.getUTCDate()+1)){
  if(weekdays.includes(day.getUTCDay()))count++;
 }
 return count;
}
