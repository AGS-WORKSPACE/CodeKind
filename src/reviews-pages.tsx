import{useState}from'react';
import{Star}from'lucide-react';
import{DashboardShell}from'./components';
import{useAuth}from'./auth';
import{useLoader}from'./hooks/use-payments';
import{reviewsService}from'./services/reviews.service';
import{tutorService}from'./services/tutor.service';

const when=(iso:string)=>new Date(iso).toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'});

export function StarRow({rating}:{rating:number}){
 return <span className="star-row" aria-label={`${rating} out of 5`}>
  {[1,2,3,4,5].map(value=><Star key={value} size={14} fill={value<=rating?'currentColor':'none'} className={value<=rating?'on':''}/>)}
 </span>;
}

/** One tutor's reviews, used on their public profile and on their own reviews page. */
export function ReviewList({tutorId,empty}:{tutorId:string;empty:string}){
 const[page,setPage]=useState(1);
 const reviews=useLoader(()=>reviewsService.forTutor(tutorId,page),[tutorId,page]);
 if(reviews.loading&&!reviews.data)return <p className="org-empty">Loading reviews…</p>;
 if(reviews.error)return <p className="ledger-error">{reviews.error}</p>;
 const items=reviews.data?.items??[];
 if(!items.length)return <p className="org-empty">{empty}</p>;

 const pages=reviews.data?.pagination.pages??1;
 return <div className="review-list">
  {items.map(review=><article key={review.id}>
   <header><StarRow rating={review.rating}/><strong>{review.learnerName}</strong><small>{review.topic} · {when(review.createdAt)}</small></header>
   {review.comment&&<p>{review.comment}</p>}
  </article>)}
  {pages>1&&<div className="review-pages">
   <button className="btn ghost" disabled={page<=1} onClick={()=>setPage(page-1)}>Newer</button>
   <span>Page {page} of {pages}</span>
   <button className="btn ghost" disabled={page>=pages} onClick={()=>setPage(page+1)}>Older</button>
  </div>}
 </div>;
}

/** What learners have said about the signed-in tutor. */
export function TutorReviewsPage(){
 const{user}=useAuth();
 // The standing comes from the profile, which holds the average of every review, not just this page.
 const profile=useLoader(()=>tutorService.myProfile(),[]);
 const count=profile.data?.reviewCount??0;

 return <DashboardShell role="tutor">
  <div className="workspace-title">
   <div><h1>Reviews</h1><p>What your learners said after their sessions. Only they can write one, and only about a session that happened.</p></div>
  </div>
  {count>0&&<div className="review-standing">
   <strong>{(profile.data?.rating??0).toFixed(1)}</strong><StarRow rating={Math.round(profile.data?.rating??0)}/>
   <span>from {count} review{count===1?'':'s'}</span>
  </div>}
  {user&&<ReviewList tutorId={user.id} empty="No reviews yet. They appear here as soon as a learner leaves one."/>}
 </DashboardShell>;
}
