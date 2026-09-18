import{useEffect,useState}from'react';
import{Link}from'react-router-dom';
import{ArrowRight,BookOpen,CalendarDays,ClipboardList,Clock,Mail,Search,Users}from'lucide-react';
import{DashboardShell,StatCard}from'./components';
import{useAuth}from'./auth';
import{useLoader}from'./hooks/use-payments';
import{authService}from'./services/auth.service';
import{scheduleService,type Booking}from'./services/schedule.service';
import{assignmentsService}from'./services/assignments.service';
import{tutorService}from'./services/tutor.service';
import{relativeTime}from'./lib/money';

const startOfMonth=(date:Date)=>new Date(date.getFullYear(),date.getMonth(),1);
const addMonths=(date:Date,months:number)=>new Date(date.getFullYear(),date.getMonth()+months,1);
const endsAt=(b:Booking)=>new Date(b.startsAt).getTime()+b.durationMinutes*60000;

/** What the dashboard shows, worked out from this month's and next month's bookings. */
function summarise(bookings:Booking[],now=new Date()){
 const live=bookings.filter(b=>b.status!=='cancelled');
 const thisMonth=live.filter(b=>new Date(b.startsAt)<addMonths(now,1));
 const upcoming=live.filter(b=>b.status==='scheduled'&&endsAt(b)>now.getTime());
 return{
  sessions:thisMonth.length,
  hours:thisMonth.reduce((sum,b)=>sum+b.durationMinutes,0)/60,
  upcoming,
  tutors:new Set(live.map(b=>b.tutor.id)).size,
 };
}

export function StudentDashboard(){
 const{user}=useAuth();
 const month=startOfMonth(new Date());
 const bookings=useLoader(()=>scheduleService.range(month,addMonths(month,2)),[user?.id]);
 const tutors=useLoader(()=>tutorService.list(new URLSearchParams({sort:'recommended'})),[]);
 const work=useLoader(()=>assignmentsService.list('open'),[user?.id]);
 const summary=summarise(bookings.data??[]);
 const[next,following]=summary.upcoming;

 return <DashboardShell role="student">
  <div className="dash-welcome">
   <div><h1>Welcome back{user?`, ${user.firstName}`:''} 👋</h1><p>{next?`Your next session starts ${relativeTime(next.startsAt)}.`:'Book a session to start learning with a tutor.'}</p></div>
   <Link className="btn" to="/tutors"><Search size={16}/> Find a tutor</Link>
  </div>
  {user&&user.emailVerified===false&&<VerifyEmailNote email={user.email}/>}
  <div className="stats-grid">
   <StatCard label="Sessions this month" value={String(summary.sessions)} trend="Booked or taught" icon={<CalendarDays/>}/>
   <StatCard label="Hours this month" value={summary.hours.toFixed(1)} trend="Scheduled time" icon={<Clock/>}/>
   <StatCard label="Upcoming sessions" value={String(summary.upcoming.length)} trend="Next two months" icon={<BookOpen/>}/>
   <StatCard label="Tutors" value={String(summary.tutors)} trend="You have booked" icon={<Users/>}/>
  </div>
  <div className="dash-grid">
   <section className="panel next">
    <div className="panel-head"><h2>Next session</h2><Link className="text-link" to="/student/lessons">View all</Link></div>
    {bookings.error&&<p className="ledger-error">{bookings.error}</p>}
    {!next?<p className="org-empty">{bookings.loading?'Loading your schedule…':'Nothing booked yet. Find a tutor to book your first session.'}</p>
     :<SessionRow booking={next} primary/>}
    {following&&<SessionRow booking={following}/>}
   </section>
   <section className="panel">
    <div className="panel-head"><h2>Current path</h2></div>
    <p className="org-empty">Enrol in a learning path to track your progress here.</p>
    <Link className="text-link" to="/learning-paths">Browse learning paths <ArrowRight/></Link>
   </section>
   <section className="panel">
    <div className="panel-head"><h2>Assignments</h2><Link className="text-link" to="/student/assignments">View all</Link></div>
    {work.error?<p className="ledger-error">{work.error}</p>
     :!work.data?<p className="org-empty">Loading your work…</p>
     :!work.data.items.length?<p className="org-empty"><ClipboardList size={14}/> Nothing to do. Work your tutors set appears here.</p>
     :work.data.items.slice(0,3).map(a=><Link className="work-row" to="/student/assignments" key={a.id}>
       <strong>{a.title}</strong><small>{a.tutor.name}{a.dueAt?` · due ${new Date(a.dueAt).toLocaleDateString('en',{day:'numeric',month:'short'})}`:''}</small></Link>)}
   </section>
   <section className="panel">
    <div className="panel-head"><h2>Suggested tutors</h2></div>
    {!tutors.data?<p className="org-empty">Loading tutors…</p>
     :!tutors.data.items.length?<p className="org-empty">No tutors are available yet.</p>
     :tutors.data.items.slice(0,3).map(t=><Link className="tutor-mini" to={`/tutor/${t.id}`} key={t.id}><div className="avatar sm">{t.image}</div><span><strong>{t.name}</strong><small>{t.skills[0]??t.speciality} · ${t.price}/hour</small></span></Link>)}
   </section>
  </div>
 </DashboardShell>;
}

export function SessionRow({booking,primary=false,teaching=false}:{booking:Booking;primary?:boolean;teaching?:boolean}){
 const when=new Date(booking.startsAt);
 return <div className={primary?'next-card':'next-card muted'}>
  <div className="datebox"><b>{String(when.getDate()).padStart(2,'0')}</b><span>{when.toLocaleDateString('en',{month:'short'}).toUpperCase()}</span></div>
  <div>
   {primary&&<span className="eyebrow">{relativeTime(booking.startsAt).toUpperCase()}</span>}
   <h3>{booking.topic}</h3>
   <p>with {teaching?booking.learner.name:booking.tutor.name} · {when.toLocaleTimeString('en',{hour:'numeric',minute:'2-digit'})} · {booking.durationMinutes} min</p>
  </div>
  {primary&&<Link className="btn" to={`/lesson/${booking.id}/lobby`}>{teaching?'Start session':'Join session'}</Link>}
 </div>;
}

/** Booking needs a verified email, so the dashboard says so before a booking fails.
    The backend allows one link a minute; the button counts that minute down. */
function VerifyEmailNote({email}:{email:string}){
 const[message,setMessage]=useState('');
 const[sending,setSending]=useState(false);
 const[wait,setWait]=useState(0);
 useEffect(()=>{if(wait<=0)return;const timer=setTimeout(()=>setWait(wait-1),1000);return()=>clearTimeout(timer)},[wait]);
 const resend=async()=>{
  setSending(true);setMessage('');
  try{await authService.resendVerification();setMessage('We sent you a new link.');setWait(60)}
  catch(problem){setMessage(problem instanceof Error?problem.message:'The email could not be sent.')}
  finally{setSending(false)}
 };
 return <div className="verify-note">
  <Mail size={16}/>
  <span>Verify <strong>{email}</strong> to book sessions. {message}</span>
  <button type="button" className="text-link" onClick={resend} disabled={sending||wait>0}>{sending?'Sending…':wait>0?`Resend in ${wait}s`:'Resend link'}</button>
 </div>;
}
