import{useEffect,useState}from'react';
import{Check}from'lucide-react';
import{DashboardShell}from'./components';
import{CountrySelect,TimezoneSelect}from'./search-select';
import{SkillPicker}from'./skill-picker';
import{PageTitle}from'./workspace-pages';
import{useAuth}from'./auth';
import{authService,type NotificationPreferences}from'./services/auth.service';
import{tutorService,type TutorProfile,type TutorProfileInput,type TutorStatus}from'./services/tutor.service';

const STUDENT_TABS=['PROFILE','ACCOUNT','NOTIFICATIONS','SECURITY'];
const TUTOR_TABS=['PERSONAL','HEADLINE & BIO','SKILLS','EXPERIENCE','PRICING','PORTFOLIO','NOTIFICATIONS','SECURITY'];
const PROFILE_TABS=['HEADLINE & BIO','SKILLS','EXPERIENCE','PRICING','PORTFOLIO'];

export function SettingsPage({role}:{role:'student'|'tutor'}){
 const tutor=role==='tutor';
 const[tab,setTab]=useState((tutor?TUTOR_TABS:STUDENT_TABS)[0]!);
 return <DashboardShell role={role}>
  <PageTitle title={tutor?'Tutor profile editor':'Settings'} text="Keep your profile, preferences, and account security up to date."/>
  <div className="settings-layout">
   <nav>{(tutor?TUTOR_TABS:STUDENT_TABS).map(x=><button type="button" className={tab===x?'active':''} onClick={()=>setTab(x)} key={x}>{x}</button>)}</nav>
   {tab==='NOTIFICATIONS'?<NotificationsForm/>:tab==='SECURITY'?<SecurityForm/>:PROFILE_TABS.includes(tab)?<TutorProfileForm tab={tab}/>:<AccountForm key={tab} tab={tab}/>}
  </div>
 </DashboardShell>;
}

/** One settings panel: shows what saving did, or why it failed. */
function SettingsForm({title,text,submitLabel='Save changes',onSave,children}:{title:string;text:string;submitLabel?:string;onSave:()=>Promise<string>;children:React.ReactNode}){
 const[busy,setBusy]=useState(false);
 const[result,setResult]=useState<{ok:boolean;text:string}|null>(null);
 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();setBusy(true);setResult(null);
  try{setResult({ok:true,text:await onSave()})}
  catch(problem){setResult({ok:false,text:problem instanceof Error?problem.message:'Your changes could not be saved'})}
  finally{setBusy(false)}
 };
 return <form className="settings-form" onSubmit={submit}>
  <div className="settings-section-head"><h2>{title}</h2><p>{text}</p></div>
  {children}
  {result&&(result.ok?<div className="success-note"><Check/> {result.text}</div>:<div className="form-error">{result.text}</div>)}
  <button className="btn" disabled={busy}>{busy?'Saving…':submitLabel}</button>
 </form>;
}

function AccountForm({tab}:{tab:string}){
 const{user,updateAccount}=useAuth();
 const[form,setForm]=useState({firstName:user?.firstName??'',lastName:user?.lastName??'',country:user?.country??'',timezone:user?.timezone??'UTC',phone:user?.phone??'',learningGoals:user?.learningGoals??''});
 const set=(key:keyof typeof form)=>(value:string)=>setForm(current=>({...current,[key]:value}));
 const save=async()=>{await updateAccount(form);return'Changes saved'};
 const initials=`${form.firstName[0]??''}${form.lastName[0]??''}`.toUpperCase();
 if(tab==='ACCOUNT')return <SettingsForm title="Account details" text="How we reach you about your lessons." onSave={save}>
  <label>Email address<input type="email" value={user?.email??''} readOnly/></label>
  <small className="settings-note">To change your email address, contact support.</small>
  <label>Phone number<input type="tel" value={form.phone} onChange={e=>set('phone')(e.target.value)}/></label>
 </SettingsForm>;
 return <SettingsForm title={tab==='PERSONAL'?'Personal information':'Your profile'} text="Your name, location, and the timezone we show lesson times in." onSave={save}>
  <div className="settings-avatar"><div className="avatar">{initials}</div></div>
  <div className="two"><label>First name<input value={form.firstName} onChange={e=>set('firstName')(e.target.value)} required/></label><label>Last name<input value={form.lastName} onChange={e=>set('lastName')(e.target.value)} required/></label></div>
  <CountrySelect value={form.country} onChange={set('country')}/>
  <TimezoneSelect value={form.timezone} onChange={set('timezone')}/>
  {tab==='PERSONAL'?<label>Phone number<input type="tel" value={form.phone} onChange={e=>set('phone')(e.target.value)}/></label>
   :<label>Learning goals<textarea value={form.learningGoals} onChange={e=>set('learningGoals')(e.target.value)} placeholder="What do you want to be able to do?"/></label>}
 </SettingsForm>;
}

