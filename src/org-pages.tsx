import{useState}from'react';
import{Link,useNavigate,useParams}from'react-router-dom';
import{Building2,Check,Copy,Mail,Trash2}from'lucide-react';
import{DashboardShell}from'./components';
import{useAuth}from'./auth';
import{useToast}from'./ui-feedback';
import{useLoader}from'./hooks/use-payments';
import{Dialog}from'./lessons-page';
import{StarRow}from'./reviews-pages';
import{inviteLink,orgService,type OrgInvite,type OrgMember,type Organisation}from'./services/org.service';
import{ledgerService}from'./services/ledger.service';
import{formatMoney}from'./lib/money';
import type{CurrencyCode}from'./types/payments';

const errorOf=(problem:unknown,fallback:string)=>problem instanceof Error?problem.message:fallback;
const initials=(name:string)=>name.split(' ').map(part=>part[0]??'').join('').slice(0,2).toUpperCase();
const day=(iso:string)=>new Date(iso).toLocaleDateString('en',{day:'numeric',month:'short'});

/** The organisation's name as a monogram tile, the way a team sheet is headed. */
function Crest({org,text}:{org:Organisation;text:string}){
 return <header className="crest">
  <span className="crest-mark">{initials(org.name)}</span>
  <div><small>{org.role==='owner'?'YOUR ORGANISATION':'YOU TEACH UNDER'}</small><h1>{org.name}</h1><p>{text}</p></div>
 </header>;
}

