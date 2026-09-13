import{useEffect,useMemo,useState}from'react';
import{useNavigate}from'react-router-dom';
import{ArrowRight,Check,Search,ShieldCheck,X}from'lucide-react';
import{useAuth}from'./auth';
import type{SessionUser}from'./services/auth.service';
import{ApiError}from'./services/api';
import{tutorService,type Skill}from'./services/tutor.service';
import{localTimezone,timezoneLabel}from'./data/locations';
import{CountrySelect,TimezoneSelect,searchOptions}from'./search-select';

/* No availability step: sessions are flexible and booked hour by hour, so a tutor commits to times
   per session rather than publishing a weekly timetable on their account. */
const STEPS=['Personal information','About you','Skills','Online profiles','Pricing','Review and submit'];
const MIN_BIO=80;
const NEW_TO_TEACHING='New to teaching';
const TEACHING=['Mentored colleagues','Ran workshops or talks','Taught a course or bootcamp','University or school teaching','Corporate training','Made tutorials or videos',NEW_TO_TEACHING];

// The form seeds itself from the session once, so wait for it — on a refresh the session is still loading.
export function TutorOnboarding(){const{user,loading}=useAuth();if(loading)return <main className="onboarding"><p className="skill-picker-status">Loading your profile…</p></main>;return <OnboardingForm user={user}/>}

