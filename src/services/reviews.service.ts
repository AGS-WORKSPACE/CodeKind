import{api,offlineFallback}from'./api';

export type Review={id:string;bookingId:string;tutorId:string;learnerId:string;learnerName:string;topic:string;rating:number;comment:string;createdAt:string};
export type ReviewPage={items:Review[];pagination:{page:number;pages:number;total:number}};

/* A review belongs to one finished session, written by the learner who sat in it. Writing it
   again replaces it, so there is nothing to undo. */
export const reviewsService={
 forSession:(bookingId:string)=>api<{review:Review|null}>(`/bookings/${bookingId}/review`).then(r=>r.review),

 save:(bookingId:string,rating:number,comment:string)=>
  api<{review:Review}>(`/bookings/${bookingId}/review`,{method:'POST',body:JSON.stringify({rating,comment})}).then(r=>r.review),

 forTutor:(tutorId:string,page=1)=>offlineFallback(
  ()=>api<ReviewPage>(`/tutors/${tutorId}/reviews?page=${page}`),
  async():Promise<ReviewPage>=>({items:[],pagination:{page:1,pages:1,total:0}})),

 /** The newest reviews worth showing, for the home page. */
 latest:()=>offlineFallback(
  ()=>api<{items:Review[]}>('/reviews/latest').then(r=>r.items),
  async()=>[] as Review[]),
};

export type PlatformStats={tutors:number;sessions:number;reviews:number;rating:number};

/** The few numbers the landing page may show. Nothing is displayed until there is something real. */
export const statsService={
 read:()=>offlineFallback(()=>api<PlatformStats>('/stats'),async():Promise<PlatformStats>=>({tutors:0,sessions:0,reviews:0,rating:0})),
};
