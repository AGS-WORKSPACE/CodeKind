import{useEffect,useState}from'react';import{Link,useLocation,useParams}from'react-router-dom';import{BookOpen,CalendarDays,Check,Clock,Lock,Star,Users}from'lucide-react';
import{useAuth}from'../auth';
import{useLoader}from'../hooks/use-payments';
import{ledgerService}from'../services/ledger.service';
import{reviewsService,type Review}from'../services/reviews.service';
import{SessionHomework}from'../assignments-page';
import{scheduleService,type Booking}from'../services/schedule.service';
import{formatMoney,relativeTime}from'../lib/money';
import type{SessionPayment}from'../types/payments';

/**
 * Ending a session is what settles its payment: the attended time becomes the bill, the unused
 * escrow goes back to the learner, and the tutor's share starts its grace period. Doing it here
 * keeps the money in step with what actually happened in the room.
 */
function useSettledPayment(sessionId:string|undefined){
 const[payment,setPayment]=useState<SessionPayment|null>(null);
 const[error,setError]=useState<string|null>(null);
 useEffect(()=>{
  if(!sessionId)return;
  let live=true;
  // Ending the session is what settles it; the server bills from what the room recorded. Calling
  // it twice is safe, so both sides can land here.
  ledgerService.endSession(sessionId)
   .catch(()=>ledgerService.bySession(sessionId))
   .then(result=>{if(live)setPayment(result)})
   .catch(problem=>{if(live)setError(problem instanceof Error?problem.message:'The session payment could not be settled.')});
  return()=>{live=false};
 },[sessionId]);
 return{payment,error};
}

const when=(iso:string)=>new Date(iso).toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'});
const first=(name:string|undefined)=>name?.split(' ')[0];

function SessionBilling({payment,error,view}:{payment:SessionPayment|null;error:string|null;view:'student'|'tutor'}){
 if(error)return <div className="summary-billing"><p className="ledger-error">{error}</p></div>;
 if(!payment)return null;
 const returned=payment.heldAmount-payment.grossAmount;
 return <div className="summary-billing">
  <h2>{view==='tutor'?'What this session earned':'What you were charged'}</h2>
  <div className="billing-rows">
   <p><span>Billed time</span><strong>{payment.billedMinutes??0} of {payment.scheduledMinutes} minutes</strong></p>
   <p><span>Rate</span><strong>{formatMoney(payment.hourlyRate,payment.currency)} / hour</strong></p>
   {view==='tutor'
    ?<><p><span>Session total</span><strong>{formatMoney(payment.grossAmount,payment.currency)}</strong></p>
       <p><span>Platform fee</span><strong>−{formatMoney(payment.platformFee,payment.currency)}</strong></p>
       <p className="billing-total"><span>Your share</span><strong>{formatMoney(payment.netAmount,payment.currency)}</strong></p></>
    :<><p><span>Held at booking</span><strong>{formatMoney(payment.heldAmount,payment.currency)}</strong></p>
       <p><span>Returned to your wallet</span><strong>{formatMoney(returned,payment.currency)}</strong></p>
       <p className="billing-total"><span>Charged</span><strong>{formatMoney(payment.grossAmount,payment.currency)}</strong></p></>}
  </div>
  {payment.maturesAt&&<p className="escrow-note"><Lock size={14}/> {view==='tutor'
   ?`This clears to your wallet ${relativeTime(payment.maturesAt)} unless the learner appeals.`
   :`You can appeal this charge until it clears ${relativeTime(payment.maturesAt)}.`}</p>}
  <Link className="text-link" to={view==='tutor'?'/tutor/earnings':'/student/payments'}>{view==='tutor'?'Open your earnings ledger':'Review or appeal this charge'}</Link>
 </div>;
}

