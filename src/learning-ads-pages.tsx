import{useState}from'react';
import{CalendarClock,Check,Megaphone,Send,Users}from'lucide-react';
import{DashboardShell,SkillBadge,StatCard,Stars}from'./components';
import{useToast}from'./ui-feedback';
import{useLoader,useOwner,type WorkspaceRole}from'./hooks/use-payments';
import{learningAdsService}from'./services/learning-ads.service';
import{walletService}from'./services/wallet.service';
import{CURRENCIES,CURRENCY_CODES,formatMoney,prorate,relativeTime,toMinor}from'./lib/money';
import{tutors}from'./data/mock';
import type{LearningAd,TutorApplication}from'./types/learning-ads';
import type{CurrencyCode}from'./types/payments';

const skills=['React','TypeScript','Python','JavaScript','Node.js','Data Science','Machine Learning','Cloud & DevOps','React Native','SQL'];
const applicationTone:Record<TutorApplication['status'],string>={APPLIED:'applied',SHORTLISTED:'shortlisted',ACCEPTED:'accepted',DECLINED:'declined',WITHDRAWN:'withdrawn'};

/** What a session at this ad's rate will actually cost, shown before anybody commits to it. */
function RateLine({ad}:{ad:LearningAd}){
 return <div className="ad-rate">
  <strong>{formatMoney(ad.hourlyRate,ad.currency)}</strong><span>/hour</span>
  <i>{ad.sessionMinutes} min session · {formatMoney(prorate(ad.hourlyRate,ad.sessionMinutes),ad.currency)} per session</i>
 </div>;
}

export function LearnerAdsPage(){
 const owner=useOwner('student');
 const toast=useToast();
 const[composing,setComposing]=useState(false);
 const[openAd,setOpenAd]=useState<string|null>(null);

 const ads=useLoader(()=>learningAdsService.byLearner(owner.ownerId),[owner.ownerId]);
 const rows=ads.data??[];

 return <DashboardShell role="student">
  <div className="dash-welcome">
   <div><h1>Learning ads</h1><p>Post what you want to learn and the hourly rate you are willing to pay. Tutors apply, you choose, and the session is booked at your rate.</p></div>
   <button className="btn" onClick={()=>setComposing(true)}><Megaphone size={16}/> Post a learning ad</button>
  </div>

  <div className="stats-grid">
   <StatCard label="Open ads" value={String(rows.filter(a=>a.status==='OPEN').length)} trend="Taking applications" icon={<Megaphone/>}/>
   <StatCard label="Applications" value={String(rows.reduce((sum,a)=>sum+a.applicationCount,0))} trend="From tutors" icon={<Users/>}/>
   <StatCard label="Filled" value={String(rows.filter(a=>a.status==='FILLED').length)} trend="Sessions booked" icon={<Check/>}/>
  </div>

  {ads.error&&<p className="ledger-error">{ads.error}</p>}
  <div className="panel wallet-panel">
   <h3>Your ads</h3>
   {ads.loading&&!rows.length?<p className="org-empty">Loading your ads…</p>
    :!rows.length?<p className="org-empty">No ads yet. Post one to let tutors come to you.</p>
    :<div className="ad-list">{rows.map(ad=><article key={ad.id} className="ad-card">
     <div className="ad-head">
      <div><h4>{ad.title}</h4><p>{ad.description}</p></div>
      <span className={`ledger-status ${ad.status.toLowerCase()}`}>{ad.status.toLowerCase()}</span>
     </div>
     <div className="ad-meta"><SkillBadge>{ad.skill}</SkillBadge><span>{ad.level}</span><span><CalendarClock size={13}/> {ad.preferredTimes}</span><span>closes {relativeTime(ad.closesAt)}</span></div>
     <RateLine ad={ad}/>
     <div className="ad-actions">
      <button type="button" className="btn ghost" onClick={()=>setOpenAd(openAd===ad.id?null:ad.id)}>{openAd===ad.id?'Hide applicants':`View applicants (${ad.applicationCount})`}</button>
      {ad.status==='OPEN'&&<button type="button" className="text-danger" onClick={async()=>{
       try{await learningAdsService.close(ad.id);await ads.reload();toast('Ad closed')}
       catch(problem){toast(problem instanceof Error?problem.message:'Could not close that ad')}
      }}>Close ad</button>}
     </div>
     {openAd===ad.id&&<Applicants ad={ad} onChanged={()=>ads.reload()}/>}
    </article>)}</div>}
  </div>

  {composing&&<AdComposer ownerId={owner.ownerId} ownerName={owner.name} onClose={()=>setComposing(false)} onDone={async()=>{await ads.reload();toast('Learning ad posted')}}/>}
 </DashboardShell>;
}