const EMPTY_PROFILE:TutorProfileInput={headline:'',bio:'',yearsOfExperience:0,teachingExperience:'',languages:[],hourlyRate:0,trialRate:0,githubUrl:'',portfolioUrl:'',linkedinUrl:'',skills:[]};
const toInput=(p:TutorProfile):TutorProfileInput=>({...p,githubUrl:p.githubUrl??'',portfolioUrl:p.portfolioUrl??'',linkedinUrl:p.linkedinUrl??'',skills:p.skills.map(({code,yearsExperience,isPrimary})=>({code,yearsExperience,isPrimary}))});
export const STATUS_NOTE:Record<TutorStatus,string>={
 draft:'Add a headline, bio, at least one skill and an hourly rate to submit your profile for review.',
 submitted:'Your profile is waiting for review. Learners will find you once it is approved.',
 approved:'Your profile is live. Learners can find and book you.',
 rejected:'Your profile needs changes. Save it again to resubmit it for review.',
};

/** Every profile tab edits one draft, so switching tabs keeps unsaved changes. */
function TutorProfileForm({tab}:{tab:string}){
 const[draft,setDraft]=useState<TutorProfileInput|null>(null);
 const[status,setStatus]=useState<TutorStatus>('draft');
 useEffect(()=>{
  tutorService.myProfile().then(p=>{setDraft(p?toInput(p):EMPTY_PROFILE);setStatus(p?.status??'draft')}).catch(()=>setDraft(EMPTY_PROFILE));
 },[]);
 if(!draft)return <div className="settings-form"><p className="skill-picker-status">Loading your profile…</p></div>;

 const set=<K extends keyof TutorProfileInput>(key:K,value:TutorProfileInput[K])=>setDraft({...draft,[key]:value});
 const save=async()=>{const saved=await tutorService.saveProfile({...draft,languages:draft.languages.map(x=>x.trim()).filter(Boolean)});setStatus(saved.status??status);return saved.status==='submitted'&&status!=='submitted'?'Profile submitted for review':'Profile saved'};
 const chosen=new Set(draft.skills.map(s=>s.code));
 const toggle=(code:string)=>set('skills',chosen.has(code)?draft.skills.filter(s=>s.code!==code):[...draft.skills,{code,yearsExperience:draft.yearsOfExperience,isPrimary:draft.skills.length===0}]);
 const note=<div className="profile-strength"><div><strong>Profile status</strong><span className={`status ${status}`}>{status.toUpperCase()}</span></div><small>{STATUS_NOTE[status]}</small></div>;

 if(tab==='SKILLS')return <SettingsForm key={tab} title="Skills" text="The first skill you pick is shown as your speciality." onSave={save}>
  {note}
  <SkillPicker chosen={draft.skills.map(s=>s.code)} onToggle={toggle}/>
 </SettingsForm>;
 if(tab==='EXPERIENCE')return <SettingsForm key={tab} title="Experience" text="Tell learners what you have built and taught." onSave={save}>
  {note}
  <label>Years of experience<input type="number" min={0} value={draft.yearsOfExperience} onChange={e=>set('yearsOfExperience',Number(e.target.value))}/></label>
  <label>Teaching experience<textarea value={draft.teachingExperience} onChange={e=>set('teachingExperience',e.target.value)}/></label>
  <label>Languages you teach in<input value={draft.languages.join(', ')} onChange={e=>set('languages',e.target.value.split(',').map(x=>x.trimStart()))} placeholder="English, French"/></label>
 </SettingsForm>;
 if(tab==='PRICING')return <SettingsForm key={tab} title="Pricing" text="Rates are in US dollars. You are billed per minute taught." onSave={save}>
  {note}
  <div className="two"><label>Hourly rate<input type="number" min={0} step="0.01" value={draft.hourlyRate} onChange={e=>set('hourlyRate',Number(e.target.value))}/></label><label>Trial rate<input type="number" min={0} step="0.01" value={draft.trialRate} onChange={e=>set('trialRate',Number(e.target.value))}/></label></div>
 </SettingsForm>;
 if(tab==='PORTFOLIO')return <SettingsForm key={tab} title="Portfolio" text="Links that show your work." onSave={save}>
  {note}
  <label>GitHub<input type="url" value={draft.githubUrl} onChange={e=>set('githubUrl',e.target.value)} placeholder="https://github.com/you"/></label>
  <label>Portfolio<input type="url" value={draft.portfolioUrl} onChange={e=>set('portfolioUrl',e.target.value)}/></label>
  <label>LinkedIn<input type="url" value={draft.linkedinUrl} onChange={e=>set('linkedinUrl',e.target.value)}/></label>
 </SettingsForm>;
 return <SettingsForm key={tab} title="Headline & bio" text="The first thing learners read about you." onSave={save}>
  {note}
  <label>Professional headline<input value={draft.headline} onChange={e=>set('headline',e.target.value)} placeholder="Python & data science tutor"/></label>
  <label>Biography<textarea value={draft.bio} onChange={e=>set('bio',e.target.value)}/></label>
 </SettingsForm>;
}

