import{api}from'./api';

export type AssignmentStatus='set'|'submitted'|'reviewed';
export type AssignmentView='open'|'submitted'|'reviewed';
export type Assignment={
 id:string;bookingId:string;topic:string;
 tutor:{id:string;name:string};learner:{id:string;name:string};
 title:string;instructions:string;dueAt:string|null;status:AssignmentStatus;
 answer:string;answerUrl:string;submittedAt:string|null;
 feedback:string;reviewedAt:string|null;createdAt:string;
};
export type AssignmentList={items:Assignment[];counts:Record<AssignmentView,number>};
export type AssignmentInput={bookingId:string;title:string;instructions:string;dueAt:string|null};

/* Work set after a session. The side you see follows the active workspace, like lessons do. */
export const assignmentsService={
 list:(view:AssignmentView)=>api<AssignmentList>(`/assignments?view=${view}`),

 /** Work set after one session, for its summary page. */
 forSession:(bookingId:string)=>api<AssignmentList>(`/assignments?bookingId=${bookingId}`).then(r=>r.items),

 set:(input:AssignmentInput)=>api<{assignment:Assignment}>('/assignments',{method:'POST',body:JSON.stringify(input)}).then(r=>r.assignment),

 /** Handing in again replaces the answer, until the tutor has reviewed it. */
 submit:(id:string,answer:string,answerUrl:string)=>
  api<{assignment:Assignment}>(`/assignments/${id}/submit`,{method:'POST',body:JSON.stringify({answer,answerUrl})}).then(r=>r.assignment),

 review:(id:string,feedback:string)=>
  api<{assignment:Assignment}>(`/assignments/${id}/review`,{method:'POST',body:JSON.stringify({feedback})}).then(r=>r.assignment),
};
