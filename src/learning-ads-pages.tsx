import{useState}from'react';
import{Link}from'react-router-dom';
import{CalendarClock,Check,Megaphone,Send}from'lucide-react';
import{DashboardShell}from'./components';
import{useToast}from'./ui-feedback';
import{useLoader}from'./hooks/use-payments';
import{Dialog}from'./lessons-page';
import{StarRow}from'./reviews-pages';
import{adsService,type AdApplication,type AdLevel,type LearningAd}from'./services/learning-ads.service';
import{tutorService}from'./services/tutor.service';
import{walletService}from'./services/wallet.service';
import{CURRENCY_CODES,formatMoney,prorate,toMinor}from'./lib/money';
import type{CurrencyCode}from'./types/payments';

const TABS=6;
const LEVELS:AdLevel[]=['beginner','intermediate','advanced'];
const LENGTHS=[30,60,90,120,180,240];
const errorOf=(problem:unknown,fallback:string)=>problem instanceof Error?problem.message:fallback;
const when=(iso:string)=>new Date(iso).toLocaleString('en',{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
const firstName=(name:string)=>name.split(' ')[0]??name;
const STAMP:Record<AdApplication['status'],string>={applied:'',shortlisted:'Shortlisted',accepted:'Booked',declined:'Declined',withdrawn:'Withdrawn'};

/** An ad drawn as a paper flyer. The tabs along the bottom tear off as tutors apply. */
function Flyer({ad,children}:{ad:LearningAd;children?:React.ReactNode}){
 const rate=`${formatMoney(ad.hourlyRate,ad.currency)}/h`;
 return <article className={`flyer state-${ad.status}`}>
  <div className="flyer-body">
   {ad.status!=='open'&&<span className="flyer-stamp">{ad.status}</span>}
   <small className="flyer-kicker">{ad.skill} · {ad.level}</small>
   <h3>{ad.title}</h3>
   {ad.description&&<p>{ad.description}</p>}
   <dl className="flyer-facts">
    <div><dt>Pays</dt><dd>{rate}</dd></div>
    <div><dt>Session</dt><dd>{ad.sessionMinutes} min · {formatMoney(ad.sessionCost,ad.currency)}</dd></div>
    {ad.preferredTimes&&<div><dt>When</dt><dd>{ad.preferredTimes}</dd></div>}
    <div><dt>Applied</dt><dd>{ad.applications}</dd></div>
   </dl>
   {children}
  </div>
  <div className="tear-tabs" aria-hidden="true">
   {Array.from({length:TABS},(_,tab)=><span key={tab} className={tab<ad.applications?'torn':''}>{rate} · {firstName(ad.learner.name)}</span>)}
  </div>
 </article>;
}

export function LearnerAdsPage(){
 const ads=useLoader(()=>adsService.mine(),[]);
 const wallets=useLoader(()=>walletService.list(),[]);
 const[composing,setComposing]=useState(false);
 const rows=ads.data??[];
 const balance=(currency:CurrencyCode)=>(wallets.data??[]).find(w=>w.currency===currency)?.available??0;

 return <DashboardShell role="student">
  <div className="workspace-title">
   <div><h1>Learning ads</h1><p>Say what you want to learn and what you will pay an hour. Tutors apply with a time, you pick one, and the session is booked at your rate.</p></div>
   <div><button className="btn" onClick={()=>setComposing(true)}><Megaphone size={16}/> Post an ad</button></div>
  </div>
  {ads.error&&<p className="ledger-error">{ads.error}</p>}
  {ads.loading&&!rows.length?<p className="board-note">Loading your ads…</p>
   :!rows.length?<p className="board-note">Nothing pinned up yet. Post an ad and tutors come to you.</p>
   :<div className="noticeboard my-ads">{rows.map(ad=><div key={ad.id} className="my-ad">
    <Flyer ad={ad}>
     {ad.status==='open'&&<div className="flyer-actions"><CloseAd ad={ad} onDone={ads.reload}/></div>}
    </Flyer>
    {ad.applications>0?<Replies ad={ad} balance={balance(ad.currency)} onChange={async()=>{await Promise.all([ads.reload(),wallets.reload()])}}/>
     :<p className="board-note">{ad.status==='open'?`No one has applied yet. It stays on the board until ${new Date(ad.closesAt).toLocaleDateString('en',{day:'numeric',month:'long'})}.`:'Nobody applied.'}</p>}
   </div>)}</div>}
  {composing&&<Dialog title="Post a learning ad" text="Tutors apply to it, and whoever you accept is paid the rate you set here." onClose={()=>setComposing(false)}>
   <AdForm balance={balance} onDone={async()=>{setComposing(false);await ads.reload()}}/>
  </Dialog>}
 </DashboardShell>;
}

function CloseAd({ad,onDone}:{ad:LearningAd;onDone:()=>Promise<unknown>}){
 const toast=useToast();
 const[busy,setBusy]=useState(false);
 const close=async()=>{
  setBusy(true);
  try{await adsService.close(ad.id);toast('Ad taken down');await onDone()}
  catch(problem){toast(errorOf(problem,'That ad could not be closed.'))}
  finally{setBusy(false)}
 };
 return <button className="text-danger" disabled={busy} onClick={close}>Take it down</button>;
}

/** The learner's side of the applications: each one a slip torn from the flyer. */
function Replies({ad,balance,onChange}:{ad:LearningAd;balance:number;onChange:()=>Promise<void>}){
 const replies=useLoader(()=>adsService.applications(ad.id),[ad.id]);
 const rows=replies.data??[];
 const reload=async()=>{await Promise.all([replies.reload(),onChange()])};
 if(replies.loading&&!rows.length)return <p className="board-note">Loading replies…</p>;
 return <div className="replies">
  {replies.error&&<p className="ledger-error">{replies.error}</p>}
  {ad.status==='open'&&balance<ad.sessionCost&&<p className="ad-warn">Your balance does not cover a session yet. <Link to="/student/wallet">Top up</Link> before you accept.</p>}
  {rows.map(application=><Reply key={application.id} ad={ad} application={application} short={balance<ad.sessionCost} onChange={reload}/>)}
 </div>;
}

function Reply({ad,application,short,onChange}:{ad:LearningAd;application:AdApplication;short:boolean;onChange:()=>Promise<void>}){
 const toast=useToast();
 const[busy,setBusy]=useState<string|null>(null);
 const[error,setError]=useState<string|null>(null);
 const live=ad.status==='open'&&(application.status==='applied'||application.status==='shortlisted');
 const act=async(key:string,run:()=>Promise<unknown>,done:string)=>{
  setBusy(key);setError(null);
  try{await run();toast(done);await onChange()}
  catch(problem){setError(errorOf(problem,'That did not work. Try again.'))}
  finally{setBusy(null)}
 };

 return <article className={`reply-slip state-${application.status}`}>
  {STAMP[application.status]&&<span className="slip-stamp">{STAMP[application.status]}</span>}
  <header>
   <Link to={`/tutors/${application.tutor.id}`}><strong>{application.tutor.name}</strong></Link>
   {application.reviewCount>0&&<StarRow rating={Math.round(application.rating)}/>}
  </header>
  {application.headline&&<small>{application.headline}</small>}
  <blockquote>{application.message}</blockquote>
  <p className="slip-time"><CalendarClock size={14}/> First session {when(application.startsAt)}</p>
  {error&&<p className="ledger-error">{error}</p>}
  {live&&<div className="slip-actions">
   <button className="btn small" disabled={Boolean(busy)||short} onClick={()=>act('accept',()=>adsService.accept(application.id),`Booked with ${application.tutor.name}`)}>
    {busy==='accept'?'Booking…':`Accept and pay ${formatMoney(ad.sessionCost,ad.currency)}`}</button>
   {application.status==='applied'&&<button className="btn small ghost" disabled={Boolean(busy)} onClick={()=>act('shortlist',()=>adsService.shortlist(application.id),'Shortlisted')}>Shortlist</button>}
   <button className="text-danger" disabled={Boolean(busy)} onClick={()=>act('decline',()=>adsService.decline(application.id),'Application declined')}>Decline</button>
  </div>}
  {application.status==='accepted'&&<Link className="text-link" to="/student/lessons">See it in your lessons</Link>}
 </article>;
}

function AdForm({balance,onDone}:{balance:(currency:CurrencyCode)=>number;onDone:()=>Promise<void>}){
 const toast=useToast();
 const skills=useLoader(()=>tutorService.skills(),[]);
 const[form,setForm]=useState({title:'',description:'',skillCode:'',level:'beginner' as AdLevel,currency:'USD' as CurrencyCode,rate:'',sessionMinutes:60,preferredTimes:''});
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);
 const set=<K extends keyof typeof form>(key:K,value:(typeof form)[K])=>setForm(current=>({...current,[key]:value}));
 const hourly=toMinor(form.rate||0,form.currency);
 const cost=hourly>0?prorate(hourly,form.sessionMinutes):0;

 const send=async(event:React.FormEvent)=>{
  event.preventDefault();
  setBusy(true);setError(null);
  try{
   const{rate:_,...rest}=form;
   await adsService.post({...rest,hourlyRate:hourly});
   toast('Your ad is up on the board');
   await onDone();
  }catch(problem){setError(errorOf(problem,'That ad could not be posted.'))}
  finally{setBusy(false)}
 };

 return <form className="sheet-form ad-form" onSubmit={send}>
  <label>Title<input value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Conversational Spanish for travel" autoFocus/></label>
  <label>What do you want to work on?<textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={3} placeholder="Your goal, where you are now, and what a good session looks like"/></label>
  <div className="schedule-grid">
   <label>Subject<select value={form.skillCode} onChange={e=>set('skillCode',e.target.value)}>
    <option value="">Choose…</option>
    {(skills.data??[]).map(skill=><option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></label>
   <label>Level<select value={form.level} onChange={e=>set('level',e.target.value as AdLevel)}>
    {LEVELS.map(level=><option key={level} value={level}>{level[0]!.toUpperCase()+level.slice(1)}</option>)}</select></label>
   <label>Currency<select value={form.currency} onChange={e=>set('currency',e.target.value as CurrencyCode)}>
    {CURRENCY_CODES.map(code=><option key={code}>{code}</option>)}</select></label>
   <label>You pay an hour<input inputMode="decimal" value={form.rate} onChange={e=>set('rate',e.target.value)} placeholder="30.00"/></label>
   <label>Each session<select value={form.sessionMinutes} onChange={e=>set('sessionMinutes',Number(e.target.value))}>
    {LENGTHS.map(minutes=><option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label>
   <label>Good times <span>optional</span><input value={form.preferredTimes} onChange={e=>set('preferredTimes',e.target.value)} placeholder="Weekday evenings"/></label>
  </div>
  {cost>0&&<p className="ad-note">A session costs {formatMoney(cost,form.currency)}, held from your {form.currency} wallet when you accept a tutor.
   {balance(form.currency)<cost&&' Your balance does not cover that yet.'}</p>}
  {error&&<p className="ledger-error">{error}</p>}
  <button className="btn" disabled={busy}>{busy?'Posting…':'Pin it to the board'}</button>
 </form>;
}

export function TutorAdBoardPage(){
 const[skill,setSkill]=useState('');
 const[applyTo,setApplyTo]=useState<LearningAd|null>(null);
 const skills=useLoader(()=>tutorService.skills(),[]);
 const board=useLoader(()=>adsService.board(skill),[skill]);
 const mine=useLoader(()=>adsService.myApplications(),[]);
 const ads=board.data??[];
 const applications=(mine.data??[]).filter(application=>application.status!=='withdrawn');
 const offerFor=(ad:LearningAd)=>applications.find(application=>application.ad?.id===ad.id);

 return <DashboardShell role="tutor">
  <div className="workspace-title">
   <div><h1>Learning ad board</h1><p>Learners pin up what they want to learn and what they pay an hour. Offer a first session time, and if they accept, it is booked at their rate.</p></div>
   <div><label className="inline-select">Subject<select value={skill} onChange={e=>setSkill(e.target.value)}>
    <option value="">Everything</option>
    {(skills.data??[]).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
  </div>
  {board.error&&<p className="ledger-error">{board.error}</p>}
  <div className="noticeboard">
   {board.loading&&!ads.length?<p className="board-note">Loading the board…</p>
    :!ads.length?<p className="board-note">Nothing pinned up {skill?'in this subject ':''}right now.</p>
    :ads.map(ad=>{
     const offer=offerFor(ad);
     return <Flyer key={ad.id} ad={ad}>
      <div className="flyer-actions">
       {offer?.status==='declined'?<span className="flyer-offered">They went with someone else</span>
        :offer?<><span className="flyer-offered"><Check size={14}/> You offered {when(offer.startsAt)}</span>
         <button className="text-link" onClick={()=>setApplyTo(ad)}>Change</button></>
        :<button className="btn small" onClick={()=>setApplyTo(ad)}><Send size={14}/> Apply to teach</button>}
      </div>
     </Flyer>;
    })}
  </div>

  <section className="my-replies">
   <h2>Your applications</h2>
   {mine.error&&<p className="ledger-error">{mine.error}</p>}
   {!applications.length?<p className="board-note">You have not applied to anything yet.</p>
    :<div className="replies">{applications.map(application=><MyApplication key={application.id} application={application} onChange={async()=>{await Promise.all([mine.reload(),board.reload()])}}/>)}</div>}
  </section>

  {applyTo&&<Dialog title="Apply to teach" text={`${applyTo.title} · ${formatMoney(applyTo.hourlyRate,applyTo.currency)} an hour · ${applyTo.sessionMinutes} minutes`} onClose={()=>setApplyTo(null)}>
   <ApplyForm ad={applyTo} offer={offerFor(applyTo)} onDone={async()=>{setApplyTo(null);await Promise.all([mine.reload(),board.reload()])}}/>
  </Dialog>}
 </DashboardShell>;
}

function MyApplication({application,onChange}:{application:AdApplication;onChange:()=>Promise<void>}){
 const toast=useToast();
 const[busy,setBusy]=useState(false);
 const ad=application.ad;
 const live=application.status==='applied'||application.status==='shortlisted';
 const withdraw=async()=>{
  setBusy(true);
  try{await adsService.withdraw(application.id);toast('Application withdrawn');await onChange()}
  catch(problem){toast(errorOf(problem,'That could not be withdrawn.'))}
  finally{setBusy(false)}
 };
 return <article className={`reply-slip state-${application.status}`}>
  {STAMP[application.status]&&<span className="slip-stamp">{STAMP[application.status]}</span>}
  <header><strong>{ad?.title}</strong></header>
  {ad&&<small>{ad.learner.name} · {formatMoney(ad.sessionCost,ad.currency)} a session</small>}
  <p className="slip-time"><CalendarClock size={14}/> You offered {when(application.startsAt)}</p>
  {live&&<div className="slip-actions"><button className="text-danger" disabled={busy} onClick={withdraw}>Withdraw</button></div>}
  {application.status==='accepted'&&<Link className="text-link" to="/tutor/lessons">See it in your lessons</Link>}
 </article>;
}

// A datetime-local value, in the browser's own timezone.
const localInput=(date:Date)=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);

function ApplyForm({ad,offer,onDone}:{ad:LearningAd;offer?:AdApplication;onDone:()=>Promise<void>}){
 const toast=useToast();
 const[message,setMessage]=useState(offer?.message??'');
 const[startsAt,setStartsAt]=useState(offer?localInput(new Date(offer.startsAt)):'');
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);
 const learner=firstName(ad.learner.name);

 const send=async(event:React.FormEvent)=>{
  event.preventDefault();
  if(!startsAt){setError('Offer a time for the first session.');return}
  setBusy(true);setError(null);
  try{
   await adsService.apply(ad.id,message,new Date(startsAt).toISOString());
   toast(offer?'Your offer is updated':`Application sent to ${learner}`);
   await onDone();
  }catch(problem){setError(errorOf(problem,'The application could not be sent.'))}
  finally{setBusy(false)}
 };

 return <form className="sheet-form" onSubmit={send}>
  {ad.preferredTimes&&<p className="ad-note">{learner} prefers: {ad.preferredTimes}</p>}
  <label>Your message<textarea value={message} onChange={e=>setMessage(e.target.value)} rows={4} placeholder="How you would run the session, and what you have taught like it before" autoFocus/></label>
  <label>First session<input type="datetime-local" min={localInput(new Date())} value={startsAt} onChange={e=>setStartsAt(e.target.value)}/></label>
  <p className="ad-note">If {learner} accepts, this time is booked for {ad.sessionMinutes} minutes and {formatMoney(ad.sessionCost,ad.currency)} is held from their wallet. You are paid for the minutes you teach, less the platform fee.</p>
  {error&&<p className="ledger-error">{error}</p>}
  <button className="btn" disabled={busy}>{busy?'Sending…':offer?'Update my offer':'Send application'}</button>
 </form>;
}
