import{useEffect,useMemo,useState}from'react';import{Link,useLocation,useNavigate}from'react-router-dom';import{BookOpen,CalendarDays,Check,ChevronLeft,ChevronRight,Clock,Code2,CreditCard,Filter,MessageCircle,Plus,Search}from'lucide-react';import{DashboardShell,SkillBadge,Stars}from'./components';import{useToast}from'./ui-feedback';import{adminUiService,assignmentService}from'./services/workspace.service';import type{Assignment,ManagedUser}from'./types/product';
import{notificationService,type AppNotification,type Inbox,type NotificationKind}from'./services/notification.service';
import{scheduleService,type Booking}from'./services/schedule.service';
import{localTimezone,timezoneLabel}from'./data/locations';
import{relativeTime}from'./lib/money';
const Loading=()=> <div className="workspace-skeleton">{[1,2,3].map(i=><i key={i}/>)}</div>;const Empty=({title,text}:{title:string;text:string})=><div className="workspace-empty"><BookOpen/><h3>{title}</h3><p>{text}</p></div>;
export function StudentTutors(){return <DashboardShell role="student"><PageTitle title="My tutors" text="People helping you make consistent progress." action="Find another tutor"/><Tabs items={['CURRENT','PREVIOUS','FAVOURITES']} active="CURRENT" onChange={()=>{}}/><div className="relationship-grid">{[['maya-chen','MC','Maya Chen','React · 12 lessons','Next: Sep 3, 3:30 PM'],['david-okafor','DO','David Okafor','Python · 6 lessons','Next: Sep 8, 10:00 AM'],['aisha-khan','AK','Aisha Khan','React Native · 3 lessons','No lesson booked']].map(t=><article key={t[2]}><div className="relationship-head"><div className="avatar">{t[1]}</div><Stars rating={4.9}/></div><h3>{t[2]}</h3><p>{t[3]}</p><small>{t[4]}</small><div className="relationship-actions"><Link className="btn" to="/student/messages"><MessageCircle/> Message</Link><Link className="btn ghost" to={`/booking/${t[0]}`}>Book again</Link></div></article>)}</div></DashboardShell>}
const KIND_TAB:Record<string,NotificationKind>={LESSONS:'lesson',MESSAGES:'message'};
const kindIcon=(kind:NotificationKind)=>kind==='lesson'?<CalendarDays/>:kind==='message'?<MessageCircle/>:kind==='payment'?<CreditCard/>:kind==='approval'?<Check/>:<BookOpen/>;
export function NotificationsPage({role}:{role:'student'|'tutor'}){
 const[inbox,setInbox]=useState<Inbox|null>(null);
 const[filter,setFilter]=useState('ALL');
 const toast=useToast();
 const navigate=useNavigate();
 const load=()=>notificationService.inbox().then(setInbox).catch(()=>setInbox({items:[],unread:0}));
 useEffect(()=>{load()},[]);
 const markAll=()=>notificationService.markAllRead().then(load).then(()=>toast('All notifications marked as read'));
 const open=(n:AppNotification)=>{if(!n.read)notificationService.markRead(n.id).then(load);if(n.link)navigate(n.link)};
 const shown=inbox?.items.filter(n=>filter==='ALL'||(filter==='UNREAD'?!n.read:n.kind===KIND_TAB[filter]))??[];
 return <DashboardShell role={role}>
  <PageTitle title="Notifications" text="Stay current on lessons, assignments, messages, and account activity."/>
  <div className="notification-toolbar"><Tabs items={['ALL','UNREAD','LESSONS','MESSAGES']} active={filter} onChange={setFilter}/>{Boolean(inbox?.unread)&&<button className="text-link" onClick={markAll}>Mark all as read</button>}</div>
  {!inbox?<Loading/>:!shown.length?<Empty title="Nothing here yet" text="Updates about your lessons and account will appear here."/>
   :<div className="notifications-list">{shown.map(n=><article className={n.read?'':'unread'} key={n.id} role="button" tabIndex={0} onClick={()=>open(n)} onKeyDown={e=>{if(e.key==='Enter')open(n)}}><div className="notification-icon">{kindIcon(n.kind)}</div><div><strong>{n.title}</strong><p>{n.body}</p><small>{relativeTime(n.createdAt)}</small></div>{!n.read&&<i/>}</article>)}</div>}
 </DashboardShell>;
}
export function AssignmentsPage({role}:{role:'student'|'tutor'}){const[data,setData]=useState<Assignment[]|null>(null);const toast=useToast();useEffect(()=>{assignmentService.list().then(setData)},[]);return <DashboardShell role={role}><PageTitle title="Assignments" text={role==='student'?'Submit project work and review tutor feedback.':'Create work, review submissions, and help students improve.'} action={role==='tutor'?'Create assignment':undefined}/><Tabs items={role==='student'?['PENDING','SUBMITTED','REVIEWED']:['ACTIVE','SUBMISSIONS','REVIEWED']} active={role==='student'?'PENDING':'ACTIVE'} onChange={()=>{}}/>{!data?<Loading/>:<div className="assignment-grid">{data.map(a=>{const dueDate=new Date(`${a.dueDate}T12:00:00`);return <article className="assignment-card" key={a.id}><div className="assignment-card-copy"><span className={`status ${a.status.toLowerCase()}`}>{a.status}</span><h3>{a.title}</h3><p>{a.description}</p></div><div className="assignment-card-meta"><span><strong>{role==='student'?'Tutor':'Student'}</strong>{role==='student'?a.tutorName:a.studentName}</span><span><strong>Due date</strong><CalendarDays/>{dueDate.toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'})}</span></div><button className="btn ghost" onClick={()=>toast(role==='student'?'Submission editor opened':'Assignment editor opened')}>{role==='student'?'Open assignment':'Review details'}</button></article>})}</div>}</DashboardShell>}
const HOUR_PX=41;const FIRST_HOUR=8;
// Places a session on its day column: the grid starts at 8 AM, with 82px for every 2 hours.
const slotStyle=(b:Booking)=>{const start=new Date(b.startsAt);const hours=start.getHours()+start.getMinutes()/60-FIRST_HOUR;return{top:`${44+Math.max(0,hours)*HOUR_PX}px`,height:`${Math.max(28,b.durationMinutes/60*HOUR_PX)}px`}};
const timeOf=(iso:string)=>new Date(iso).toLocaleTimeString('en',{hour:'numeric',minute:'2-digit'});
export function TutorCalendar(){
 const[view,setView]=useState('WEEK');
 const[anchor,setAnchor]=useState(()=>new Date());
 const[bookings,setBookings]=useState<Booking[]|null>(null);
 const[error,setError]=useState('');
 const weekStart=useMemo(()=>{const date=new Date(anchor);const offset=(date.getDay()+6)%7;date.setDate(date.getDate()-offset);date.setHours(0,0,0,0);return date},[anchor]);
 const days=useMemo(()=>Array.from({length:7},(_,index)=>{const date=new Date(weekStart);date.setDate(weekStart.getDate()+index);return date}),[weekStart]);
 useEffect(()=>{
  let live=true;const end=new Date(weekStart);end.setDate(end.getDate()+7);
  setBookings(null);setError('');
  scheduleService.range(weekStart,end).then(items=>{if(live)setBookings(items)}).catch(e=>{if(live){setBookings([]);setError(e instanceof Error?e.message:'Could not load your calendar')}});
  return()=>{live=false};
 },[weekStart]);
 const sameDay=(left:Date,right:Date)=>left.toDateString()===right.toDateString();
 const start=days[0]!;const end=days[days.length-1]!;const startMonth=start.toLocaleDateString('en',{month:'long'});const endMonth=end.toLocaleDateString('en',{month:'long'});
 const rangeLabel=startMonth===endMonth?`${startMonth} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`:`${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
 const monthLabel=anchor.toLocaleDateString('en',{month:'long',year:'numeric'});
 const monthDays=useMemo(()=>{const first=new Date(anchor.getFullYear(),anchor.getMonth(),1);const last=new Date(anchor.getFullYear(),anchor.getMonth()+1,0);const leading=(first.getDay()+6)%7;return [...Array.from({length:leading},()=>null),...Array.from({length:last.getDate()},(_,index)=>index+1)]},[anchor]);
 const moveWeek=(amount:number)=>setAnchor(current=>{const next=new Date(current);next.setDate(next.getDate()+amount*7);return next});
 const upcoming=(bookings??[]).filter(b=>b.status==='scheduled'&&new Date(b.startsAt).getTime()+b.durationMinutes*60000>Date.now());
 return <DashboardShell role="tutor">
  <div className="tutor-calendar-page">
   <PageTitle title="Calendar" text="Every session learners have booked with you, week by week."/>
   <div className="calendar-dashboard">
    <section className="calendar-board">
     <div className="calendar-toolbar"><Tabs items={['DAY','WEEK','MONTH']} active={view} onChange={setView}/><span className="calendar-period">{rangeLabel}</span><div className="calendar-nav"><button type="button" aria-label="Previous week" onClick={()=>moveWeek(-1)}><ChevronLeft/></button><button type="button" onClick={()=>setAnchor(new Date())}>Today</button><button type="button" aria-label="Next week" onClick={()=>moveWeek(1)}><ChevronRight/></button></div></div>
     <div className="calendar-context"><span><Clock/> {timezoneLabel(localTimezone)}</span><div><i className="lesson-dot"/>Session</div></div>
     {error&&<p className="ledger-error">{error}</p>}
     <div className="week-calendar"><div className="time-axis">{['8 AM','10 AM','12 PM','2 PM','4 PM','6 PM'].map(x=><span key={x}>{x}</span>)}</div>{days.map(day=><div className={sameDay(day,new Date())?'calendar-day today':'calendar-day'} key={day.toISOString()}><strong><span>{day.toLocaleDateString('en',{weekday:'short'})}</span><b>{day.getDate()}</b></strong>{(bookings??[]).filter(b=>sameDay(new Date(b.startsAt),day)).map((b,i)=><Link className={`booked${i%2?' amber':''}${b.status==='cancelled'?' cancelled':''}`} style={slotStyle(b)} to={`/lesson/${b.id}/lobby`} key={b.id}><small>{b.status==='cancelled'?'CANCELLED':'SESSION'} · {timeOf(b.startsAt)}</small>{b.topic}<span>{b.learner.name}</span></Link>)}</div>)}</div>
    </section>
    <aside className="calendar-insights">
     <section className="mini-calendar"><header><div><span>Month overview</span><strong>{monthLabel}</strong></div><CalendarDays/></header><div className="mini-weekdays">{['M','T','W','T','F','S','S'].map((label,index)=><span key={`${label}-${index}`}>{label}</span>)}</div><div className="mini-days">{monthDays.map((date,index)=><button type="button" disabled={!date} className={date&&sameDay(new Date(anchor.getFullYear(),anchor.getMonth(),date),anchor)?'selected':''} onClick={()=>date&&setAnchor(new Date(anchor.getFullYear(),anchor.getMonth(),date))} key={`${date}-${index}`}>{date}</button>)}</div></section>
     <section className="upcoming-agenda"><header><div><span>This week</span><h2>Upcoming sessions</h2></div><strong>{upcoming.length}</strong></header>{!bookings?<Loading/>:!upcoming.length?<p className="org-empty">No sessions booked this week.</p>:upcoming.map((b,i)=>{const day=new Date(b.startsAt);return <Link className={i%2?'amber':'blue'} to={`/lesson/${b.id}/lobby`} key={b.id}><div className="agenda-date"><strong>{day.getDate()}</strong><span>{day.toLocaleDateString('en',{weekday:'short'})}</span></div><div><small>{timeOf(b.startsAt)} · {b.durationMinutes} min</small><h3>{b.topic}</h3><p>{b.learner.name}{b.skill&&` · ${b.skill}`}</p></div><span className="agenda-avatar">{b.learner.name.split(' ').map(part=>part[0]).join('').slice(0,2)}</span></Link>})}</section>
    </aside>
   </div>
  </div>
 </DashboardShell>
}
export function AdminManagement(){const{pathname}=useLocation();const[data,setData]=useState<ManagedUser[]|null>(null);const section=pathname.split('/').pop()??'dashboard';useEffect(()=>{adminUiService.users().then(setData)},[]);if(section==='reports')return <AdminWrap title="Reports" text="Export platform insights and monitor marketplace quality."><div className="report-grid">{['Marketplace growth','Lesson completion','Tutor quality','Revenue summary'].map(x=><article key={x}><Code2/><h3>{x}</h3><p>Updated Sep 2, 2026</p><button className="btn ghost">Generate report</button></article>)}</div></AdminWrap>;return <AdminWrap title={section[0]?.toUpperCase()+section.slice(1).replaceAll('-',' ')} text="Search, filter, and manage marketplace records."><div className="admin-controls"><div><Search/><input placeholder={`Search ${section}`}/></div><button><Filter/> Filters</button><button className="btn"><Plus/> Add new</button></div>{!data?<Loading/>:<div className="admin-records">{data.map(u=><article key={u.id}><div className="avatar">{u.name.split(' ').map(x=>x[0]).join('')}</div><span><strong>{u.name}</strong><small>{u.email}</small></span><SkillBadge>{u.role}</SkillBadge><span className={`status ${u.status.toLowerCase()}`}>{u.status}</span><span>{u.metric}</span><span>{u.joined}</span><button aria-label="More actions">•••</button></article>)}</div>}</AdminWrap>}
function AdminWrap({title,text,children}:{title:string;text:string;children:React.ReactNode}){return <div className="admin-ui"><aside><strong><Code2/> pairlore</strong>{['Dashboard','Students','Tutors','Applications','Lessons','Payments','Withdrawals','Skills','Learning Paths','Reports','Settings'].map(x=><Link to={`/admin/${x==='Dashboard'?'':x.toLowerCase().replaceAll(' ','-')}`} key={x}>{x}</Link>)}</aside><main><PageTitle title={title} text={text}/>{children}</main></div>}
export function PageTitle({title,text,action}:{title:string;text:string;action?:string}){const ActionIcon=action?.toLowerCase().includes('tutor')?Search:action?.toLowerCase().includes('message')?MessageCircle:action?.toLowerCase().includes('lesson')?CalendarDays:Plus;return <div className="workspace-title"><div><h1>{title}</h1><p>{text}</p></div>{action&&<div><Link className="btn" to={action.toLowerCase().includes('tutor')?'/tutors':'#'}><ActionIcon size={16}/>{action}</Link></div>}</div>}
function Tabs<T extends string>({items,active,onChange}:{items:T[];active:T;onChange:(x:T)=>void}){return <div className="workspace-tabs">{items.map(x=><button className={active===x?'active':''} onClick={()=>onChange(x)} key={x}>{x.replaceAll('_',' ')}</button>)}</div>}
