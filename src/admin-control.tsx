import{useState}from'react';
import{Link,NavLink,useLocation,useNavigate}from'react-router-dom';
import{useAuth}from'./auth';
import{Activity,BadgeCheck,Ban,Bell,BookOpen,Bug,CalendarDays,CircleDollarSign,ClipboardList,Code2,Cog,FileText,Flag,Gavel,GraduationCap,HandCoins,History,Languages,LayoutDashboard,LogOut,Mail,Megaphone,Menu,Percent,Radio,Plus,Scale,Search,Shapes,Star,ToggleRight,UserCog,Users,UserX,X}from'lucide-react';
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
import{WorkspaceMenu}from'./workspace-menu';

const groups=[
 ['Overview',[['Dashboard',''],['Activity','activity']]],
 ['People',[['Students','students'],['Tutors','tutors'],['Tutor Applications','tutor-applications'],['Tutor Verification','tutor-verification']]],
 ['Learning',[['Learning Paths','learning-paths']]],
 ['Lessons & Bookings',[['Bookings','bookings'],['Live Lessons','live-lessons'],['Lesson History','lessons'],['Cancellations','cancellations']]],
 ['Finance',[['Session Payments','session-payments'],['Wallet Credits','wallet-credits'],['Money Settings','money-settings']]],
 ['Trust & Quality',[['Appeals','appeals'],['Session Evidence','session-evidence'],['Reviews','reviews'],['Reports','reports'],['Tutor Quality','tutor-quality'],['Suspensions','suspensions']]],
 ['Communications',[['Notifications','notifications'],['Announcements','announcements'],['Email Templates','email-templates']]],
 ['Platform',[['Reference Lists','reference-lists'],['Categories','categories'],['Platform Settings','settings'],['Feature Controls','settings/features'],['Admin Users','admin-users'],['Audit Logs','audit-log'],['Error Log','error-log']]]
] as const;
const icons:Record<string,React.ReactNode>={
 '':<LayoutDashboard/>,activity:<Activity/>,students:<Users/>,tutors:<GraduationCap/>,
 'tutor-applications':<ClipboardList/>,'tutor-verification':<BadgeCheck/>,
 'learning-paths':<BookOpen/>,
 bookings:<CalendarDays/>,'live-lessons':<Radio/>,lessons:<History/>,cancellations:<Ban/>,
 'session-payments':<Scale/>,'wallet-credits':<HandCoins/>,'money-settings':<CircleDollarSign/>,
 appeals:<Gavel/>,'session-evidence':<Activity/>,reviews:<Star/>,reports:<Flag/>,'tutor-quality':<BadgeCheck/>,suspensions:<UserX/>,
 notifications:<Bell/>,announcements:<Megaphone/>,'email-templates':<Mail/>,categories:<Shapes/>,'reference-lists':<Languages/>,
 settings:<Cog/>,'settings/commission':<Percent/>,'settings/features':<ToggleRight/>,'admin-users':<UserCog/>,'audit-log':<FileText/>,'error-log':<Bug/>
};
const label=(value:string)=>value.replaceAll('-',' ').replace(/\b\w/g,x=>x.toUpperCase());

