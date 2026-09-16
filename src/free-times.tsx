import{Clock}from'lucide-react';
import{useLoader}from'./hooks/use-payments';
import{localTimezone,timezoneLabel}from'./data/locations';
import{scheduleService,type Busy}from'./services/schedule.service';

const FIRST_HOUR=7;
const LAST_START_HOUR=21;
const STEP_MINUTES=30;
// Leave enough notice for the tutor to see the booking.
const NOTICE_MINUTES=60;

export const timeLabel=(iso:string)=>new Date(iso).toLocaleTimeString('en',{hour:'numeric',minute:'2-digit'});

/** Start times on one day, every half hour, that do not overlap a session the tutor already has. */
function freeStarts(date:string,duration:number,busy:Busy[],ignoreStart?:string){
 const earliest=Date.now()+NOTICE_MINUTES*60000;
 const taken=busy.filter(b=>b.startsAt!==ignoreStart).map(b=>[new Date(b.startsAt).getTime(),new Date(b.endsAt).getTime()]);
 const starts:Date[]=[];
 for(let minutes=FIRST_HOUR*60;minutes<=LAST_START_HOUR*60;minutes+=STEP_MINUTES){
  const start=new Date(`${date}T00:00:00`);start.setMinutes(minutes);
  const from=start.getTime(),to=from+duration*60000;
  if(from<earliest)continue;
  if(taken.some(([busyFrom,busyTo])=>from<busyTo!&&to>busyFrom!))continue;
  starts.push(start);
 }
 return starts;
}

/** Picks a start time on a date. value and onChange use ISO instants. */
export function FreeTimes({tutorId,date,duration,value,onChange,ignoreStart}:{tutorId:string;date:string;duration:number;value:string;onChange:(iso:string)=>void;ignoreStart?:string}){
 const dayStart=new Date(`${date}T00:00:00`);const dayEnd=new Date(dayStart);dayEnd.setDate(dayEnd.getDate()+1);
 const busy=useLoader(()=>scheduleService.busy(tutorId,dayStart,dayEnd),[tutorId,date]);
 const starts=busy.data?freeStarts(date,duration,busy.data,ignoreStart):[];
 const groups:[string,Date[]][]=[['Morning',starts.filter(s=>s.getHours()<12)],['Afternoon',starts.filter(s=>s.getHours()>=12&&s.getHours()<17)],['Evening',starts.filter(s=>s.getHours()>=17)]];

 return <div className="time-selection">
  <div className="timezone-row"><Clock/><span><strong>Times shown in your timezone</strong>{timezoneLabel(localTimezone)}</span></div>
  {busy.error&&<p className="ledger-error">{busy.error}</p>}
  {busy.loading&&!busy.data?<p className="org-empty">Checking the tutor’s schedule…</p>
   :!starts.length?<p className="org-empty">No free times on this day. Try another date.</p>
   :groups.filter(([,times])=>times.length).map(([label,times])=><div className="time-group" key={label}><h3>{label}</h3><div>
     {times.map(start=><button type="button" className={value===start.toISOString()?'selected':''} onClick={()=>onChange(start.toISOString())} key={start.toISOString()}>{timeLabel(start.toISOString())}</button>)}
    </div></div>)}
 </div>;
}
