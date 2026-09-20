import{useState}from'react';
import{Link}from'react-router-dom';
import{ArrowRight,Building2,CalendarDays,Clock,Star,Users,Video}from'lucide-react';
import{DashboardShell,StatCard}from'./components';
import{useAuth}from'./auth';
import{useLoader}from'./hooks/use-payments';
import{scheduleService,endsAt,type Booking}from'./services/schedule.service';
import{tutorService}from'./services/tutor.service';
import{orgService}from'./services/org.service';
import{useToast}from'./ui-feedback';
import{Dialog}from'./lessons-page';
import{SessionRow}from'./student-dashboard';
import{STATUS_NOTE}from'./settings-page';
import{relativeTime}from'./lib/money';

const startOfMonth=(date:Date)=>new Date(date.getFullYear(),date.getMonth(),1);
const addMonths=(date:Date,months:number)=>new Date(date.getFullYear(),date.getMonth()+months,1);
const timeOf=(iso:string)=>new Date(iso).toLocaleTimeString('en',{hour:'numeric',minute:'2-digit'});

/** What the dashboard shows, worked out from this month's and next month's bookings. */
function summarise(bookings:Booking[],now=new Date()){
 const live=bookings.filter(b=>b.status!=='cancelled');
 const taught=live.filter(b=>new Date(b.startsAt)<addMonths(now,1)&&endsAt(b)<=now.getTime());
 return{
  today:live.filter(b=>new Date(b.startsAt).toDateString()===now.toDateString()),
  upcoming:live.filter(b=>b.status==='scheduled'&&endsAt(b)>now.getTime()),
  hours:taught.reduce((sum,b)=>sum+b.durationMinutes,0)/60,
 };
}

export const initials=(name:string)=>name.split(' ').map(part=>part[0]).join('').slice(0,2).toUpperCase();
const greeting=(hour=new Date().getHours())=>hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';

/** Shown to a trainer: their sessions are paid into their organisation's wallet, not their own. */
function TrainerBanner(){
 const toast=useToast();
 const org=useLoader(()=>orgService.mine(),[]);
 const[leaving,setLeaving]=useState(false);
 const[busy,setBusy]=useState(false);
 if(!org.data||org.data.role!=='trainer')return null;

 const leave=async()=>{
  setBusy(true);
  try{await orgService.leave();toast(`You no longer teach under ${org.data?.name}`);await org.reload()}
  catch(problem){toast(problem instanceof Error?problem.message:'That did not work. Try again.')}
  finally{setBusy(false);setLeaving(false)}
 };

 return <div className="trainer-banner">
  <Building2 size={16}/>
  <p>You teach under <strong>{org.data.name}</strong>. Sessions you teach are paid into their wallet, not yours.</p>
  <button type="button" className="text-danger" onClick={()=>setLeaving(true)}>Leave</button>
  {leaving&&<Dialog title={`Leave ${org.data.name}?`} text="Sessions you have already taught stay with them. Anything you teach afterwards is paid into your own wallet." onClose={()=>setLeaving(false)}>
   <div className="dialog-actions">
    <button className="btn ghost" onClick={()=>setLeaving(false)}>Stay</button>
    <button className="btn danger" disabled={busy} onClick={leave}>{busy?'Leaving…':'Leave the organisation'}</button>
   </div>
  </Dialog>}
 </div>;
}

export function TutorDashboard(){
 const{user}=useAuth();
 const month=startOfMonth(new Date());
 const bookings=useLoader(()=>scheduleService.range(month,addMonths(month,2)),[user?.id]);
 const students=useLoader(()=>scheduleService.students('active'),[user?.id]);
 const profile=useLoader(()=>tutorService.myProfile(),[user?.id]);
 const summary=summarise(bookings.data??[]);
 const[next,following]=summary.upcoming;
 const laterToday=summary.today.find(b=>endsAt(b)>Date.now());
 const status=profile.data?.status??'draft';

 return <DashboardShell role="tutor">
  <TrainerBanner/>
  <div className="dash-welcome">
   <div><h1>{greeting()}{user?`, ${user.firstName}`:''}</h1><p>{summary.today.length?`You have ${summary.today.length} session${summary.today.length===1?'':'s'} today.`:'No sessions today.'}</p></div>
   <Link className="btn" to="/tutor/calendar"><CalendarDays size={16}/> Open calendar</Link>
  </div>
  <div className="stats-grid">
   <StatCard label="Today's sessions" value={String(summary.today.length)} trend={laterToday?`Next at ${timeOf(laterToday.startsAt)}`:'None left today'} icon={<CalendarDays/>}/>
   <StatCard label="Upcoming sessions" value={String(summary.upcoming.length)} trend="This month and next" icon={<Video/>}/>
   <StatCard label="Active students" value={String(students.data?.active??0)} trend="With a session booked" icon={<Users/>}/>
   <StatCard label="Hours taught" value={summary.hours.toFixed(1)} trend="This month" icon={<Clock/>}/>
   <StatCard label="Rating" value={profile.data?.reviewCount?profile.data.rating.toFixed(1):'—'} trend={profile.data?.reviewCount?`From ${profile.data.reviewCount} review${profile.data.reviewCount===1?'':'s'}`:'No reviews yet'} icon={<Star/>}/>
  </div>
  <div className="dash-grid">
   <section className="panel next">
    <div className="panel-head"><h2>Next session to teach</h2><Link className="text-link" to="/tutor/lessons">View all</Link></div>
    {bookings.error&&<p className="ledger-error">{bookings.error}</p>}
    {!next?<p className="org-empty">{bookings.loading?'Loading your schedule…':'No sessions booked with you yet.'}</p>
     :<SessionRow booking={next} primary teaching/>}
    {following&&<SessionRow booking={following} teaching/>}
   </section>
   <section className="panel">
    <div className="panel-head"><h2>Today</h2></div>
    {!summary.today.length?<p className="org-empty">{bookings.loading?'Loading…':'Nothing on your calendar today.'}</p>
     :<div className="today-list">{summary.today.map(b=><div key={b.id}>
      <strong>{timeOf(b.startsAt)}</strong>
      <span>{b.topic}<small>with {b.learner.name} · {b.durationMinutes} min</small></span>
      {endsAt(b)<=Date.now()&&<small>Done</small>}
     </div>)}</div>}
   </section>
   <section className="panel">
    <div className="panel-head"><h2>Active students</h2><Link className="text-link" to="/tutor/students">View all</Link></div>
    {students.error&&<p className="ledger-error">{students.error}</p>}
    {!students.data?<p className="org-empty">Loading students…</p>
     :!students.data.items.length?<p className="org-empty">Learners with a session booked will appear here.</p>
     :students.data.items.slice(0,3).map(s=><div className="tutor-mini" key={s.id}>
      <div className="avatar sm">{initials(s.name)}</div>
      <span><strong>{s.name}</strong><small>{s.nextAt?`Next session ${relativeTime(s.nextAt)}`:''}</small></span>
     </div>)}
   </section>
   <section className="panel">
    <div className="panel-head"><h2>Your profile</h2>{!profile.loading&&<span className={`status ${status}`}>{status.toUpperCase()}</span>}</div>
    {profile.loading?<p className="org-empty">Loading your profile…</p>:<p className="org-empty">{STATUS_NOTE[status]}</p>}
    {!profile.loading&&(status==='approved'&&user
     ?<Link className="text-link" to={`/tutor/${user.id}`}>See your public profile <ArrowRight/></Link>
     :<Link className="text-link" to="/tutor/settings">Edit your profile <ArrowRight/></Link>)}
   </section>
  </div>
 </DashboardShell>;
}
