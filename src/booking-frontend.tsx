import {useMemo,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {ArrowLeft,ArrowRight,CalendarDays,Check,ChevronLeft,ChevronRight,Clock,Code2,CreditCard,MessageCircle,ShieldCheck,Sparkles} from 'lucide-react';
import {Stars} from './components';
import {tutors} from './data/mock';
import {useToast} from './ui-feedback';

type LessonType='TRIAL'|'REGULAR';
const TIMEZONE='Africa/Lagos';
const availableTimes=['9:00 AM','10:30 AM','1:00 PM','3:30 PM','5:00 PM','7:00 PM','8:30 PM'];
const dateKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const prettyDate=(value:string)=>new Intl.DateTimeFormat('en',{weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date(`${value}T12:00:00`));

export function FrontendBooking(){
  const{tutorId}=useParams();
  const tutor=tutors.find(item=>item.id===tutorId)||tutors[0];
  const[step,setStep]=useState(1);
  const[type,setTypeState]=useState<LessonType>('TRIAL');
  const[duration,setDuration]=useState<30|60>(30);
  const[selectedDate,setSelectedDate]=useState('2026-09-03');
  const[visibleMonth,setVisibleMonth]=useState(new Date(2026,8,1));
  const[time,setTime]=useState('3:30 PM');
  const[note,setNote]=useState('');
  const toast=useToast();
  const titles=['Choose a lesson type','Choose lesson duration','Select a date','Select an available time','Review your booking','Payment details','Your lesson is booked!'];
  const price=type==='TRIAL'?Math.round(tutor.price*.55):duration===30?Math.round(tutor.price/2):tutor.price;
  const setType=(value:LessonType)=>{setTypeState(value);if(value==='TRIAL')setDuration(30)};
  const goBack=()=>setStep(current=>Math.max(1,current-1));
  const goForward=()=>{if(step===6)toast('Booking created');setStep(current=>Math.min(7,current+1))};

  return <main className="booking-flow booking-seven">
    <Link to={`/tutor/${tutor.id}`} className="backlink"><ArrowLeft size={14}/> Back to {tutor.name}</Link>
    <div className="booking-steps" aria-label={`Booking step ${step} of 6`}>{[1,2,3,4,5,6,7].map(number=><div className={step>=number?'active':''} key={number}><b>{step>number?<Check/>:number}</b></div>)}</div>
    {step===7?<Confirmation tutor={tutor} duration={duration} type={type} date={selectedDate} time={time}/>:<div className={`booking-layout ${step===5?'review-step':''}`}>
      <section>
        <span className="eyebrow">STEP {step} OF 6</span>
        <h1>{titles[step-1]}</h1>
        {step===1&&<Choices value={type} onChange={value=>setType(value as LessonType)} items={[['TRIAL','Trial lesson','A 30-minute introduction to meet your tutor and align on your goals.'],['REGULAR','Regular lesson','Choose a focused 30-minute lesson or a deeper 60-minute session.']]}/>} 
        {step===2&&(type==='TRIAL'?<div className="trial-duration"><Sparkles/><div><strong>30-minute trial lesson</strong><p>Trial lessons have one fixed duration so you can meet your tutor and plan what comes next.</p></div><Check/></div>:<Choices value={String(duration)} onChange={value=>setDuration(Number(value) as 30|60)} items={[['30','30 minutes','A focused lesson for one topic or code review.'],['60','60 minutes','Deeper teaching, guided practice, and questions.']]}/>)}
        {step===3&&<BookingCalendar month={visibleMonth} selected={selectedDate} onMonthChange={setVisibleMonth} onSelect={setSelectedDate}/>} 
        {step===4&&<TimeSelection value={time} onChange={setTime}/>} 
        {step===5&&<div className="review-booking"><Summary tutor={tutor.name} type={type} duration={duration} date={selectedDate} time={time} price={price}/><label className="student-note">Anything your tutor should know?<textarea value={note} onChange={event=>setNote(event.target.value)} placeholder="Share your goals or what you’d like to work on…"/></label></div>} 
        {step===6&&<Checkout/>}
        <div className="flow-actions">{step>1&&<button className="btn ghost" onClick={goBack}>Back</button>}<button className="btn" onClick={goForward}>{step===6?`Confirm · $${price}`:'Continue'} <ArrowRight/></button></div>
      </section>
      <aside><TutorMini tutor={tutor}/><hr/>{step===5?<div className="review-total"><span>Total due</span><strong>${price}</strong><small>No charge is made in this frontend preview.</small></div>:<Summary tutor="" type={type} duration={duration} date={selectedDate} time={time} price={price}/>}</aside>
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
function Summary({tutor,type,duration,date,time,price}:{tutor:string;type:string;duration:number;date:string;time:string;price:number}){return <div className="booking-summary">{tutor&&<p><span>Tutor</span><strong>{tutor}</strong></p>}<p><span>Lesson</span><strong>{type==='TRIAL'?'Trial lesson':'Regular lesson'}</strong></p><p><span>Date and time</span><strong>{prettyDate(date)} · {time}</strong></p><p><span>Duration</span><strong>{duration} minutes</strong></p><p><span>Timezone</span><strong>{TIMEZONE}</strong></p><p className="total"><span>Total</span><strong>${price}</strong></p></div>}
function Checkout(){return <div className="checkout"><div className="saved-card selected"><CreditCard/><span><strong>Visa ending in 4242</strong><small>Expires 12/29</small></span><Check/></div><button type="button" className="add-payment">+ Add another payment method</button><label>Promo code<div><input placeholder="Enter code"/><button type="button">Apply</button></div></label><div className="secure-note"><ShieldCheck/> This is a frontend payment placeholder. No charge will be made.</div></div>}
function Confirmation({tutor,duration,type,date,time}:{tutor:typeof tutors[number];duration:number;type:string;date:string;time:string}){return <section className="booking-confirmation"><div className="success-icon"><Check/></div><span className="eyebrow">BOOKING CONFIRMED · CK-903184</span><h1>You’re all set!</h1><p>Your lesson with {tutor.name} has been added to your schedule.</p><div className="confirmation-card"><div className="avatar">{tutor.image}</div><div><h3>{tutor.name}</h3><p>{type==='TRIAL'?'Trial lesson':'Regular lesson'} · {duration} minutes</p><span><CalendarDays/> {prettyDate(date)}</span><span><Clock/> {time} · {TIMEZONE}</span></div></div><div className="confirmation-actions"><button className="btn"><CalendarDays/> Add to calendar</button><button className="btn ghost"><MessageCircle/> Message tutor</button><Link className="btn ghost" to="/student/lessons">Go to My Lessons</Link></div></section>}