const PREFERENCE_LABELS:[keyof NotificationPreferences,string,string][]=[
 ['lessons','Lesson reminders','Bookings, changes and reminders before a lesson.'],
 ['messages','New messages','When someone sends you a message.'],
 ['assignments','Assignment updates','Deadlines, feedback, and submission changes.'],
 ['recommendations','Recommendations','Occasional suggestions based on your goals.'],
];

function NotificationsForm(){
 const[prefs,setPrefs]=useState<NotificationPreferences|null>(null);
 useEffect(()=>{authService.notificationPreferences().then(setPrefs).catch(()=>setPrefs(null))},[]);
 if(!prefs)return <div className="settings-form"><p className="skill-picker-status">Loading your preferences…</p></div>;
 return <SettingsForm title="Notification preferences" text="Choose which updates we send you." onSave={async()=>{setPrefs(await authService.saveNotificationPreferences(prefs));return'Preferences saved'}}>
  <div className="settings-toggles">{PREFERENCE_LABELS.map(([key,title,text])=><label key={key}><span><strong>{title}</strong><small>{text}</small></span><input type="checkbox" checked={prefs[key]} onChange={e=>setPrefs({...prefs,[key]:e.target.checked})}/></label>)}</div>
 </SettingsForm>;
}

function SecurityForm(){
 const[form,setForm]=useState({current:'',next:'',confirm:''});
 const save=async()=>{
  if(form.next.length<8)throw new Error('Your new password must be at least 8 characters');
  if(form.next!==form.confirm)throw new Error('The new passwords do not match');
  await authService.changePassword(form.current,form.next);
  setForm({current:'',next:'',confirm:''});
  return'Password changed. Other devices have been signed out.';
 };
 return <SettingsForm title="Security" text="Changing your password signs out every other device." submitLabel="Change password" onSave={save}>
  <label>Current password<input type="password" autoComplete="current-password" value={form.current} onChange={e=>setForm({...form,current:e.target.value})} required/></label>
  <div className="two"><label>New password<input type="password" autoComplete="new-password" value={form.next} onChange={e=>setForm({...form,next:e.target.value})} placeholder="At least 8 characters" required/></label><label>Confirm new password<input type="password" autoComplete="new-password" value={form.confirm} onChange={e=>setForm({...form,confirm:e.target.value})} required/></label></div>
 </SettingsForm>;
}
