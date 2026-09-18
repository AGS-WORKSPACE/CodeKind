import {useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {ArrowRight,BookOpen,CalendarDays,Check,DashboardShell,Search,ShieldCheck,TutorCard,Users,Zap} from './components';
import {Building2,GraduationCap,UserRound} from 'lucide-react';
import {useAuth} from './auth';
import {useLoader} from './hooks/use-payments';
import {reviewsService} from './services/reviews.service';
import {tutorService} from './services/tutor.service';
import {referenceService} from './services/reference.service';
import {StarRow} from './reviews-pages';
import {HeroShowcase} from './hero-showcase';

const FEATURED=3;
const SUBJECTS=12;

/** The best reviewed tutors, or nothing at all while there are none to show. */
function FeaturedTutors(){
 const tutors=useLoader(()=>tutorService.list(new URLSearchParams({sort:'rating',page:'1'})),[]);
 const items=(tutors.data?.items??[]).slice(0,FEATURED);
 if(!items.length)return null;
 return <section className="section">
  <div className="section-head"><div><span className="eyebrow">TOP MENTORS</span><h2>Find your perfect learning partner</h2></div>
   <Link to="/tutors" className="text-link">Browse all tutors <ArrowRight size={17}/></Link></div>
  <div className="featured-grid">{items.map(tutor=><TutorCard key={tutor.id} tutor={tutor} compact/>)}</div>
 </section>;
}

/** Subjects people can actually book, taken from the skills the platform has enabled. */
function Subjects(){
 const skills=useLoader(()=>referenceService.list('skills',()=>[]),[]);
 const all=skills.data??[];
 // One subject per category first, so the cloud shows the breadth before the depth.
 const seen=new Set<string>();
 const spread=all.filter(skill=>{const key=skill.category??'';if(seen.has(key))return false;seen.add(key);return true});
 const shown=[...spread,...all.filter(skill=>!spread.includes(skill))].slice(0,SUBJECTS);
 if(!shown.length)return null;
 return <section className="skills-section">
  <div><span className="eyebrow">START WITH A SUBJECT</span><h2>What do you want to master next?</h2>
   <p>Software, AI, data, cloud, security, design or a spoken language — choose a subject and meet tutors who work in it every day.</p></div>
  <div className="skill-cloud">{shown.map(skill=><Link key={skill.code} to={`/tutors/${skill.code}`}>{skill.label}<ArrowRight size={15}/></Link>)}</div>
 </section>;
}

/** Real reviews from finished sessions. Nobody writes testimonials here. */
function Testimonials(){
 const reviews=useLoader(()=>reviewsService.latest(),[]);
 const items=reviews.data??[];
 if(!items.length)return null;
 return <section className="section">
  <div className="center-head"><span className="eyebrow">REAL PROGRESS</span><h2>What learners said after their sessions</h2></div>
  <div className="reviews">{items.map(review=><article key={review.id}>
   <StarRow rating={review.rating}/><p>“{review.comment}”</p><strong>{review.learnerName}</strong><span>{review.topic}</span>
  </article>)}</div>
 </section>;
}

export function Home(){return <main><HeroShowcase/><FeaturedTutors/><Subjects/><section className="section"><div className="center-head"><span className="eyebrow">SIMPLE BY DESIGN</span><h2>From “I’m stuck” to “I built it”</h2></div><div className="steps">{[['01','Tell us your goal','Share the subject you want to learn, build, or get certified in.'],['02','Meet your tutor','Compare real experience, reviews, and availability.'],['03','Learn by doing','Work through real projects with feedback made for you.']].map(x=><article key={x[0]}><b>{x[0]}</b><h3>{x[1]}</h3><p>{x[2]}</p></article>)}</div></section><Testimonials/><section className="cta"><div><span className="eyebrow">FOR EXPERTS &amp; TRAINING TEAMS</span><h2>Your experience can unlock someone’s future.</h2><p>Teach on your schedule as an individual, or bring a whole training team on board — invite your trainers, share one calendar, and schedule sessions together.</p></div><Link to="/become-a-tutor" className="btn pale">Become a tutor <ArrowRight size={18}/></Link></section></main>}

/* Learning paths are designed but not built yet, so the page says so rather than showing a
   curriculum nobody can enrol in. It comes back with epic 12. */
export function LearningPaths(){
 const{pathname}=useLocation();
 const studentView=pathname==='/student/learning-paths';
 const empty=<section className="workspace-empty"><BookOpen/><h3>Learning paths are not ready yet</h3>
  <p>Structured paths — a subject broken into modules you work through with a tutor — are still being built. Until then, book the sessions you need and your tutor will plan the route with you.</p>
  <Link className="btn" to="/tutors"><Users size={16}/> Find a tutor</Link></section>;
 if(studentView)return <DashboardShell role="student"><div className="workspace-title"><div><h1>My learning paths</h1><p>Paths you are enrolled in will appear here.</p></div></div>{empty}</DashboardShell>;
 return <main><section className="page-hero"><span className="pill"><BookOpen size={15}/> Coming with structured learning</span><h1>Go from curious to capable</h1><p>Learning paths will turn a subject into a route you can follow with a tutor beside you. They are not open yet.</p></section><section className="section">{empty}</section></main>;
}

export function LearningPathDetail(){return <LearningPaths/>}

export function BecomeTutor(){return <main><section className="tutor-apply-hero"><div><span className="pill"><Zap size={15}/> Teach what you know</span><h1>Help the next generation of developers.</h1><p>Turn your real-world experience into flexible, meaningful income. You choose what to teach, when to teach, and what to charge.</p><a href="#apply" className="btn">Apply to become a tutor <ArrowRight/></a></div><div className="earn-card"><span>Example monthly earnings</span><strong>$2,880</strong><small>If you teach 12 lessons a week at $60 an hour. You set your own rate.</small><div><i style={{height:'40%'}}/><i style={{height:'55%'}}/><i style={{height:'45%'}}/><i style={{height:'75%'}}/><i style={{height:'92%'}}/><i style={{height:'82%'}}/></div></div></section><section className="section"><div className="center-head"><span className="eyebrow">WHY PAIRLORE</span><h2>Teach on your terms</h2></div><div className="benefits">{[[CalendarDays,'Set your own schedule','Open the hours that work around your career.'],[Zap,'Earn from your expertise','Set your hourly rate and grow with your reputation.'],[Users,'Teach motivated learners','Meet students with clear goals and real curiosity.'],[ShieldCheck,'We handle the admin','Scheduling, reminders, and payments—all in one place.']].map(([Icon,t,d])=><article key={String(t)}><Icon/><h3>{String(t)}</h3><p>{String(d)}</p></article>)}</div></section><section id="apply" className="application"><div><span className="eyebrow">HOW TO APPLY</span><h2>Choose how you’ll teach</h2><p>Applications usually take 10 minutes. We review every profile personally within 3–5 business days.</p><div className="requirements"><h3>What we're looking for</h3>{['2+ years of professional experience','Strong communication skills','A GitHub or portfolio of work','Reliable internet and quiet setup'].map(x=><p key={x}><Check/>{x}</p>)}</div></div><ApplyOptions/></section></main>}

/* The application itself lives in signup and /tutor/onboarding, so this page only routes people into it. */
/* A signed-in learner teaches from the same account, so they add the workspace instead of signing up again. */
function TeachWithThisAccount(){const{workspaces,addWorkspace,chooseWorkspace}=useAuth();const navigate=useNavigate();const[busy,setBusy]=useState(false);const[error,setError]=useState('');const holds=workspaces.includes('TUTOR');const start=async()=>{setBusy(true);setError('');try{await(holds?chooseWorkspace('TUTOR'):addWorkspace('TUTOR'));navigate(holds?'/tutor/dashboard':'/tutor/onboarding')}catch(e){setError(e instanceof Error?e.message:'Could not start teaching');setBusy(false)}};return <div className="apply-options"><article><span className="apply-icon"><GraduationCap/></span><h3>{holds?'You already teach on Pairlore':'Teach with your account'}</h3><p>{holds?'Switch to your teaching workspace to manage your profile and sessions.':'Keep one login for learning and teaching. Your profile stays hidden until it’s approved.'}</p>{error&&<div className="form-error">{error}</div>}<button type="button" className="btn wide" disabled={busy} onClick={start}>{busy?'Opening…':holds?'Switch to teaching':'Start your tutor application'} <ArrowRight/></button></article></div>}
function ApplyOptions(){const{user}=useAuth();if(user?.role==='STUDENT')return <TeachWithThisAccount/>;if(user?.role==='TUTOR')return <div className="apply-options"><article><span className="apply-icon"><GraduationCap/></span><h3>You’re signed in as a tutor</h3><p>Pick up your application where you left off. Your profile stays hidden until it’s approved.</p><Link className="btn wide" to="/tutor/onboarding">Continue your application <ArrowRight/></Link></article></div>;if(user?.role==='ORGANIZATION')return <div className="apply-options"><article><span className="apply-icon"><Building2/></span><h3>Your organisation is set up</h3><p>Invite trainers and schedule their sessions from your organisation workspace.</p><Link className="btn wide" to="/org/dashboard">Open organisation dashboard <ArrowRight/></Link></article></div>;return <div className="apply-options"><article><span className="apply-icon"><UserRound/></span><h3>Teach as an individual</h3><p>Set your own rate and schedule.</p><ol><li>Create your tutor account</li><li>Complete the 6-step application: experience, skills, profiles and rates</li><li>Go live once we’ve approved your profile</li></ol><Link className="btn wide" to="/signup?role=tutor">Apply as an individual <ArrowRight/></Link></article><article><span className="apply-icon"><Building2/></span><h3>Register your organisation</h3><p>Bring your whole training team on board.</p><ol><li>Create your organisation account</li><li>Invite your trainers by email</li><li>Schedule their sessions from one shared calendar</li></ol><Link className="btn ghost wide" to="/signup?role=tutor&as=org">Register your organisation <ArrowRight/></Link></article></div>}

export function NotFound(){return <main className="placeholder"><div className="path-icon"><Search/></div><span className="eyebrow">404 · PAGE NOT FOUND</span><h1>Page not found</h1><p>The page may have moved, or the link may be out of date.</p><div className="not-found-actions"><Link to="/" className="btn ghost">Go home</Link><Link to="/tutors" className="btn">Find tutors</Link></div></main>}
