import{useEffect,useState}from'react';import{Link,useLocation,useParams}from'react-router-dom';import{BookOpen,CalendarDays,Check,Clock,Download,Lock,MessageCircle,Star}from'lucide-react';
import{ledgerService}from'../services/ledger.service';
import{formatMoney,relativeTime}from'../lib/money';
import type{SessionPayment}from'../types/payments';

/**
 * Ending a session is what settles its payment: the attended time becomes the bill, the unused
 * escrow goes back to the learner, and the tutor's share starts its 24-hour grace period. Doing it
 * here keeps the money in step with what actually happened in the room.
 */
function useSettledPayment(sessionId:string|undefined,attendedSeconds:number|undefined){
 const[payment,setPayment]=useState<SessionPayment|null>(null);
 const[error,setError]=useState<string|null>(null);
 useEffect(()=>{
  if(!sessionId)return;
  let live=true;
  ledgerService.bySession(sessionId)
   .then(async found=>{
    if(!found)return null;
    // A session already settled is left alone — reopening the summary must not bill twice.
    if(found.status!=='HELD')return found;
    try{return await ledgerService.settle(found.id,attendedSeconds??found.scheduledMinutes*60)}
    catch(problem){
     // Both sides of a call land here together; if the other one settled first, show that result.
     const latest=await ledgerService.bySession(sessionId);
     if(latest&&latest.status!=='HELD')return latest;
     throw problem;
    }
   })
   .then(result=>{if(live)setPayment(result)})
   .catch(problem=>{if(live)setError(problem instanceof Error?problem.message:'The session payment could not be settled.')});
  return()=>{live=false};
 },[sessionId,attendedSeconds]);
 return{payment,error};
}

function SessionBilling({payment,error,view}:{payment:SessionPayment|null;error:string|null;view:'student'|'tutor'}){
 if(error)return <div className="summary-billing"><p className="ledger-error">{error}</p></div>;
 if(!payment)return null;
 const returned=payment.heldAmount-payment.grossAmount;
 return <div className="summary-billing">
  <h2>{view==='tutor'?'What this session earned':'What you were charged'}</h2>
  <div className="billing-rows">
   <p><span>Billed time</span><strong>{payment.billedMinutes} of {payment.scheduledMinutes} minutes</strong></p>
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
export function LessonSummary(){
 const{bookingId}=useParams();
 const{state}=useLocation();
 const{attendedSeconds,view}=(state as{attendedSeconds?:number;view?:'tutor'|'learner'}|null)??{};
 // The room says which side you were on, so a tutor lands on the tutor summary.
 const[tutorMode,setTutorMode]=useState(view==='tutor');
 const{payment,error}=useSettledPayment(bookingId,attendedSeconds);
 return <main className="lesson-summary">
  <header><Link to="/">⌘ pairlore</Link><button onClick={()=>setTutorMode(!tutorMode)}>Preview {tutorMode?'student':'tutor'} view</button></header>
  {tutorMode?<TutorSummary payment={payment} billing={<SessionBilling payment={payment} error={error} view="tutor"/>}/>:<StudentSummary payment={payment} billing={<SessionBilling payment={payment} error={error} view="student"/>}/>}
 </main>;
}
const first=(name:string|undefined)=>name?.split(' ')[0];
function StudentSummary({payment,billing}:{payment:SessionPayment|null;billing:React.ReactNode}){const minutes=payment?.billedMinutes??payment?.scheduledMinutes??60;const tutor=payment?.payeeName??'Sarah Chen';return <section><div className="summary-check"><Check/></div><span className="eyebrow">LESSON COMPLETE</span><h1>Great work today{payment?`, ${first(payment.payerName)}`:''}!</h1><p>You completed a {minutes}-minute lesson with {tutor}.</p><div className="summary-meta"><span><CalendarDays/> {new Date().toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'})}</span><span><Clock/> {minutes} minutes</span><span><BookOpen/> {payment?.topic??'JavaScript Array Methods'}</span></div><SummaryContent/>{billing}<div className="summary-actions"><button className="btn"><Star/> Leave a review</button><button className="btn ghost">Book another lesson</button><button className="btn ghost"><MessageCircle/> Message {first(tutor)}</button><Link className="text-link" to="/student/dashboard">Return to dashboard</Link></div></section>}
function TutorSummary({payment,billing}:{payment:SessionPayment|null;billing:React.ReactNode}){return <section><span className="eyebrow">COMPLETE LESSON SUMMARY</span><h1>How did {first(payment?.payerName)??'your learner'} do?</h1><p>Save a summary for the student and your private teaching records.</p>{billing}<form className="tutor-summary-form"><label>Topics covered<textarea defaultValue="filter(), callback predicates, pure functions, and edge cases"/></label><label>Student performance<select><option>Great progress</option><option>On track</option><option>Needs support</option></select></label><label>Areas to improve<textarea defaultValue="Practice recognizing empty input and validating function parameters."/></label><label>Homework<textarea defaultValue="Complete the active users exercise and add two edge-case tests."/></label><label>Private tutor notes<textarea placeholder="Only you can see these notes…"/></label><div><button type="button" className="btn ghost">Assign homework</button><button type="button" className="btn ghost">Schedule next lesson</button><button type="button" className="btn">Save summary</button></div></form></section>}
function SummaryContent(){return <div className="summary-content"><article><h2>What we covered</h2><ul><li>How filter() evaluates each array item</li><li>Writing clear predicate callbacks</li><li>Keeping transformations immutable</li></ul></article><article><h2>Homework</h2><p>Complete the active users exercise and add two edge-case tests before your next lesson.</p></article><article><h2>Resources</h2><a href="#"><Download/> Array methods cheatsheet.pdf</a><a href="#"><BookOpen/> MDN Array.prototype.filter()</a></article></div>}
