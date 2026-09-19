import{useState}from'react';
import{Link}from'react-router-dom';
import{CalendarRange}from'lucide-react';
import{useToast}from'./ui-feedback';
import{useLoader}from'./hooks/use-payments';
import{DAYS,countSessions,seriesService,type Series}from'./services/series.service';
import{walletService}from'./services/wallet.service';
import{formatMoney}from'./lib/money';

type Role='student'|'tutor';
const errorOf=(problem:unknown,fallback:string)=>problem instanceof Error?problem.message:fallback;
const dateOf=(iso:string)=>new Date(`${iso}T00:00:00`).toLocaleDateString('en',{day:'numeric',month:'short'});
const hours=(minutes:number)=>minutes%60?`${minutes} minutes`:`${minutes/60} hour${minutes===60?'':'s'}`;

// The timetable draws the day from 6am to 10pm; a session outside that is pinned to the edge.
const DAY_FROM=6,DAY_HOURS=16;

/** A week at a glance: each chosen day carries a bar at the session's time of day. */
function WeekStrip({weekdays,startTime,durationMinutes}:{weekdays:number[];startTime:string;durationMinutes:number}){
 const[h,m]=startTime.split(':').map(Number);
 const top=Math.min(Math.max(((h??0)+(m??0)/60-DAY_FROM)/DAY_HOURS,0),0.95);
 const height=Math.min(durationMinutes/60/DAY_HOURS,1-top);
 // Monday first, the way a timetable is read.
 const order=[1,2,3,4,5,6,0];
 return <span className="week-strip" aria-hidden="true">
  {order.map(day=><span key={day} className={weekdays.includes(day)?'on':''}>
   <i>{weekdays.includes(day)&&<b style={{top:`${top*100}%`,height:`${Math.max(height*100,8)}%`}}/>}</i>
   <small>{DAYS[day]![0]}</small>
  </span>)}
 </span>;
}

/** The schedules on the lessons page: proposals to answer, and series in progress. */
export function SchedulesPanel({role,onChange}:{role:Role;onChange?:()=>void}){
 const series=useLoader(()=>seriesService.list(),[]);
 const wallets=useLoader(()=>role==='student'?walletService.list():Promise.resolve([]),[role]);
 const items=series.data??[];
 if(!items.length)return null;
 const refresh=async()=>{await series.reload();onChange?.()};
 return <section className="schedules">
  <h2><CalendarRange size={16}/> Schedules</h2>
  {series.error&&<p className="ledger-error">{series.error}</p>}
  {items.map(item=><ScheduleRow key={item.id} series={item} role={role} onChange={refresh}
   balance={(wallets.data??[]).find(w=>w.currency===item.currency)?.available??0}/>)}
 </section>;
}

function ScheduleRow({series,role,balance,onChange}:{series:Series;role:Role;balance:number;onChange:()=>Promise<void>}){
 const toast=useToast();
 const[busy,setBusy]=useState<string|null>(null);
 const[error,setError]=useState<string|null>(null);
 const other=role==='student'?series.tutor:series.learner;
 const days=series.weekdays.map(day=>DAYS[day]).join(', ');
 const cost=formatMoney(series.sessionCost,series.currency);
 const covers=series.sessionCost>0?Math.floor(balance/series.sessionCost):Infinity;

 const act=async(key:string,run:()=>Promise<unknown>,done:string)=>{
  setBusy(key);setError(null);
  try{await run();toast(done);await onChange()}
  catch(problem){setError(errorOf(problem,'That did not work. Try again.'))}
  finally{setBusy(null)}
 };

 return <article className={`schedule state-${series.status}`}>
  <WeekStrip weekdays={series.weekdays} startTime={series.startTime} durationMinutes={series.durationMinutes}/>
  <div className="schedule-copy">
   <small>{series.status==='proposed'?(role==='student'?`PROPOSED BY ${other.name.toUpperCase()}`:`WAITING FOR ${other.name.toUpperCase()}`):`WITH ${other.name.toUpperCase()}`}</small>
   <strong>{series.topic}</strong>
   <p>{days} at {series.startTime} ({series.timezone}) · {hours(series.durationMinutes)} · {dateOf(series.startsOn)} to {dateOf(series.endsOn)}</p>
   <p>{series.status==='proposed'?`${series.sessions} sessions`:`${series.done} done · ${series.ahead} ahead`} · {cost} a session, paid when it opens</p>
   {role==='student'&&series.sessionCost>0&&<p className={covers<1?'schedule-warn':'schedule-note'}>
    {covers<1?<>Your balance does not cover a session. Sessions will not open until you <Link to="/student/wallet">top up</Link>.</>
     :`Your balance covers ${covers===Infinity?'every':covers} session${covers===1?'':'s'} right now.`}</p>}
   {error&&<p className="ledger-error">{error}</p>}
  </div>
  <div className="schedule-actions">
   {series.status==='proposed'&&role==='student'&&<>
    <button className="btn" disabled={Boolean(busy)} onClick={()=>act('accept',()=>seriesService.accept(series.id),'Schedule accepted — every session is booked')}>{busy==='accept'?'Booking…':'Accept'}</button>
    <button className="btn ghost" disabled={Boolean(busy)} onClick={()=>act('decline',()=>seriesService.decline(series.id),'Schedule declined')}>Decline</button></>}
   {series.status==='proposed'&&role==='tutor'&&
    <button className="btn ghost" disabled={Boolean(busy)} onClick={()=>act('cancel',()=>seriesService.cancel(series.id),'Proposal withdrawn')}>Withdraw</button>}
   {series.status==='accepted'&&
    <button className="text-danger" disabled={Boolean(busy)} onClick={()=>act('cancel',()=>seriesService.cancel(series.id),'The rest of the schedule is cancelled')}>Cancel the rest</button>}
  </div>
 </article>;
}