function OnboardingForm({user}:{user:SessionUser|null}){
 const navigate=useNavigate();
 const[step,setStep]=useState(1);
 const[skills,setSkills]=useState<Skill[]|null>(null);
 const[selected,setSelected]=useState<string[]>([]);
 const[skillQuery,setSkillQuery]=useState('');
 const[teaching,setTeaching]=useState<string[]>([]);
 const[error,setError]=useState('');
 const[busy,setBusy]=useState(false);
 const[form,setForm]=useState({firstName:user?.firstName??'',lastName:user?.lastName??'',country:user?.country??'',timezone:user?.timezone??localTimezone,headline:'',bio:'',yearsOfExperience:2,githubUrl:'',portfolioUrl:'',linkedinUrl:'',hourlyRate:35,trialRate:20,languages:'English'});
 useEffect(()=>{tutorService.skills().then(setSkills).catch(e=>{setSkills([]);setError(e instanceof ApiError?e.message:'Could not load skills')})},[]);
 const set=(key:keyof typeof form,value:string|number)=>setForm(current=>({...current,[key]:value}));

 const byId=useMemo(()=>new Map((skills??[]).map(s=>[s.id,s])),[skills]);
 const matches=useMemo(()=>searchOptions((skills??[]).map(s=>({value:s.id,label:s.name})),skillQuery),[skills,skillQuery]);
 const toggleSkill=(id:string)=>setSelected(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
 // "New to teaching" can't sit alongside real experience, so picking either side clears the other.
 const toggleTeaching=(tag:string)=>setTeaching(current=>tag===NEW_TO_TEACHING?(current.includes(tag)?[]:[tag]):current.includes(tag)?current.filter(x=>x!==tag):[...current.filter(x=>x!==NEW_TO_TEACHING),tag]);

 const bioLength=form.bio.trim().length;
 // Why Continue is disabled, shown beside it. Checked here rather than left for the server to reject at the end.
 const missing=[
  !form.firstName.trim()||!form.lastName.trim()?'Add your first and last name':!form.country?'Choose your country':'',
  !form.headline.trim()?'Add a headline':bioLength<MIN_BIO?`Your bio needs ${MIN_BIO-bioLength} more characters`:'',
  selected.length?'':'Pick at least one skill',
  '',
  form.hourlyRate>0?'':'Set an hourly rate',
  '',
 ][step-1];
 const last=step===STEPS.length;

 const submit=async()=>{setError('');setBusy(true);try{await tutorService.submitOnboarding({...form,teachingExperience:teaching.join(', '),avatar:null,githubUrl:form.githubUrl||null,portfolioUrl:form.portfolioUrl||null,linkedinUrl:form.linkedinUrl||null,languages:form.languages.split(',').map(x=>x.trim()),skills:selected.map((skillId,i)=>({skillId,yearsExperience:form.yearsOfExperience,skillLevel:'EXPERT',isPrimary:i===0}))});navigate('/tutor/dashboard')}catch(e){setError(e instanceof ApiError?e.message:'Could not submit application')}finally{setBusy(false)}};
 // Enter in the skill search adds the top match, so typing "py⏎ fig⏎" builds the list without the mouse.
 const onSkillKey=(e:React.KeyboardEvent)=>{if(e.key!=='Enter')return;e.preventDefault();const top=matches.find(m=>!selected.includes(m.value));if(skillQuery.trim()&&top){toggleSkill(top.value);setSkillQuery('')}};

 const text=(label:string,key:keyof typeof form,props:React.InputHTMLAttributes<HTMLInputElement>={})=><label>{label}<input value={form[key]} onChange={e=>set(key,props.type==='number'?Number(e.target.value):e.target.value)} {...props}/></label>;

 return <main className="onboarding">
  <div className="onboarding-head"><span className="eyebrow">TUTOR APPLICATION · STEP {step} OF {STEPS.length}</span><h1>{STEPS[step-1]}</h1><div className="onboarding-progress"><i style={{width:`${step/STEPS.length*100}%`}}/></div></div>
  <section>{error&&<div className="form-error">{error}</div>}

   {step===1&&<div className="apply-form"><div className="two">{text('First name','firstName')}{text('Last name','lastName')}</div><CountrySelect value={form.country} onChange={v=>set('country',v)}/><TimezoneSelect value={form.timezone} onChange={v=>set('timezone',v)}/></div>}

   {step===2&&<div className="apply-form">
    <div className="headline-row">{text('Headline','headline',{placeholder:'e.g. Data engineer who teaches SQL and Python',maxLength:90})}{text('Years of experience','yearsOfExperience',{type:'number',min:0,max:60})}</div>
    <label>Short bio<textarea value={form.bio} onChange={e=>set('bio',e.target.value)} placeholder="What do you work on day to day? How do you like to teach? Who do you help most?"/>
     <span className="field-meta"><span>A few sentences is plenty. Learners read this before booking.</span>{bioLength>=MIN_BIO?<span className="met"><Check size={12}/> Looks good</span>:<span>{bioLength}/{MIN_BIO}</span>}</span></label>
    <fieldset className="chip-field"><legend>Teaching experience <span className="optional">· optional, pick any</span></legend><div className="chips">{TEACHING.map(tag=><button type="button" key={tag} aria-pressed={teaching.includes(tag)} onClick={()=>toggleTeaching(tag)}>{teaching.includes(tag)&&<Check/>}{tag}</button>)}</div></fieldset>
   </div>}

   {step===3&&<div className="skill-step">
    <div className="skill-search"><Search aria-hidden/><input aria-label="Search skills" value={skillQuery} onChange={e=>setSkillQuery(e.target.value)} onKeyDown={onSkillKey} placeholder="Search skills, e.g. Python, Figma, Kubernetes"/>{skillQuery&&<button type="button" aria-label="Clear search" onClick={()=>setSkillQuery('')}><X/></button>}</div>
    {selected.length>0&&<div className="skill-selected"><span>{selected.length} selected · the first is shown as your primary skill</span><div className="chips">{selected.map((id,i)=><button type="button" key={id} aria-pressed onClick={()=>toggleSkill(id)} aria-label={`Remove ${byId.get(id)?.name}`}>{byId.get(id)?.name}{i===0&&<b>Primary</b>}<X/></button>)}</div></div>}
    {skills===null?<p className="skill-picker-status">Loading skills…</p>:matches.length?<div className="skill-picker">{matches.map(m=><button type="button" className={selected.includes(m.value)?'selected':''} aria-pressed={selected.includes(m.value)} onClick={()=>toggleSkill(m.value)} key={m.value}>{selected.includes(m.value)&&<Check/>}{m.label}</button>)}</div>:<p className="skill-picker-status">No skills match “{skillQuery}”.</p>}
   </div>}

   {step===4&&<div className="apply-form"><p className="step-note">Optional, but links to your work help us review your application faster.</p>{text('GitHub','githubUrl',{placeholder:'github.com/username'})}{text('Portfolio','portfolioUrl',{placeholder:'yourportfolio.dev'})}{text('LinkedIn','linkedinUrl',{placeholder:'linkedin.com/in/username'})}</div>}

   {step===5&&<div className="apply-form"><div className="two">{text('Hourly rate ($)','hourlyRate',{type:'number',min:1})}{text('Trial session rate ($)','trialRate',{type:'number',min:0})}</div><p className="step-note">Sessions are billed by the minute at your hourly rate, so a 40-minute session costs two-thirds of it.</p></div>}

   {step===6&&<div className="application-review"><ShieldCheck/><h3>Ready for review</h3>
    <dl className="review-list">
     <div><dt>You</dt><dd>{form.firstName} {form.lastName} · {form.country} · {timezoneLabel(form.timezone)}</dd><button type="button" onClick={()=>setStep(1)}>Edit</button></div>
     <div><dt>Headline</dt><dd>{form.headline} · {form.yearsOfExperience} years</dd><button type="button" onClick={()=>setStep(2)}>Edit</button></div>
     <div><dt>Skills</dt><dd>{selected.map(id=>byId.get(id)?.name).join(', ')}</dd><button type="button" onClick={()=>setStep(3)}>Edit</button></div>
     <div><dt>Rates</dt><dd>${form.hourlyRate}/hour · trial ${form.trialRate}</dd><button type="button" onClick={()=>setStep(5)}>Edit</button></div>
    </dl>
    <p>There’s no fixed timetable. You agree a time for each session you take on.</p><p>Your profile stays hidden until an administrator approves it.</p></div>}

   <div className="flow-actions">{missing&&<span className="flow-hint">{missing}</span>}{step>1&&<button type="button" className="btn ghost" onClick={()=>setStep(step-1)}>Back</button>}<button type="button" className="btn" disabled={Boolean(missing)||busy} onClick={()=>last?submit():setStep(step+1)}>{last?(busy?'Submitting…':'Submit application'):'Continue'} <ArrowRight/></button></div>
  </section>
 </main>;
}
