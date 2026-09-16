import {useMemo,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {ArrowLeft,ArrowRight,CalendarDays,Check,ChevronLeft,ChevronRight,Clock,Code2,Lock,MessageCircle,ShieldCheck,Sparkles,Wallet} from 'lucide-react';
import {Stars} from './components';
import {tutors} from './data/mock';
import {tutorService} from './services/tutor.service';
import {scheduleService} from './services/schedule.service';
import {useToast} from './ui-feedback';
import {useAuth} from './auth';
import {useLoader} from './hooks/use-payments';
import {ledgerService} from './services/ledger.service';
import {walletService} from './services/wallet.service';
import {formatMoney,prorate,toMinor} from './lib/money';
import type {CurrencyCode} from './types/payments';

type LessonType='TRIAL'|'REGULAR';
const TIMEZONE='Africa/Lagos';
/* Tutors list their rates in dollars, so a direct booking is a USD session and is escrowed from the
   learner's USD wallet. A learner paying in another currency books through a learning ad instead. */
const CURRENCY:CurrencyCode='USD';
const availableTimes=['9:00 AM','10:30 AM','1:00 PM','3:30 PM','5:00 PM','7:00 PM','8:30 PM'];
const dateKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const prettyDate=(value:string)=>new Intl.DateTimeFormat('en',{weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date(`${value}T12:00:00`));
/** '2026-09-03' + '3:30 PM' → an ISO instant, so the booked session can be scheduled and joined. */
const startInstant=(date:string,time:string)=>{
  const parts=/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim());
  if(!parts)return new Date(`${date}T12:00:00`).toISOString();
  const hour=Number(parts[1])%12+(parts[3]!.toUpperCase()==='PM'?12:0);
  return new Date(`${date}T${String(hour).padStart(2,'0')}:${parts[2]}:00`).toISOString();
};

export function FrontendBooking(){
  const{tutorId}=useParams();
  const loaded=useLoader(()=>tutorService.detail(tutorId??''),[tutorId]);
  const tutor=loaded.data??tutors.find(item=>item.id===tutorId)??tutors[0]!;
  const[step,setStep]=useState(1);
  const[type,setTypeState]=useState<LessonType>('TRIAL');
  const[duration,setDuration]=useState<30|60>(30);
  const[selectedDate,setSelectedDate]=useState(()=>dateKey(new Date(Date.now()+86400000)));
  const[visibleMonth,setVisibleMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const[time,setTime]=useState('3:30 PM');
  const[note,setNote]=useState('');
  const toast=useToast();
  const{user}=useAuth();
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState<string|null>(null);
  const titles=['Choose a lesson type','Choose lesson duration','Select a date','Select an available time','Review your booking','Payment details','Your lesson is booked!'];
  /* The tutor's listed price is an hourly rate. Everything downstream bills per minute, so the
     booking carries the rate and the scheduled duration rather than a fixed session price. */
  const hourlyRate=toMinor(type==='TRIAL'?tutor.price*.55:tutor.price,CURRENCY);
  const price=prorate(hourlyRate,duration);
  const payer={id:user?.id??'demo-student',name:user?`${user.firstName} ${user.lastName}`:'Alex Lee'};
  const setType=(value:LessonType)=>{setTypeState(value);if(value==='TRIAL')setDuration(30)};
  const goBack=()=>setStep(current=>Math.max(1,current-1));
  /* Confirming is what escrows the money: the full scheduled duration leaves the learner's
     available balance now, and whatever is not taught comes back when the session settles. */
  const confirm=async()=>{
    setBusy(true);
    setError(null);
    try{
      const topic=`${type==='TRIAL'?'Trial lesson':'Lesson'} with ${tutor.name}`;
      const startsAt=startInstant(selectedDate,time);
      // The backend reserves the time; offline it returns null and the demo ledger keeps its own id.
      const booking=await scheduleService.book({tutorId:tutor.id,skillCode:tutor.skillCodes?.[0],topic,notes:note,startsAt,durationMinutes:duration});
      await ledgerService.create({sessionId:booking?.id??`les-${Date.now().toString(36)}`,source:'DIRECT_BOOKING',payerId:payer.id,payerType:'USER',payerName:payer.name,payeeId:tutor.id,payeeName:tutor.name,topic,skill:tutor.skills[0]??tutor.speciality,startsAt,currency:CURRENCY,hourlyRate,scheduledMinutes:duration})
        .catch(async problem=>{if(booking)await scheduleService.cancel(booking.id,'Payment could not be held').catch(()=>{});throw problem});
      toast(`Booking created · ${formatMoney(price,CURRENCY)} held in escrow`);
      setStep(7);
    }catch(problem){setError(problem instanceof Error?problem.message:'The booking could not be created.')}
    finally{setBusy(false)}
  };
  const goForward=()=>{if(step===6){void confirm();return}setStep(current=>Math.min(7,current+1))};

  return <main className="booking-flow booking-seven">
    <Link to={`/tutor/${tutor.id}`} className="backlink"><ArrowLeft size={14}/> Back to {tutor.name}</Link>
    <div className="booking-steps" aria-label={`Booking step ${step} of 6`}>{[1,2,3,4,5,6,7].map(number=><div className={step>=number?'active':''} key={number}><b>{step>number?<Check/>:number}</b></div>)}</div>
    {step===7?<Confirmation tutor={tutor} duration={duration} type={type} date={selectedDate} time={time} held={price}/>:<div className={`booking-layout ${step===5?'review-step':''}`}>
      <section>
        <span className="eyebrow">STEP {step} OF 6</span>
        <h1>{titles[step-1]}</h1>
        {step===1&&<Choices value={type} onChange={value=>setType(value as LessonType)} items={[['TRIAL','Trial lesson','A 30-minute introduction to meet your tutor and align on your goals.'],['REGULAR','Regular lesson','Choose a focused 30-minute lesson or a deeper 60-minute session.']]}/>} 
        {step===2&&(type==='TRIAL'?<div className="trial-duration"><Sparkles/><div><strong>30-minute trial lesson</strong><p>Trial lessons have one fixed duration so you can meet your tutor and plan what comes next.</p></div><Check/></div>:<Choices value={String(duration)} onChange={value=>setDuration(Number(value) as 30|60)} items={[['30','30 minutes','A focused lesson for one topic or code review.'],['60','60 minutes','Deeper teaching, guided practice, and questions.']]}/>)}
        {step===3&&<BookingCalendar month={visibleMonth} selected={selectedDate} onMonthChange={setVisibleMonth} onSelect={setSelectedDate}/>} 
        {step===4&&<TimeSelection value={time} onChange={setTime}/>} 
        {step===5&&<div className="review-booking"><Summary tutor={tutor.name} type={type} duration={duration} date={selectedDate} time={time} price={price} rate={hourlyRate}/><label className="student-note">Anything your tutor should know?<textarea value={note} onChange={event=>setNote(event.target.value)} placeholder="Share your goals or what you’d like to work on…"/></label></div>} 
        {step===6&&<Checkout payerId={payer.id} cost={price} hourlyRate={hourlyRate} minutes={duration} error={error}/>}
        <div className="flow-actions">{step>1&&<button className="btn ghost" onClick={goBack}>Back</button>}<button className="btn" onClick={goForward} disabled={busy}>{step===6?(busy?'Holding funds…':`Confirm · ${formatMoney(price,CURRENCY)}`):'Continue'} <ArrowRight/></button></div>
      </section>
      <aside><TutorMini tutor={tutor}/><hr/>{step===5?<div className="review-total"><span>Held at booking</span><strong>{formatMoney(price,CURRENCY)}</strong><small>You are billed for the minutes actually taught; the rest is returned.</small></div>:<Summary tutor="" type={type} duration={duration} date={selectedDate} time={time} price={price} rate={hourlyRate}/>}</aside>
    </div>}
  </main>;
}

function BookingCalendar({month,selected,onMonthChange,onSelect}:{month:Date;selected:string;onMonthChange:(date:Date)=>void;onSelect:(value:string)=>void}){
  const days=useMemo(()=>{const year=month.getFullYear();const monthIndex=month.getMonth();const firstDay=new Date(year,monthIndex,1).getDay();const count=new Date(year,monthIndex+1,0).getDate();return [...Array(firstDay).fill(null),...Array.from({length:count},(_,index)=>new Date(year,monthIndex,index+1))]},[month]);
  const change=(offset:number)=>onMonthChange(new Date(month.getFullYear(),month.getMonth()+offset,1));
  return <section className="full-calendar" aria-label="Choose a lesson date"><header><button type="button" onClick={()=>change(-1)} aria-label="Previous month"><ChevronLeft/></button><strong>{month.toLocaleDateString('en',{month:'long',year:'numeric'})}</strong><button type="button" onClick={()=>change(1)} aria-label="Next month"><ChevronRight/></button></header><div className="calendar-weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=><span key={day}>{day}</span>)}</div><div className="calendar-grid">{days.map((date,index)=>date===null?<span key={`empty-${index}`}/>:<button type="button" key={dateKey(date)} className={selected===dateKey(date)?'selected':''} onClick={()=>onSelect(dateKey(date))} aria-pressed={selected===dateKey(date)}><span>{date.getDate()}</span><i aria-hidden="true"/></button>)}</div><p className="availability-hint"><Check/> Available dates are marked in green.</p></section>;
}

function TimeSelection({value,onChange}:{value:string;onChange:(value:string)=>void}){return <div className="time-selection"><div className="timezone-row"><Clock/><span><strong>Your timezone</strong>{TIMEZONE} (GMT+1)</span><span><strong>Tutor timezone</strong>America/Toronto (GMT-4)</span></div>{[['Morning',availableTimes.slice(0,2)],['Afternoon',availableTimes.slice(2,5)],['Evening',availableTimes.slice(5)]].map(([label,times])=><div className="time-group" key={label as string}><h3>{label as string}</h3><div>{(times as string[]).map(item=><button type="button" className={value===item?'selected':''} onClick={()=>onChange(item)} key={item}>{item}</button>)}</div></div>)}</div>}
function Choices({value,onChange,items}:{value:string;onChange:(value:string)=>void;items:string[][]}){return <div className="lesson-types">{items.map((item,index)=><button type="button" className={value===item[0]?'selected':''} onClick={()=>onChange(item[0]!)} key={item[0]}><span>{index?<Code2/>:<Sparkles/>}<strong>{item[1]}</strong></span><p>{item[2]}</p></button>)}</div>}
function TutorMini({tutor}:{tutor:typeof tutors[number]}){return <div className="tutor-mini"><div className="avatar">{tutor.image}</div><span><strong>{tutor.name}</strong><small>{tutor.headline}</small><Stars rating={tutor.rating}/></span></div>}
function Summary({tutor,type,duration,date,time,price,rate}:{tutor:string;type:string;duration:number;date:string;time:string;price:number;rate:number}){return <div className="booking-summary">{tutor&&<p><span>Tutor</span><strong>{tutor}</strong></p>}<p><span>Lesson</span><strong>{type==='TRIAL'?'Trial lesson':'Regular lesson'}</strong></p><p><span>Date and time</span><strong>{prettyDate(date)} · {time}</strong></p><p><span>Duration</span><strong>{duration} minutes</strong></p><p><span>Rate</span><strong>{formatMoney(rate,CURRENCY)} / hour</strong></p><p><span>Timezone</span><strong>{TIMEZONE}</strong></p><p className="total"><span>Held at booking</span><strong>{formatMoney(price,CURRENCY)}</strong></p></div>}
function Checkout({payerId,cost,hourlyRate,minutes,error}:{payerId:string;cost:number;hourlyRate:number;minutes:number;error:string|null}){
  const wallets=useLoader(()=>walletService.list(payerId),[payerId]);
  const wallet=wallets.data?.find(item=>item.currency===CURRENCY);
  const short=Boolean(wallet)&&wallet!.available<cost;
  return <div className="checkout">
    <div className={short?'wallet-pay short':'wallet-pay'}>
      <Wallet/>
      <span>
        <strong>{CURRENCY} wallet</strong>
        <small>{wallets.loading&&!wallet?'Checking your balance…':wallet?`${formatMoney(wallet.available,CURRENCY)} available${wallet.reserved>0?` · ${formatMoney(wallet.reserved,CURRENCY)} already in escrow`:''}`:`No ${CURRENCY} wallet yet — add one from your wallet page.`}</small>
      </span>
      {!short&&wallet&&<Check/>}
    </div>
    <div className="escrow-breakdown">
      <p><span>{formatMoney(hourlyRate,CURRENCY)} per hour × {minutes} minutes</span><strong>{formatMoney(cost,CURRENCY)}</strong></p>
      <p><span>Held now, released as you are taught</span><strong>{formatMoney(cost,CURRENCY)}</strong></p>
      {wallet&&<p className="after"><span>Available afterwards</span><strong>{formatMoney(Math.max(0,wallet.available-cost),CURRENCY)}</strong></p>}
    </div>
    {short&&<p className="ledger-error">Your {CURRENCY} balance does not cover this session. Top up your wallet and try again.</p>}
    {error&&<p className="ledger-error">{error}</p>}
    <div className="secure-note"><Lock/> Money is held in escrow, not paid out. You are billed only for the minutes taught, and the tutor is paid 24 hours after the session unless you appeal.</div>
    <div className="secure-note"><ShieldCheck/> Card and bank top-ups are handled by your wallet, so no card details pass through a booking.</div>
  </div>;
}
function Confirmation({tutor,duration,type,date,time,held}:{tutor:typeof tutors[number];duration:number;type:string;date:string;time:string;held:number}){return <section className="booking-confirmation"><div className="success-icon"><Check/></div><span className="eyebrow">BOOKING CONFIRMED · CK-903184</span><h1>You’re all set!</h1><p>Your lesson with {tutor.name} has been added to your schedule.</p><div className="confirmation-card"><div className="avatar">{tutor.image}</div><div><h3>{tutor.name}</h3><p>{type==='TRIAL'?'Trial lesson':'Regular lesson'} · {duration} minutes</p><span><CalendarDays/> {prettyDate(date)}</span><span><Clock/> {time} · {TIMEZONE}</span></div></div><p className="escrow-note"><Lock size={14}/> {formatMoney(held,CURRENCY)} is held in escrow. You are billed for the minutes taught and the balance returns to your wallet.</p><div className="confirmation-actions"><button className="btn"><CalendarDays/> Add to calendar</button><button className="btn ghost"><MessageCircle/> Message tutor</button><Link className="btn ghost" to="/student/lessons">Go to My Lessons</Link></div></section>}