const today=()=>new Date().toISOString().slice(0,10);

/** A tutor proposing a standing schedule to one learner. Nothing is booked until they accept. */
export function ProposeSchedule({learner,onDone}:{learner:{id:string;name:string};onDone:()=>void}){
 const toast=useToast();
 const[topic,setTopic]=useState('');
 const[weekdays,setWeekdays]=useState<number[]>([]);
 const[startTime,setStartTime]=useState('08:00');
 const[duration,setDuration]=useState(60);
 const[startsOn,setStartsOn]=useState('');
 const[endsOn,setEndsOn]=useState('');
 const[notes,setNotes]=useState('');
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);
 const count=countSessions(weekdays,startsOn,endsOn);
 const toggle=(day:number)=>setWeekdays(current=>current.includes(day)?current.filter(d=>d!==day):[...current,day]);

 const send=async(event:React.FormEvent)=>{
  event.preventDefault();
  setBusy(true);setError(null);
  try{
   await seriesService.propose({learnerId:learner.id,skillCode:'',topic,notes,weekdays,startTime,durationMinutes:duration,startsOn,endsOn});
   toast(`Schedule sent to ${learner.name.split(' ')[0]}`);
   onDone();
  }catch(problem){setError(errorOf(problem,'That schedule could not be sent.'))}
  finally{setBusy(false)}
 };

 return <form className="sheet-form schedule-form" onSubmit={send}>
  <label>Topic<input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="React bootcamp"/></label>
  <fieldset className="day-picker"><legend>Days</legend>
   {[1,2,3,4,5,6,0].map(day=><button type="button" key={day} className={weekdays.includes(day)?'on':''} aria-pressed={weekdays.includes(day)} onClick={()=>toggle(day)}>{DAYS[day]}</button>)}
  </fieldset>
  <div className="schedule-grid">
   <label>Starts at<input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)}/></label>
   <label>Each session<select value={duration} onChange={e=>setDuration(Number(e.target.value))}>
    {[30,60,90,120,180,240].map(m=><option key={m} value={m}>{hours(m)}</option>)}</select></label>
   <label>From<input type="date" min={today()} value={startsOn} onChange={e=>setStartsOn(e.target.value)}/></label>
   <label>Until<input type="date" min={startsOn||today()} value={endsOn} onChange={e=>setEndsOn(e.target.value)}/></label>
  </div>
  <label>Notes <span>optional</span><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="What the weeks will cover"/></label>
  {weekdays.length>0&&<div className="schedule-preview">
   <WeekStrip weekdays={weekdays} startTime={startTime||'08:00'} durationMinutes={duration}/>
   <span>{count} session{count===1?'':'s'}, in your timezone. {learner.name.split(' ')[0]} pays for each one at your regular rate when it opens.</span>
  </div>}
  {error&&<p className="ledger-error">{error}</p>}
  <button className="btn" disabled={busy}>{busy?'Sending…':'Send the schedule'}</button>
 </form>;
}