/** A row of plain figures: big number, hairline, label. No boxes. */
function Figures({items}:{items:[string,string][]}){
 return <div className="figures">{items.map(([value,label])=><div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>;
}

/** The roster as a team sheet: a number each, what they teach, and what they have taught for you. */
function SquadSheet({members,canRemove,onChange}:{members:OrgMember[];canRemove:boolean;onChange:()=>Promise<unknown>}){
 if(!members.length)return <p className="org-empty">Nobody on the roster yet.</p>;
 return <ol className="squad">{members.map((member,index)=>
  <MemberRow key={member.id} member={member} number={index+1} canRemove={canRemove} onChange={onChange}/>)}</ol>;
}

function MemberRow({member,number,canRemove,onChange}:{member:OrgMember;number:number;canRemove:boolean;onChange:()=>Promise<unknown>}){
 const toast=useToast();
 const[busy,setBusy]=useState(false);
 const[confirming,setConfirming]=useState(false);
 const remove=async()=>{
  setBusy(true);
  try{await orgService.remove(member.id);toast(`${member.name} is off the roster`);await onChange()}
  catch(problem){toast(errorOf(problem,'That did not work. Try again.'))}
  finally{setBusy(false);setConfirming(false)}
 };

 return <li className={`squad-row role-${member.role}`}>
  <span className="squad-number">{number}</span>
  <div className="squad-who">
   <strong>{member.name}{member.role==='owner'&&<i>owner</i>}</strong>
   <small>{member.headline||member.email}</small>
   {member.reviewCount>0&&<span className="squad-rating"><StarRow rating={Math.round(member.rating)}/> {member.rating.toFixed(2)} · {member.reviewCount}</span>}
   {member.role==='trainer'&&!member.approved&&<span className="squad-note">Profile not approved yet, so they cannot be booked.</span>}
  </div>
  <dl className="squad-figures">
   <div><dt>Taught</dt><dd>{member.taught}</dd></div>
   <div><dt>Ahead</dt><dd>{member.upcoming}</dd></div>
   <div><dt>Earned</dt><dd>{member.currency?formatMoney(member.earned,member.currency as CurrencyCode):'—'}</dd></div>
   <div><dt>Joined</dt><dd>{day(member.joinedAt)}</dd></div>
  </dl>
  {canRemove&&member.role==='trainer'&&<button className="text-danger" disabled={busy} onClick={()=>setConfirming(true)}>Remove</button>}
  {confirming&&<Dialog title={`Remove ${member.name}?`} text="Sessions they have already taught stay with you. Anything they teach afterwards is paid into their own wallet." onClose={()=>setConfirming(false)}>
   <div className="dialog-actions">
    <button className="btn ghost" onClick={()=>setConfirming(false)}>Keep them</button>
    <button className="btn danger" disabled={busy} onClick={remove}>{busy?'Removing…':'Remove from roster'}</button>
   </div>
  </Dialog>}
 </li>;
}

function CopyLink({token}:{token:string}){
 const[copied,setCopied]=useState(false);
 const copy=async()=>{
  try{await navigator.clipboard.writeText(inviteLink(token))}catch{/* clipboard blocked; the link is shown in full */}
  setCopied(true);
  setTimeout(()=>setCopied(false),2000);
 };
 return <button type="button" className="btn ghost small" onClick={copy}>{copied?<><Check size={14}/> Copied</>:<><Copy size={14}/> Copy link</>}</button>;
}

/** An invitation as an envelope: sealed while it waits, opened once it is answered. */
function Envelope({invite,onChange}:{invite:OrgInvite;onChange:()=>Promise<unknown>}){
 const toast=useToast();
 const[busy,setBusy]=useState(false);
 const revoke=async()=>{
  setBusy(true);
  try{await orgService.revoke(invite.id);toast('Invitation withdrawn');await onChange()}
  catch(problem){toast(errorOf(problem,'That invitation could not be withdrawn.'))}
  finally{setBusy(false)}
 };

 return <article className={`envelope state-${invite.status}`}>
  <strong>{invite.name||invite.email}</strong>
  <small>{invite.email}</small>
  <p>{invite.status==='open'?`Sent ${day(invite.createdAt)} · closes ${day(invite.expiresAt)}`
   :invite.status==='accepted'?`Joined ${invite.acceptedAt?day(invite.acceptedAt):''}`
   :`Closed ${day(invite.expiresAt)}`}</p>
  {invite.status==='open'&&invite.token&&<div className="envelope-actions">
   <CopyLink token={invite.token}/>
   <button type="button" className="icon-danger" aria-label={`Withdraw the invitation to ${invite.email}`} disabled={busy} onClick={revoke}><Trash2 size={15}/></button>
  </div>}
 </article>;
}

function InviteForm({onDone}:{onDone:()=>Promise<unknown>}){
 const toast=useToast();
 const[form,setForm]=useState({email:'',name:''});
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);
 const[sent,setSent]=useState<OrgInvite|null>(null);

 const send=async(event:React.FormEvent)=>{
  event.preventDefault();
  setBusy(true);setError(null);
  try{
   const invite=await orgService.invite(form.email,form.name);
   setSent(invite);
   setForm({email:'',name:''});
   toast(`Invitation sent to ${invite.email}`);
   await onDone();
  }catch(problem){setError(errorOf(problem,'That invitation could not be sent.'))}
  finally{setBusy(false)}
 };

 return <form className="sheet-form invite-form" onSubmit={send}>
  <label>Their email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="trainer@example.com" required/></label>
  <label>Their name <span>optional</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Tomás Rivera"/></label>
  <p className="ad-note">We email them the link. Sessions they teach afterwards are paid into your organisation's wallet.</p>
  {error&&<p className="ledger-error">{error}</p>}
  <button className="btn" disabled={busy}><Mail size={15}/> {busy?'Sending…':'Send invitation'}</button>
  {sent?.token&&<div className="invite-sent">
   <strong><Check size={15}/> Link ready for {sent.email}</strong>
   <code>{inviteLink(sent.token)}</code>
   <CopyLink token={sent.token}/>
  </div>}
 </form>;
}

/** Every org page needs the organisation itself; without one there is nothing to show. */
function useOrganisation(){
 return useLoader(()=>orgService.mine(),[]);
}

function NoOrganisation(){
 return <DashboardShell role="org">
  <div className="workspace-title"><div><h1>Organisation</h1><p>This account does not belong to an organisation. Sign up as an organisation to invite trainers.</p></div></div>
 </DashboardShell>;
}

export function OrgDashboard(){
 const org=useOrganisation();
 const members=useLoader(()=>orgService.members(),[]);
 const earnings=useLoader(()=>ledgerService.earnings(),[]);
 const roster=members.data??[];
 const totals=earnings.data??[];
 const currency=(totals[0]?.currency??'USD') as CurrencyCode;
 const taught=roster.reduce((sum,member)=>sum+member.taught,0);

 if(org.error)return <DashboardShell role="org"><p className="ledger-error">{org.error}</p></DashboardShell>;
 if(!org.data)return org.loading?<DashboardShell role="org"><p className="org-empty">Loading…</p></DashboardShell>:<NoOrganisation/>;

 return <DashboardShell role="org">
  <Crest org={org.data} text="Your trainers teach under this account, and what they earn is paid into its wallet."/>
  <Figures items={[
   [String(org.data.trainers),'trainers'],
   [String(taught),'sessions taught'],
   [String(org.data.openInvites),'invitations waiting'],
   [formatMoney(totals.reduce((sum,line)=>sum+line.available,0),currency),'in the wallet'],
  ]}/>
  <section className="org-section">
   <h2>The roster</h2>
   {members.loading&&!roster.length?<p className="org-empty">Loading your team…</p>:<SquadSheet members={roster} canRemove={false} onChange={members.reload}/>}
   <Link className="text-link" to="/org/trainers">Manage the roster</Link>
  </section>
  <section className="org-section">
   <h2>Money</h2>
   <Figures items={[
    [formatMoney(totals.reduce((sum,line)=>sum+line.pending,0),currency),'clearing after sessions'],
    [formatMoney(totals.reduce((sum,line)=>sum+line.paid,0),currency),'earned so far'],
   ]}/>
   <p className="ad-note">A session is paid into the wallet a day after it is taught, once the learner's window to appeal has passed.</p>
   <Link className="text-link" to="/org/earnings">See every session</Link>
  </section>
 </DashboardShell>;
}

export function OrgTrainers(){
 const org=useOrganisation();
 const members=useLoader(()=>orgService.members(),[]);
 const roster=members.data??[];
 const owner=org.data?.role==='owner';

 if(!org.data)return org.loading?<DashboardShell role="org"><p className="org-empty">Loading…</p></DashboardShell>:<NoOrganisation/>;

 return <DashboardShell role="org">
  <div className="workspace-title">
   <div><h1>Trainers</h1><p>Everyone teaching under {org.data.name}. Sessions they teach are paid into the organisation's wallet.</p></div>
   {owner&&<div><Link className="btn" to="/org/invitations"><Mail size={16}/> Invite a trainer</Link></div>}
  </div>
  {members.error&&<p className="ledger-error">{members.error}</p>}
  {members.loading&&!roster.length?<p className="org-empty">Loading your team…</p>
   :<SquadSheet members={roster} canRemove={owner} onChange={members.reload}/>}
 </DashboardShell>;
}

export function OrgInvitations(){
 const org=useOrganisation();
 const invites=useLoader(()=>orgService.invites(),[]);
 const rows=invites.data??[];
 const waiting=rows.filter(invite=>invite.status==='open');
 const answered=rows.filter(invite=>invite.status!=='open');

 if(!org.data)return org.loading?<DashboardShell role="org"><p className="org-empty">Loading…</p></DashboardShell>:<NoOrganisation/>;
 if(org.data.role!=='owner')return <DashboardShell role="org">
  <div className="workspace-title"><div><h1>Invitations</h1><p>Only the owner of {org.data.name} can invite trainers.</p></div></div>
 </DashboardShell>;

 return <DashboardShell role="org">
  <div className="workspace-title"><div><h1>Invitations</h1><p>Invite a trainer by email. They accept through the link, and join the roster with a teaching workspace of their own.</p></div></div>
  <div className="invite-layout">
   <InviteForm onDone={invites.reload}/>
   <div className="org-section">
    <h2>Waiting {waiting.length>0&&<i>{waiting.length}</i>}</h2>
    {invites.error&&<p className="ledger-error">{invites.error}</p>}
    {!waiting.length?<p className="org-empty">No invitations waiting.</p>
     :<div className="envelopes">{waiting.map(invite=><Envelope key={invite.id} invite={invite} onChange={invites.reload}/>)}</div>}
    {answered.length>0&&<>
     <h2>Answered</h2>
     <div className="envelopes">{answered.map(invite=><Envelope key={invite.id} invite={invite} onChange={invites.reload}/>)}</div>
    </>}
   </div>
  </div>
 </DashboardShell>;
}

/** The invitation link. Anyone can read it; accepting needs the invited account signed in. */
export function AcceptInvitePage(){
 const{token=''}=useParams();
 const{user}=useAuth();
 const navigate=useNavigate();
 const toast=useToast();
 const invite=useLoader(()=>orgService.preview(token),[token]);
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);

 const accept=async()=>{
  setBusy(true);setError(null);
  try{
   const org=await orgService.accept(token);
   toast(`You now teach under ${org.name}`);
   navigate('/tutor/dashboard');
  }catch(problem){setError(errorOf(problem,'That invitation could not be accepted.'))}
  finally{setBusy(false)}
 };

 return <main className="auth">
  <Link to="/" className="auth-logo"><Building2/> pairlore</Link>
  <section className="auth-card invite-card">
   {invite.loading?<p className="org-empty">Opening the invitation…</p>
    :!invite.data?<><h1>This invitation is closed</h1><p>{invite.error??'Ask the organisation for a new link.'}</p><Link className="btn wide" to="/">Back home</Link></>
    :<>
     <span className="crest-mark">{initials(invite.data.organisation??'')}</span>
     <h1>{invite.data.organisation} invited you to teach</h1>
     <p>The invitation was sent to <strong>{invite.data.email}</strong>. Sessions you teach for them are paid into the organisation's wallet; your own bookings stay yours.</p>
     {error&&<p className="ledger-error">{error}</p>}
     {user?<button className="btn wide" disabled={busy} onClick={accept}>{busy?'Joining…':'Accept and join'}</button>
      :<div className="invite-choices">
       <Link className="btn wide" to={`/signup?invite=${token}`}>Create an account</Link>
       <Link className="btn ghost wide" to={`/login?invite=${token}`}>I already have one</Link>
      </div>}
    </>}
  </section>
 </main>;
}