/** The learner's word on the session. Sending it again replaces what they said before. */
function ReviewForm({bookingId,tutorName}:{bookingId:string;tutorName:string}){
 const existing=useLoader(()=>reviewsService.forSession(bookingId),[bookingId]);
 const[rating,setRating]=useState(0);
 const[comment,setComment]=useState('');
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);
 const[saved,setSaved]=useState<Review|null>(null);
 const review=saved??existing.data;
 useEffect(()=>{if(existing.data){setRating(existing.data.rating);setComment(existing.data.comment)}},[existing.data]);

 const send=async(event:React.FormEvent)=>{
  event.preventDefault();
  if(rating<1){setError('Choose how many stars this session deserves.');return}
  setBusy(true);setError(null);
  try{setSaved(await reviewsService.save(bookingId,rating,comment))}
  catch(problem){setError(problem instanceof Error?problem.message:'That review could not be saved.')}
  finally{setBusy(false)}
 };

 return <form className="summary-review" onSubmit={send}>
  <h2>{review?'Your review':`How was your session with ${first(tutorName)}?`}</h2>
  <div className="star-picker">
   {[1,2,3,4,5].map(value=>
    <button type="button" key={value} className={value<=rating?'on':''} aria-label={`${value} star${value>1?'s':''}`} onClick={()=>setRating(value)}>
     <Star size={22} fill={value<=rating?'currentColor':'none'}/>
    </button>)}
  </div>
  <textarea value={comment} onChange={event=>setComment(event.target.value)} placeholder="What went well, and what could have gone better? Other learners read this."/>
  {error&&<p className="ledger-error">{error}</p>}
  <button className="btn" disabled={busy}>{busy?'Saving…':review?'Update my review':'Leave this review'}</button>
  {review&&!busy&&<p className="escrow-note">Your review is on {tutorName}’s profile. You can change it here whenever you like.</p>}
 </form>;
}

/** The facts of the session, all read from the booking rather than written here. */
function SessionFacts({booking,minutes}:{booking:Booking;minutes:number}){
 return <div className="summary-meta">
  <span><CalendarDays/> {when(booking.startsAt)}</span>
  <span><Clock/> {minutes} minutes</span>
  <span><BookOpen/> {booking.skill||booking.topic}</span>
 </div>;
}

export function LessonSummary(){
 const{bookingId}=useParams();
 const{user}=useAuth();
 const{state}=useLocation();
 const booking=useLoader(()=>bookingId?scheduleService.get(bookingId):Promise.resolve(null),[bookingId]);
 const{payment,error}=useSettledPayment(bookingId);
 // The booking says which side you are on; a demo tab has no session, so the room passes it along.
 const tutorView=booking.data?booking.data.tutor.id===user?.id:(state as{view?:string}|null)?.view==='tutor';

 return <main className="lesson-summary">
  <header><Link to="/">⌘ pairlore</Link></header>
  {booking.loading&&!booking.data?<section><p>Loading this session…</p></section>
   :!booking.data?<section><p>{booking.error??'This session is not one of yours.'}</p><Link className="text-link" to="/">Back to pairlore</Link></section>
   :tutorView?<TutorSummary booking={booking.data} payment={payment} error={error}/>
   :<StudentSummary booking={booking.data} payment={payment} error={error}/>}
 </main>;
}

type SideProps={booking:Booking;payment:SessionPayment|null;error:string|null};

function StudentSummary({booking,payment,error}:SideProps){
 const minutes=payment?.billedMinutes??booking.durationMinutes;
 return <section>
  <div className="summary-check"><Check/></div>
  <span className="eyebrow">LESSON COMPLETE</span>
  <h1>Great work today{first(booking.learner.name)?`, ${first(booking.learner.name)}`:''}!</h1>
  <p>You spent {minutes} minutes on {booking.topic} with {booking.tutor.name}.</p>
  <SessionFacts booking={booking} minutes={minutes}/>
  <SessionBilling payment={payment} error={error} view="student"/>
  <SessionHomework bookingId={booking.id} role="student"/>
  <ReviewForm bookingId={booking.id} tutorName={booking.tutor.name}/>
  <div className="summary-actions">
   <Link className="btn" to={`/booking/${booking.tutor.id}`}>Book another lesson</Link>
   <Link className="btn ghost" to="/student/lessons">My lessons</Link>
   <Link className="text-link" to="/student/dashboard">Return to dashboard</Link>
  </div>
 </section>;
}

function TutorSummary({booking,payment,error}:SideProps){
 const minutes=payment?.billedMinutes??booking.durationMinutes;
 return <section>
  <div className="summary-check"><Check/></div>
  <span className="eyebrow">SESSION COMPLETE</span>
  <h1>You taught {first(booking.learner.name)??'your learner'} for {minutes} minutes</h1>
  <p>{booking.topic} · the session is closed and the money is settled.</p>
  <SessionFacts booking={booking} minutes={minutes}/>
  <SessionBilling payment={payment} error={error} view="tutor"/>
  <SessionHomework bookingId={booking.id} role="tutor"/>
  <div className="summary-actions">
   <Link className="btn" to="/tutor/students"><Users size={15}/> My students</Link>
   <Link className="btn ghost" to="/tutor/calendar">My calendar</Link>
   <Link className="text-link" to="/tutor/dashboard">Return to dashboard</Link>
  </div>
 </section>;
}