export function AdminControlCentre(){const{pathname}=useLocation();const[nav,setNav]=useState(false);const{logout}=useAuth();const navigate=useNavigate();const signOut=async()=>{await logout();navigate('/')};const parts=pathname.split('/').filter(Boolean).slice(1);const section=parts[0]??'';return <div className="admin-centre"><aside className={nav?'admin-side open':'admin-side'}><div className="admin-brand"><Link to="/admin"><Code2/> <span>pairlore</span><b>ADMIN</b></Link><button onClick={()=>setNav(false)} aria-label="Close navigation"><X/></button></div><nav>{groups.map(([group,items])=><div className="admin-nav-group" key={group}><span>{group}</span>{items.map(([name,path])=><NavLink end={path===''} onClick={()=>setNav(false)} to={`/admin${path?`/${path}`:''}`} key={path}><i>{icons[path]}</i>{name}</NavLink>)}</div>)}</nav><button type="button" className="admin-logout" onClick={signOut}><LogOut/> Log out</button></aside><main className="admin-main"><AdminHeader openNav={()=>setNav(true)}/>{section===''?<AdminOverview/>:section==='learning-paths'?<AdminPaths slug={parts[1]}/>:section==='session-payments'?<AdminSessionPayments/>:section==='money-settings'?<AdminMoneySettings/>:section==='wallet-credits'?<AdminCredits/>:section==='appeals'?<AdminAppeals/>:section==='error-log'?<AdminErrorLog/>:section==='reference-lists'?<AdminReferenceLists kind={parts[1]}/>:section==='session-evidence'?<AdminSessionEvidence/>:section==='tutor-applications'?<AdminTutorApplications/>:<AdminSoon section={section}/>}</main></div>}

function AdminHeader({openNav}:{openNav:()=>void}){const[query,setQuery]=useState('');const[quick,setQuick]=useState(false);const{user}=useAuth();const who=user?`${user.firstName} ${user.lastName}`:'Admin';const initials=user?`${user.firstName[0]??''}${user.lastName[0]??''}`.toUpperCase():'AN';return <header className="admin-header"><button className="admin-menu" onClick={openNav} aria-label="Open navigation"><Menu/></button><div className="admin-global-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search students, tutors, bookings, transactions…"/>{query&&<div className="admin-search-results"><strong>Search results</strong>{['Student · Alex Lee','Tutor · Maya Chen','Booking · CK-20484','Transaction · TX-30284'].filter(x=>x.toLowerCase().includes(query.toLowerCase())).map(x=><button key={x}>{x}</button>)}</div>}</div><div className="admin-quick"><button className="btn" onClick={()=>setQuick(!quick)}><Plus/> New</button>{quick&&<div>{['Learning Path','Announcement','Promotion','Notification'].map(x=><Link onClick={()=>setQuick(false)} to={x==='Learning Path'?'/admin/learning-paths/new':`/admin/${x.toLowerCase().replaceAll(' ','-')}`} key={x}>{x}</Link>)}</div>}</div><WorkspaceMenu initials={initials} name={who}/></header>}

function AdminOverview(){
 const stats=useLoader(()=>statsService.read(),[]);
 const waiting=useLoader(()=>adminTutorService.applications('submitted'),[]);
 const appeals=useLoader(()=>adminPaymentsService.appeals('OPEN'),[]);
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
   <section className="admin-panel"><PanelHead title="Where the money is" link="/admin/session-payments"/>
    <p className="org-empty">Session payments, wallet credits and money settings are live. Revenue reporting arrives with the admin control centre epic.</p>
   </section>
  </div>
 </div>;
}

/* Sections whose backend is not built yet. The nav keeps them visible so the plan is clear, but
   nothing here pretends to hold data. */
function AdminSoon({section}:{section:string}){
 return <div className="admin-page">
  <PageHead eyebrow="Not built yet" title={label(section||'dashboard')} text="This section is planned for the admin control centre epic. Nothing is shown here until it reads real records."/>
  <section className="admin-panel"><p className="org-empty">What is live today: tutor applications, learning paths, session payments, appeals, wallet credits, money settings, session evidence, reference lists and the error log.</p></section>
 </div>;
}







function PageHead({eyebrow,title,text,children}:{eyebrow:string;title:string;text:string;children?:React.ReactNode}){return <div className="admin-page-head"><div className="admin-page-copy"><span>{eyebrow}</span><h1>{title}</h1><p>{text}</p></div>{children&&<div className="admin-page-actions">{children}</div>}</div>}
function PanelHead({title,link}:{title:string;link:string}){return <header className="panel-title"><h2>{title}</h2><Link to={link}>View all →</Link></header>}
