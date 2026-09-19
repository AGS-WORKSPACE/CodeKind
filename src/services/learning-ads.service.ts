import{api}from'./api';
import type{CurrencyCode}from'../types/payments';

export type AdLevel='beginner'|'intermediate'|'advanced';
export type LearningAd={
 id:string;learner:{id:string;name:string};title:string;description:string;skillCode:string;skill:string;level:AdLevel;
 currency:CurrencyCode;hourlyRate:number;sessionMinutes:number;sessionCost:number;preferredTimes:string;
 status:'open'|'closed'|'filled';applications:number;closesAt:string;createdAt:string;
};
export type AdApplication={
 id:string;ad?:LearningAd;tutor:{id:string;name:string};headline:string;rating:number;reviewCount:number;
 message:string;startsAt:string;status:'applied'|'shortlisted'|'accepted'|'declined'|'withdrawn';bookingId:string|null;createdAt:string;
};
export type AdInput={title:string;description:string;skillCode:string;level:AdLevel;currency:CurrencyCode;hourlyRate:number;sessionMinutes:number;preferredTimes:string};

type One={application:AdApplication};
const answer=(id:string,action:'accept'|'shortlist'|'decline'|'withdraw')=>
 api<One>(`/ad-applications/${id}/${action}`,{method:'POST'}).then(r=>r.application);

/* A learner posts what they want at their own rate; tutors apply with a first session time, and
   accepting one books it and holds the money in one step. */
export const adsService={
 board:(skill='')=>api<{items:LearningAd[]}>(`/ads${skill?`?skill=${encodeURIComponent(skill)}`:''}`).then(r=>r.items),
 mine:()=>api<{items:LearningAd[]}>('/ads/mine').then(r=>r.items),
 post:(input:AdInput)=>api<{ad:LearningAd}>('/ads',{method:'POST',body:JSON.stringify(input)}).then(r=>r.ad),
 close:(id:string)=>api<{ad:LearningAd}>(`/ads/${id}/close`,{method:'POST'}).then(r=>r.ad),
 applications:(adId:string)=>api<{items:AdApplication[]}>(`/ads/${adId}/applications`).then(r=>r.items),
 myApplications:()=>api<{items:AdApplication[]}>('/ad-applications').then(r=>r.items),
 apply:(adId:string,message:string,startsAt:string)=>
  api<One>(`/ads/${adId}/applications`,{method:'POST',body:JSON.stringify({message,startsAt})}).then(r=>r.application),
 accept:(id:string)=>answer(id,'accept'),
 shortlist:(id:string)=>answer(id,'shortlist'),
 decline:(id:string)=>answer(id,'decline'),
 withdraw:(id:string)=>answer(id,'withdraw'),
};
