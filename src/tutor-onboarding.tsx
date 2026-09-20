import{useState}from'react';
import{useNavigate}from'react-router-dom';
import{ArrowRight,Check,ShieldCheck}from'lucide-react';
import{useAuth}from'./auth';
import{useToast}from'./ui-feedback';
import{LanguagePicker,SkillPicker}from'./pickers';
import{CountrySelect,TimezoneSelect}from'./search-select';
import{localTimezone}from'./data/locations';
import{useLoader}from'./hooks/use-payments';
import{tutorService,type TutorProfile}from'./services/tutor.service';
import{ApiError}from'./services/api';
import type{SessionUser}from'./services/auth.service';

/* Three steps, because a reviewer only needs a headline, a biography and one subject. Rates, links
   and teaching history are asked for here but can all be changed later from settings. */
const STEPS=[
 ['About you','Who you are and where you teach from.'],
 ['What you teach','Your subjects, and how long you have been at them.'],
 ['Rates and links','What you charge, and anything that shows your work.'],
];

/* The form seeds itself once, so wait for both the session and any profile already saved — somebody
   coming back to an unfinished application should not have to type it all again. */
export function TutorOnboarding(){
 const{user,loading}=useAuth();
 const saved=useLoader(()=>tutorService.myProfile(),[]);
 if(loading||saved.loading)return <main className="onboarding"><p className="skill-picker-status">Loading your profile…</p></main>;
 return <OnboardingForm user={user} saved={saved.data}/>;
}

/** The steps as a rail: what is done, what is now, and what is left. Finished steps go back. */
function Rail({step,onGo}:{step:number;onGo:(step:number)=>void}){
 return <ol className="apply-rail">{STEPS.map(([title],index)=>{
  const number=index+1;
  return <li key={title} className={number<step?'done':number===step?'here':undefined}>
   <button type="button" disabled={number>=step} onClick={()=>onGo(number)}>
    <span>{number<step?<Check size={13}/>:number}</span>{title}
   </button>
  </li>;
 })}</ol>;
}

