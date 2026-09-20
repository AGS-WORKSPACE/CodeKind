import{useState}from'react';
import{Link,NavLink,useLocation,useNavigate}from'react-router-dom';
import{useAuth}from'./auth';
import{Activity,BookOpen,Bug,CalendarDays,CircleDollarSign,ClipboardList,Code2,FileText,Gavel,HandCoins,Languages,LayoutDashboard,LogOut,Menu,Plus,Scale,Search,UserCog,Users,X}from'lucide-react';
import{useLoader}from'./hooks/use-payments';
import{adminPaymentsService}from'./services/admin-payments.service';
import{adminTutorService}from'./services/admin-tutors.service';
import{statsService}from'./services/reviews.service';
import{AdminAppeals,AdminSessionPayments}from'./admin-finance';import{AdminCredits,AdminMoneySettings}from'./admin-money';
import{AdminErrorLog}from'./admin-error-log';
import{AdminReferenceLists}from'./admin-reference-lists';
import{AdminSessionEvidence}from'./admin-session-evidence';
import{AdminTutorApplications}from'./admin-tutor-applications';
import{AdminPaths}from'./admin-paths';
import{AdminAudit,AdminBookings,AdminPeople,AdminTeam}from'./admin-people';
import{adminControlService}from'./services/admin-users.service';
import{WorkspaceMenu}from'./workspace-menu';

const groups=[
 ['Overview',[['Dashboard','']]],
 ['People',[['Users','users'],['Tutor Applications','tutor-applications']]],
 ['Learning',[['Learning Paths','learning-paths']]],
 ['Lessons',[['Bookings','bookings'],['Session Evidence','session-evidence']]],
 ['Finance',[['Session Payments','session-payments'],['Wallet Credits','wallet-credits'],['Money Settings','money-settings']]],
 ['Trust & Quality',[['Appeals','appeals']]],
 ['Platform',[['Reference Lists','reference-lists'],['Administrators','admins'],['Audit Trail','audit-log'],['Error Log','error-log']]]
] as const;
const icons:Record<string,React.ReactNode>={
 '':<LayoutDashboard/>,users:<Users/>,'tutor-applications':<ClipboardList/>,'learning-paths':<BookOpen/>,
 bookings:<CalendarDays/>,'session-evidence':<Activity/>,
 'session-payments':<Scale/>,'wallet-credits':<HandCoins/>,'money-settings':<CircleDollarSign/>,
 appeals:<Gavel/>,'reference-lists':<Languages/>,admins:<UserCog/>,'audit-log':<FileText/>,'error-log':<Bug/>
};

const label=(value:string)=>value.replaceAll('-',' ').replace(/\b\w/g,x=>x.toUpperCase());

export function AdminControlCentre(){const{pathname}=useLocation();const[nav,setNav]=useState(false);const{logout}=useAuth();const navigate=useNavigate();const signOut=async()=>{await logout();navigate('/')};const parts=pathname.split('/').filter(Boolean).slice(1);const section=parts[0]??'';return <div className="admin-centre"><aside className={nav?'admin-side open':'admin-side'}><div className="admin-brand"><Link to="/admin"><Code2/> <span>pairlore</span><b>ADMIN</b></Link><button onClick={()=>setNav(false)} aria-label="Close navigation"><X/></button></div><nav>{groups.map(([group,items])=><div className="admin-nav-group" key={group}><span>{group}</span>{items.map(([name,path])=><NavLink end={path===''} onClick={()=>setNav(false)} to={`/admin${path?`/${path}`:''}`} key={path}><i>{icons[path]}</i>{name}</NavLink>)}</div>)}</nav><button type="button" className="admin-logout" onClick={signOut}><LogOut/> Log out</button></aside><main className="admin-main"><AdminHeader openNav={()=>setNav(true)}/>{section===''?<AdminOverview/>:section==='users'?<AdminPeople/>:section==='bookings'?<AdminBookings/>:section==='admins'?<AdminTeam/>:section==='audit-log'?<AdminAudit/>:section==='learning-paths'?<AdminPaths slug={parts[1]}/>:section==='session-payments'?<AdminSessionPayments/>:section==='money-settings'?<AdminMoneySettings/>:section==='wallet-credits'?<AdminCredits/>:section==='appeals'?<AdminAppeals/>:section==='error-log'?<AdminErrorLog/>:section==='reference-lists'?<AdminReferenceLists kind={parts[1]}/>:section==='session-evidence'?<AdminSessionEvidence/>:section==='tutor-applications'?<AdminTutorApplications/>:<AdminSoon section={section}/>}</main></div>}