function Applicants({ad,onChanged}:{ad:LearningAd;onChanged:()=>Promise<unknown>}){
 const toast=useToast();
 const[busy,setBusy]=useState(false);
 const applications=useLoader(()=>learningAdsService.applications(ad.id),[ad.id]);
 const rows=applications.data??[];

 const act=async(work:()=>Promise<unknown>,message:string)=>{
  setBusy(true);
  try{await work();await applications.reload();await onChanged();toast(message)}
  catch(problem){toast(problem instanceof Error?problem.message:'That action did not go through')}
  finally{setBusy(false)}
 };

 if(applications.loading&&!rows.length)return <p className="org-empty">Loading applicants…</p>;
 if(!rows.length)return <p className="org-empty">No tutor has applied yet.</p>;

 return <div className="applicant-list">{rows.map(application=><div key={application.id} className="applicant">
  <div className="avatar sm">{application.tutorName.split(' ').map(part=>part[0]).join('')}</div>
  <div className="applicant-body">
   <div className="applicant-head"><strong>{application.tutorName}</strong><Stars rating={application.rating}/><span className={`ledger-status ${applicationTone[application.status]}`}>{applicationTone[application.status]}</span></div>
   <small>{application.headline}</small>
   <p>“{application.message}”</p>
  </div>
  {ad.status==='OPEN'&&application.status!=='DECLINED'&&<div className="applicant-actions">
   {/* Accepting books the session at the ad's rate and escrows it immediately. */}
   <button type="button" className="btn small" disabled={busy} onClick={()=>act(()=>learningAdsService.accept(application.id),`Session booked with ${application.tutorName} — ${formatMoney(prorate(ad.hourlyRate,ad.sessionMinutes),ad.currency)} held in escrow`)}>Accept &amp; book</button>
   {application.status==='APPLIED'&&<button type="button" className="btn small ghost" disabled={busy} onClick={()=>act(()=>learningAdsService.shortlist(application.id),'Tutor shortlisted')}>Shortlist</button>}
   <button type="button" className="text-danger" disabled={busy} onClick={()=>act(()=>learningAdsService.decline(application.id),'Application declined')}>Decline</button>
  </div>}
 </div>)}</div>;
}

