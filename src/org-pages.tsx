import{useCallback,useEffect,useState}from'react';
import{Check,Copy,GraduationCap,Mail,Plus,Trash2,Users}from'lucide-react';
import{Link}from'react-router-dom';
import{DashboardShell,StatCard}from'./components';
import{useAuth}from'./auth';
import{orgService}from'./services/org.service';
import type{OrgInvite,OrgMember,Organization}from'./types/org';

const inviteLink=(token:string)=>`${location.origin}/signup?invite=${token}`;

/** Shared loader — every org page needs the same three collections. */
function useOrg(){
 const{user}=useAuth();
 const orgId=user?.orgId??'org-northwind';
 const[organisation,setOrganisation]=useState<Organization|null>(null);
 const[members,setMembers]=useState<OrgMember[]>([]);
 const[invites,setInvites]=useState<OrgInvite[]>([]);
 const[loading,setLoading]=useState(true);
 const refresh=useCallback(()=>Promise.all([orgService.organisation(orgId),orgService.members(orgId),orgService.invites(orgId)])
  .then(([org,people,pending])=>{setOrganisation(org);setMembers(people);setInvites(pending)})
  .finally(()=>setLoading(false)),[orgId]);
 useEffect(()=>{void refresh()},[refresh]);
 return{orgId,organisation,members,invites,loading,refresh};
}

function CopyLink({token}:{token:string}){
 const[copied,setCopied]=useState(false);
 const copy=async()=>{
  const link=inviteLink(token);
  try{await navigator.clipboard.writeText(link)}catch{/* clipboard blocked — the link is shown in full below */}
  setCopied(true);
  setTimeout(()=>setCopied(false),2000);
 };
 return <button type="button" className="btn ghost small" onClick={copy}>{copied?<><Check size={14}/> Copied</>:<><Copy size={14}/> Copy link</>}</button>;
}

function OrgHeader({eyebrow,title,text,action}:{eyebrow:string;title:string;text:string;action?:{label:string;to:string}}){return <header className="org-page-head"><div><span>{eyebrow}</span><h1>{title}</h1><p>{text}</p></div>{action&&<Link className="btn" to={action.to}><Plus/> {action.label}</Link>}</header>}

export function OrgDashboard(){
 const{organisation,members,invites,loading}=useOrg();
 const trainers=members.filter(m=>m.role==='TRAINER');
 const pending=invites.filter(i=>i.status==='PENDING');
 return <DashboardShell role="org">
  <div className="org-workspace-page">
  <OrgHeader eyebrow="Organisation overview" title={organisation?.name??'Your organisation'} text="Invite your trainers, keep the roster current, and run their sessions from one account." action={{label:'Invite trainer',to:'/org/invitations'}}/>
  <div className="stats-grid org-stats">
   <StatCard label="Trainers" value={String(trainers.length)} trend={loading?'Loading…':'On the roster'} icon={<GraduationCap/>}/>
   <StatCard label="Pending invitations" value={String(pending.length)} trend={pending.length?'Awaiting acceptance':'All caught up'} icon={<Mail/>}/>
   <StatCard label="Subjects covered" value={String(new Set(trainers.map(t=>t.subject)).size)} trend="Across the team" icon={<Users/>}/>
  </div>
  <div className="panel org-panel">
   <header className="org-panel-head"><div><span>Team directory</span><h2>Trainer roster</h2><p>Everyone currently connected to this organisation.</p></div><strong>{members.length} members</strong></header>
   {loading?<p className="org-empty">Loading your team…</p>:<OrgRoster members={members}/>}
  </div>
  </div>
 </DashboardShell>;
}