function AdminHeader({openNav}:{openNav:()=>void}){
 const[query,setQuery]=useState('');
 const navigate=useNavigate();
 const{user}=useAuth();
 const who=user?`${user.firstName} ${user.lastName}`:'Admin';
 const initials=user?`${user.firstName[0]??''}${user.lastName[0]??''}`.toUpperCase():'AN';
 const search=(event:React.FormEvent)=>{event.preventDefault();navigate(`/admin/users?q=${encodeURIComponent(query)}`)};
 return <header className="admin-header">
  <button className="admin-menu" onClick={openNav} aria-label="Open navigation"><Menu/></button>
  <form className="admin-global-search" onSubmit={search}>
   <Search/>
   <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find someone by name or email"/>
  </form>
  <div className="admin-quick"><Link className="btn" to="/admin/learning-paths/new"><Plus/> New learning path</Link></div>
  <WorkspaceMenu initials={initials} name={who}/>
 </header>;
}

function AdminOverview(){
 const stats=useLoader(()=>statsService.read(),[]);
 const waiting=useLoader(()=>adminTutorService.applications('submitted'),[]);
 const appeals=useLoader(()=>adminPaymentsService.appeals('OPEN'),[]);
 const people=useLoader(()=>adminControlService.people({}),[]);
 const suspended=useLoader(()=>adminControlService.people({state:'suspended'}),[]);
 const bookings=useLoader(()=>adminControlService.bookings({}),[]);
 const counts=stats.data;
 return <div className="admin-page">
  <PageHead eyebrow="Operations overview" title="Platform control centre" text="What the platform actually holds today. Sections still being built say so."/>
  <section className="admin-kpis">
   <article><span>Approved tutors</span><strong>{counts?.tutors??'—'}</strong><div><small>Bookable right now</small></div></article>
   <article><span>Sessions taught</span><strong>{counts?.sessions??'—'}</strong><div><small>Completed and settled</small></div></article>
   <article><span>Reviews</span><strong>{counts?.reviews??'—'}</strong><div><small>{counts?.reviews?`${counts.rating.toFixed(1)} average`:'None yet'}</small></div></article>
   <article className={waiting.data?.length?'warn':''}><span>Applications waiting</span><strong>{waiting.data?.length??'—'}</strong><div><small>Tutors to review</small></div></article>
  </section>
  <div className="admin-overview-grid">
   <section className="admin-panel"><PanelHead title="Needs attention" link="/admin/tutor-applications"/>
    <div className="attention-row"><strong>{waiting.data?.length??0}</strong><span>Tutor applications<small>Waiting for a decision</small></span><Link className="text-link" to="/admin/tutor-applications">Open</Link></div>
    <div className="attention-row"><strong>{appeals.data?.length??0}</strong><span>Open appeals<small>Money frozen until resolved</small></span><Link className="text-link" to="/admin/appeals">Open</Link></div>
   </section>
   <section className="admin-panel"><PanelHead title="The platform" link="/admin/users"/>
    <div className="attention-row"><strong>{people.data?.total??'—'}</strong><span>Accounts<small>{suspended.data?.total??0} suspended</small></span><Link className="text-link" to="/admin/users">Open</Link></div>
    <div className="attention-row"><strong>{bookings.data?.total??'—'}</strong><span>Sessions booked<small>Across every workspace</small></span><Link className="text-link" to="/admin/bookings">Open</Link></div>
   </section>
  </div>
 </div>;
}

/* Any address that is not one of the sections above. The nav only lists what is built, so this is
   reached by an old link or a typed URL. */
function AdminSoon({section}:{section:string}){
 return <div className="admin-page">
  <PageHead eyebrow="Not here" title={label(section||'dashboard')} text="There is no such section. Pick one from the menu on the left."/>
 </div>;
}

function PageHead({eyebrow,title,text,children}:{eyebrow:string;title:string;text:string;children?:React.ReactNode}){return <div className="admin-page-head"><div className="admin-page-copy"><span>{eyebrow}</span><h1>{title}</h1><p>{text}</p></div>{children&&<div className="admin-page-actions">{children}</div>}</div>}
function PanelHead({title,link}:{title:string;link:string}){return <header className="panel-title"><h2>{title}</h2><Link to={link}>View all →</Link></header>}