function AdComposer({ownerId,ownerName,onClose,onDone}:{ownerId:string;ownerName:string;onClose:()=>void;onDone:()=>Promise<void>}){
 const[form,setForm]=useState({title:'',description:'',skill:skills[0]!,level:'Intermediate' as LearningAd['level'],currency:'USD' as CurrencyCode,rate:'',sessionMinutes:60,preferredTimes:''});
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);
 const wallets=useLoader(()=>walletService.list(ownerId),[ownerId]);
 const set=<K extends keyof typeof form>(key:K,value:(typeof form)[K])=>setForm(current=>({...current,[key]:value}));

 const hourly=toMinor(form.rate,form.currency);
 const perSession=hourly>0?prorate(hourly,form.sessionMinutes):0;
 const wallet=wallets.data?.find(w=>w.currency===form.currency);
 const short=Boolean(wallet)&&wallet!.available<perSession;

 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();
  if(!form.title.trim()){setError('Give your ad a title.');return}
  if(hourly<=0){setError('Set the hourly rate you are willing to pay.');return}
  setBusy(true);
  try{
   await learningAdsService.create({learnerId:ownerId,learnerName:ownerName,title:form.title,description:form.description,skill:form.skill,level:form.level,currency:form.currency,hourlyRate:hourly,sessionMinutes:form.sessionMinutes,preferredTimes:form.preferredTimes});
   await onDone();
   onClose();
  }catch(problem){setError(problem instanceof Error?problem.message:'The ad could not be posted.')}
  finally{setBusy(false)}
 };

 return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
  <form className="modal wallet-modal wide" onMouseDown={event=>event.stopPropagation()} onSubmit={submit}>
   <h2>Post a learning ad</h2>
   <p>Tutors apply to your ad, and whoever you accept is paid at the rate you set here.</p>
   <label>Title<input value={form.title} onChange={event=>set('title',event.target.value)} placeholder="Weekly React and TypeScript coaching" autoFocus/></label>
   <label>What do you want to work on?<textarea value={form.description} onChange={event=>set('description',event.target.value)} rows={3} placeholder="Describe your goal, your current level, and what a good session looks like…"/></label>
   <div className="modal-row">
    <label>Subject<select value={form.skill} onChange={event=>set('skill',event.target.value)}>{skills.map(skill=><option key={skill}>{skill}</option>)}</select></label>
    <label>Level<select value={form.level} onChange={event=>set('level',event.target.value as LearningAd['level'])}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
   </div>
   <div className="modal-row">
    <label>Currency<select value={form.currency} onChange={event=>set('currency',event.target.value as CurrencyCode)}>{CURRENCY_CODES.map(code=><option key={code} value={code}>{code} · {CURRENCIES[code].name}</option>)}</select></label>
    <label>Your hourly rate<input inputMode="decimal" value={form.rate} onChange={event=>set('rate',event.target.value)} placeholder="36.00"/></label>
    <label>Session length<select value={form.sessionMinutes} onChange={event=>set('sessionMinutes',Number(event.target.value))}><option value={30}>30 minutes</option><option value={60}>60 minutes</option><option value={90}>90 minutes</option></select></label>
   </div>
   <label>Preferred times<input value={form.preferredTimes} onChange={event=>set('preferredTimes',event.target.value)} placeholder="Weekday evenings, Europe/London"/></label>
   {perSession>0&&<small className="modal-hint">A {form.sessionMinutes}-minute session costs {formatMoney(perSession,form.currency)}, escrowed from your {form.currency} wallet when you accept a tutor.{short&&' Your balance will not cover that yet.'}</small>}
   {error&&<p className="ledger-error">{error}</p>}
   <div><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy?'Posting…':'Post ad'}</button></div>
  </form>
 </div>;
}