function OrgRoster({members}:{members:OrgMember[]}){
 if(!members.length)return <p className="org-empty">No trainers yet. Send your first invitation to get started.</p>;
 return <table className="org-table"><thead><tr><th>Trainer</th><th>Subject</th><th>Role</th><th>Joined</th></tr></thead><tbody>
  {members.map(member=><tr key={member.id}>
   <td><div className="org-person"><i>{member.name.split(' ').map(part=>part[0]).join('').slice(0,2)}</i><span><strong>{member.name}</strong><small>{member.email}</small></span></div></td>
   <td>{member.subject}</td>
   <td><span className={member.role==='OWNER'?'org-tag owner':'org-tag'}>{member.role.toLowerCase()}</span></td>
   <td><time dateTime={member.joinedAt}>{new Date(`${member.joinedAt}T12:00:00`).toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'})}</time></td>
  </tr>)}
 </tbody></table>;
}

export function OrgTrainers(){
 const{members,loading}=useOrg();
 return <DashboardShell role="org">
  <div className="org-workspace-page">
  <OrgHeader eyebrow="People" title="Trainers" text="Everyone teaching under your organisation." action={{label:'Invite trainer',to:'/org/invitations'}}/>
  <div className="panel org-panel"><header className="org-panel-head"><div><span>Team directory</span><h2>All trainers</h2><p>Review teaching areas and organisation access.</p></div><strong>{members.length} members</strong></header>{loading?<p className="org-empty">Loading your team…</p>:<OrgRoster members={members}/>}</div>
  </div>
 </DashboardShell>;
}

export function OrgInvitations(){
 const{orgId,invites,loading,refresh}=useOrg();
 const[form,setForm]=useState({name:'',email:'',subject:''});
 const[busy,setBusy]=useState(false);
 const[created,setCreated]=useState<OrgInvite|null>(null);
 const send=async(event:React.FormEvent)=>{
  event.preventDefault();
  setBusy(true);
  try{
   const invite=await orgService.invite(orgId,form);
   setCreated(invite);
   setForm({name:'',email:'',subject:''});
   await refresh();
  }finally{setBusy(false)}
 };
 const revoke=async(inviteId:string)=>{await orgService.revoke(orgId,inviteId);await refresh()};
 const pending=invites.filter(i=>i.status==='PENDING');
 const accepted=invites.filter(i=>i.status==='ACCEPTED');
 return <DashboardShell role="org">
  <div className="org-workspace-page">
  <OrgHeader eyebrow="Team access" title="Invitations" text="Invite a trainer by email. They accept through the link and join your roster."/>
  <div className="org-invite-layout">
   <form className="panel org-panel" onSubmit={send}>
    <header className="org-panel-head"><div><span>New invitation</span><h2>Invite a trainer</h2><p>Create a secure invitation for your organisation.</p></div><i><Mail/></i></header>
    <label>Full name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Tomás Rivera" required/></label>
    <label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="tomas@example.com" required/></label>
    <label>Subject<input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="Cloud & DevOps" required/></label>
    <button className="btn org-submit" disabled={busy}><Mail/>{busy?'Creating…':'Create invitation'}</button>
    {created&&<div className="invite-created">
     <strong><Check size={15}/> Invitation ready for {created.name}</strong>
     <span>Send them this link — it signs them up straight into your organisation.</span>
     <code>{inviteLink(created.token)}</code>
     <CopyLink token={created.token}/>
    </div>}
   </form>
   <div className="panel org-panel">
    <header className="org-panel-head"><div><span>Awaiting response</span><h2>Pending invitations</h2><p>Links that have not been accepted yet.</p></div><strong>{pending.length} pending</strong></header>
    {loading?<p className="org-empty">Loading…</p>:!pending.length?<p className="org-empty">No invitations waiting.</p>:
     <ul className="org-invites">{pending.map(invite=><li key={invite.id}>
      <div><strong>{invite.name}</strong><span>{invite.email} · {invite.subject}</span></div>
      <div className="org-invite-actions"><CopyLink token={invite.token}/><button type="button" className="icon-danger" aria-label={`Revoke invitation for ${invite.name}`} onClick={()=>revoke(invite.id)}><Trash2 size={15}/></button></div>
     </li>)}</ul>}
    {accepted.length>0&&<><h3 className="org-subhead">Accepted <span className="org-count">{accepted.length}</span></h3>
     <ul className="org-invites">{accepted.map(invite=><li key={invite.id}>
      <div><strong>{invite.name}</strong><span>{invite.email} · {invite.subject}</span></div>
      <span className="org-tag ok">joined {invite.acceptedAt}</span>
     </li>)}</ul></>}
   </div>
  </div>
  </div>
 </DashboardShell>;
}