function OnboardingForm({user,saved}:{user:SessionUser|null;saved:TutorProfile|null}){
 const navigate=useNavigate();
 const toast=useToast();
 const{updateAccount}=useAuth();
 const[step,setStep]=useState(1);
 const[chosen,setChosen]=useState<string[]>(saved?.skills.map(skill=>skill.code)??[]);
 const[spoken,setSpoken]=useState<string[]>(saved?.languages.length?saved.languages:['English']);
 const[error,setError]=useState('');
 const[busy,setBusy]=useState(false);
 const[form,setForm]=useState({firstName:user?.firstName??'',lastName:user?.lastName??'',country:user?.country??'',timezone:user?.timezone??localTimezone,
  headline:saved?.headline??'',bio:saved?.bio??'',yearsOfExperience:saved?.yearsOfExperience||2,teachingExperience:saved?.teachingExperience??'',
  githubUrl:saved?.githubUrl??'',portfolioUrl:saved?.portfolioUrl??'',linkedinUrl:saved?.linkedinUrl??'',hourlyRate:saved?.hourlyRate||35,trialRate:saved?.trialRate||20});
 const set=(key:keyof typeof form,value:string|number)=>setForm(current=>({...current,[key]:value}));
 // Years and money cannot be negative, and this form posts on a button rather than through a <form>,
 // so the value is held at zero here as well as barred in the field.
 const positive=(value:string)=>{const number=Number(value);return Number.isFinite(number)&&number>0?number:0};
 const field=(label:string,key:keyof typeof form,type='text')=>
  <label>{label}<input type={type} min={type==='number'?0:undefined} step={type==='number'?'any':undefined} value={form[key]}
   onChange={e=>set(key,type==='number'?positive(e.target.value):e.target.value)}/></label>;
 const toggle=(code:string)=>setChosen(current=>current.includes(code)?current.filter(x=>x!==code):[...current,code]);
 // Without these the profile saves as a draft and never reaches a reviewer, so the step holds.
 const blocked=step===1&&(!form.headline.trim()||!form.bio.trim())?'A headline and a short biography are needed to carry on.'
  :step===2&&!chosen.length?'Pick at least one subject you teach.':'';

 const store=(submit:boolean)=>tutorService.saveProfile({headline:form.headline,bio:form.bio,yearsOfExperience:form.yearsOfExperience,
  teachingExperience:form.teachingExperience,languages:spoken,
  hourlyRate:form.hourlyRate,trialRate:form.trialRate,githubUrl:form.githubUrl,portfolioUrl:form.portfolioUrl,linkedinUrl:form.linkedinUrl,
  skills:chosen.map((code,index)=>({code,yearsExperience:form.yearsOfExperience,isPrimary:index===0}))},submit);

 /* Each step is kept as a draft as it is left, so an application picked up days later is still
    there. It is held back from review until the last step. */
 const carryOn=async()=>{
  setStep(step+1);
  if(user)await updateAccount({firstName:form.firstName,lastName:form.lastName,country:form.country,timezone:form.timezone}).catch(()=>{});
  await store(false).catch(()=>{});
 };

 const submit=async()=>{
  setError('');setBusy(true);
  try{
   if(user)await updateAccount({firstName:form.firstName,lastName:form.lastName,country:form.country,timezone:form.timezone});
   const saved=await store(true);
   toast(saved.status==='submitted'?'Application sent for review':'Profile saved');
   navigate('/tutor/dashboard');
  }catch(problem){setError(problem instanceof ApiError?problem.message:'Could not submit application')}
  finally{setBusy(false)}
 };

 return <main className="onboarding">
  <div className="onboarding-head">
   <span className="eyebrow">TUTOR APPLICATION</span>
   <h1>{STEPS[step-1]![0]}</h1>
   <p>{STEPS[step-1]![1]}</p>
  </div>
  <Rail step={step} onGo={setStep}/>
  <section>
   {error&&<div className="form-error">{error}</div>}
   {step===1&&<div className="apply-form">
    <div className="two">{field('First name','firstName')}{field('Last name','lastName')}</div>
    <CountrySelect value={form.country} onChange={value=>set('country',value)}/>
    <TimezoneSelect value={form.timezone} onChange={value=>set('timezone',value)}/>
    {field('Professional headline','headline')}
    <label>Biography<textarea value={form.bio} onChange={e=>set('bio',e.target.value)} placeholder="A paragraph on what you build and who you teach."/></label>
   </div>}
   {step===2&&<div className="apply-form">
    <SkillPicker chosen={chosen} onToggle={toggle}/>
    {field('Years of experience','yearsOfExperience','number')}
    <LanguagePicker label="Languages you teach in" chosen={spoken} onToggle={name=>setSpoken(current=>current.includes(name)?current.filter(x=>x!==name):[...current,name])}/>
    <label>Teaching experience (optional)<textarea value={form.teachingExperience} onChange={e=>set('teachingExperience',e.target.value)}/></label>
   </div>}
   {step===3&&<div className="apply-form">
    <div className="two">{field('Hourly rate (USD)','hourlyRate','number')}{field('Trial rate (USD)','trialRate','number')}</div>
    <p className="apply-optional">Links are optional, and learners see them on your profile.</p>
    {field('GitHub','githubUrl')}{field('Portfolio','portfolioUrl')}{field('LinkedIn','linkedinUrl')}
    <div className="apply-summary">
     <ShieldCheck/>
     <div>
      <strong>{form.firstName} {form.lastName}</strong>
      <span>{form.headline}</span>
      <span>{chosen.length} subject{chosen.length===1?'':'s'} · ${form.hourlyRate} an hour · ${form.trialRate} trial</span>
     </div>
     <small>Your profile stays hidden until an administrator approves it.</small>
    </div>
   </div>}
   {blocked&&<p className="apply-hint">{blocked}</p>}
   <div className="flow-actions">
    {step>1&&<button className="btn ghost" onClick={()=>setStep(step-1)}>Back</button>}
    <button className="btn" disabled={Boolean(blocked)||busy} onClick={()=>step<3?carryOn():submit()}>
     {busy?'Sending…':step<3?'Continue':'Submit application'} <ArrowRight/>
    </button>
   </div>
  </section>
 </main>;
}