export function TutorAdBoardPage({role='tutor'}:{role?:WorkspaceRole}){
 const owner=useOwner(role);
 const toast=useToast();
 const[skill,setSkill]=useState('');
 const[applyTo,setApplyTo]=useState<LearningAd|null>(null);

 const board=useLoader(()=>learningAdsService.board(skill||undefined),[skill]);
 const mine=useLoader(()=>learningAdsService.byTutor(owner.ownerId),[owner.ownerId]);
 const ads=board.data??[];
 const applications=mine.data??[];
 const appliedTo=new Set(applications.filter(a=>a.status!=='WITHDRAWN').map(a=>a.adId));

 return <DashboardShell role={role}>
  <div className="dash-welcome"><div>
   <h1>Learning ad board</h1>
   <p>Learners post what they want to learn and what they will pay per hour. Apply, and if they accept you teach at their rate.</p>
  </div></div>

  <div className="panel wallet-panel">
   <div className="panel-head">
    <h3>Open ads</h3>
    <label className="inline-select">Subject
     <select value={skill} onChange={event=>setSkill(event.target.value)}>
      <option value="">All subjects</option>
      {skills.map(item=><option key={item} value={item}>{item}</option>)}
     </select>
    </label>
   </div>
   {board.loading&&!ads.length?<p className="org-empty">Loading the board…</p>
    :!ads.length?<p className="org-empty">No open ads in this subject right now.</p>
    :<div className="ad-list">{ads.map(ad=><article key={ad.id} className="ad-card">
     <div className="ad-head"><div><h4>{ad.title}</h4><p>{ad.description}</p></div></div>
     <div className="ad-meta"><SkillBadge>{ad.skill}</SkillBadge><span>{ad.level}</span><span>{ad.learnerName}</span><span><CalendarClock size={13}/> {ad.preferredTimes}</span><span>{ad.applicationCount} applied</span></div>
     <RateLine ad={ad}/>
     <div className="ad-actions">
      {appliedTo.has(ad.id)
       ?<span className="applied-note"><Check size={14}/> You have applied</span>
       :<button type="button" className="btn" onClick={()=>setApplyTo(ad)}><Send size={15}/> Apply to teach</button>}
     </div>
    </article>)}</div>}
  </div>

  <div className="panel wallet-panel">
   <h3>Your applications</h3>
   {!applications.length?<p className="org-empty">You have not applied to any ad yet.</p>
    :<table className="org-table"><thead><tr><th>Ad</th><th>Message</th><th>Status</th></tr></thead><tbody>
     {applications.map(application=><tr key={application.id}>
      <td><strong>{ads.find(ad=>ad.id===application.adId)?.title??application.adId}</strong><span>{relativeTime(application.createdAt)}</span></td>
      <td>{application.message}</td>
      <td><span className={`ledger-status ${applicationTone[application.status]}`}>{applicationTone[application.status]}</span></td>
     </tr>)}
    </tbody></table>}
  </div>

  {applyTo&&<ApplyDialog ad={applyTo} tutorId={owner.ownerId} tutorName={owner.name} onClose={()=>setApplyTo(null)}
   onDone={async()=>{await Promise.all([board.reload(),mine.reload()]);toast('Application sent')}}/>}
 </DashboardShell>;
}

function ApplyDialog({ad,tutorId,tutorName,onClose,onDone}:{ad:LearningAd;tutorId:string;tutorName:string;onClose:()=>void;onDone:()=>Promise<void>}){
 const profile=tutors.find(tutor=>tutor.id===tutorId);
 const[message,setMessage]=useState('');
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);

 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();
  if(message.trim().length<20){setError('Tell the learner how you would run this session.');return}
  setBusy(true);
  try{
   await learningAdsService.apply({adId:ad.id,tutorId,tutorName,headline:profile?.headline??'Programming tutor',rating:profile?.rating??5,message});
   await onDone();
   onClose();
  }catch(problem){setError(problem instanceof Error?problem.message:'The application could not be sent.')}
  finally{setBusy(false)}
 };

 return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
  <form className="modal wallet-modal" onMouseDown={event=>event.stopPropagation()} onSubmit={submit}>
   <h2>Apply to teach</h2>
   <p>{ad.title} · {formatMoney(ad.hourlyRate,ad.currency)}/hour · {ad.sessionMinutes} minutes</p>
   <label>Your message
    <textarea value={message} onChange={event=>setMessage(event.target.value)} rows={4} placeholder="How you would approach this, and what you have taught like it before…" autoFocus/>
   </label>
   <small className="modal-hint">If {ad.learnerName} accepts, the session is booked at their advertised rate of {formatMoney(ad.hourlyRate,ad.currency)} per hour and you are paid for the minutes you teach, minus the platform fee.</small>
   {error&&<p className="ledger-error">{error}</p>}
   <div><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy?'Sending…':'Send application'}</button></div>
  </form>
 </div>;
}
