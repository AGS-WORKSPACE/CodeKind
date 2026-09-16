import{api}from'./api';
import type{TutorProfile,TutorStatus}from'./tutor.service';

export type ReviewStatus=Exclude<TutorStatus,'draft'>;
export type TutorApplication=TutorProfile&{email:string;submittedAt:string|null};

// No offline fallback: approving a tutor only means something on the real backend.
export const adminTutorService={
 applications:(status:ReviewStatus)=>api<{items:TutorApplication[]}>(`/admin/tutors?status=${status}`).then(r=>r.items),
 decide:(id:string,status:'approved'|'rejected',reason='')=>api<unknown>(`/admin/tutors/${id}`,{method:'PATCH',body:JSON.stringify({status,reason})}).then(()=>undefined),
};
