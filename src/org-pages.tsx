import{useCallback,useEffect,useState}from'react';
import{Check,Copy,GraduationCap,Mail,Trash2,Users}from'lucide-react';
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

export function OrgDashboard(){
 const{organisation,members,invites,loading}=useOrg();
 const trainers=members.filter(m=>m.role==='TRAINER');
 const pending=invites.filter(i=>i.status==='PENDING');
 return <DashboardShell role="org">
  <div className="dash-welcome"><div><h1>{organisation?.name??'Your organisation'}</h1><p>Invite your trainers, keep the roster current, and run their sessions from one account.</p></div></div>
  <div className="stats-grid">
   <StatCard label="Trainers" value={String(trainers.length)} trend={loading?'Loading…':'On the roster'} icon={<GraduationCap/>}/>
   <StatCard label="Pending invitations" value={String(pending.length)} trend={pending.length?'Awaiting acceptance':'All caught up'} icon={<Mail/>}/>
   <StatCard label="Subjects covered" value={String(new Set(trainers.map(t=>t.subject)).size)} trend="Across the team" icon={<Users/>}/>
  </div>
  <div className="panel org-panel">
   <h3>Roster</h3>
   {loading?<p className="org-empty">Loading your team…</p>:<OrgRoster members={members}/>}
  </div>
 </DashboardShell>;
}

function OrgRoster({members}:{members:OrgMember[]}){
 if(!members.length)return <p className="org-empty">No trainers yet. Send your first invitation to get started.</p>;
 return <table className="org-table"><thead><tr><th>Trainer</th><th>Subject</th><th>Role</th><th>Joined</th></tr></thead><tbody>
  {members.map(member=><tr key={member.id}>
   <td><strong>{member.name}</strong><span>{member.email}</span></td>
   <td>{member.subject}</td>
   <td><span className={member.role==='OWNER'?'org-tag owner':'org-tag'}>{member.role.toLowerCase()}</span></td>
   <td>{member.joinedAt}</td>
  </tr>)}
 </tbody></table>;
}

export function OrgTrainers(){
 const{members,loading}=useOrg();
 return <DashboardShell role="org">
  <div className="dash-welcome"><div><h1>Trainers</h1><p>Everyone teaching under your organisation.</p></div></div>
  <div className="panel org-panel">{loading?<p className="org-empty">Loading your team…</p>:<OrgRoster members={members}/>}</div>
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
  <div className="dash-welcome"><div><h1>Invitations</h1><p>Invite a trainer by email. They accept through the link and join your roster.</p></div></div>
  <div className="org-invite-layout">
   <form className="panel org-panel" onSubmit={send}>
    <h3>Invite a trainer</h3>
    <label>Full name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Tomás Rivera" required/></label>
    <label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="tomas@example.com" required/></label>
    <label>Subject<input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="Cloud & DevOps" required/></label>
    <button className="btn wide" disabled={busy}>{busy?'Creating…':'Create invitation'}</button>
    {created&&<div className="invite-created">
     <strong><Check size={15}/> Invitation ready for {created.name}</strong>
     <span>Send them this link — it signs them up straight into your organisation.</span>
     <code>{inviteLink(created.token)}</code>
     <CopyLink token={created.token}/>
    </div>}
   </form>
   <div className="panel org-panel">
    <h3>Pending <span className="org-count">{pending.length}</span></h3>
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
 </DashboardShell>;
}
