import{useState}from'react';
import{Check,ExternalLink,X}from'lucide-react';
import{SkillBadge}from'./components';
import{useToast}from'./ui-feedback';
import{useLoader}from'./hooks/use-payments';
import{countries}from'./data/locations';
import{relativeTime}from'./lib/money';
import{adminTutorService,type ReviewStatus,type TutorApplication}from'./services/admin-tutors.service';

const TABS:[ReviewStatus,string][]=[['submitted','Waiting for review'],['approved','Approved'],['rejected','Needs changes']];
const countryName=(code:string|null)=>countries.find(c=>c.code===code)?.label??'No country set';

/** Tutors stay out of search until an admin approves them here. */
export function AdminTutorApplications(){
 const[status,setStatus]=useState<ReviewStatus>('submitted');
 const[rejecting,setRejecting]=useState<TutorApplication|null>(null);
 const[busy,setBusy]=useState<string|null>(null);
 const toast=useToast();
 const list=useLoader(()=>adminTutorService.applications(status),[status]);
 const rows=list.data??[];

 const decide=async(tutor:TutorApplication,decision:'approved'|'rejected',reason='')=>{
  setBusy(tutor.id);
  try{
   await adminTutorService.decide(tutor.id,decision,reason);
   toast(decision==='approved'?`${tutor.firstName} is now live in search`:`${tutor.firstName} has been asked for changes`);
   setRejecting(null);
   await list.reload();
  }catch(problem){toast(problem instanceof Error?problem.message:'That did not work')}
  finally{setBusy(null)}
 };

 return <div className="admin-page">
  <header className="admin-page-head">
   <div><span>People</span><h1>Tutor applications</h1><p>Check each profile before it appears in search. The tutor is notified either way.</p></div>
  </header>
  <div className="error-log-filters">{TABS.map(([value,name])=><button type="button" className={status===value?'active':''} onClick={()=>setStatus(value)} key={value}>{name}</button>)}</div>
  {list.error&&<p className="ledger-error">{list.error}</p>}
  {list.loading&&!rows.length?<div className="workspace-skeleton"><i/><i/></div>
   :!rows.length?<div className="api-state"><Check/><h3>{status==='submitted'?'No applications waiting':'Nothing here yet'}</h3><p>{status==='submitted'?'Every submitted profile has been reviewed.':'Decisions you make will appear here.'}</p></div>
   :<div className="application-table">{rows.map(tutor=><ApplicationCard key={tutor.id} tutor={tutor} status={status} busy={busy===tutor.id}
     onApprove={()=>decide(tutor,'approved')} onReject={()=>setRejecting(tutor)}/>)}</div>}
  {rejecting&&<RejectDialog tutor={rejecting} busy={busy===rejecting.id} onClose={()=>setRejecting(null)} onConfirm={reason=>decide(rejecting,'rejected',reason)}/>}
 </div>;
}

function ApplicationCard({tutor,status,busy,onApprove,onReject}:{tutor:TutorApplication;status:ReviewStatus;busy:boolean;onApprove:()=>void;onReject:()=>void}){
 const[open,setOpen]=useState(false);
 const links=[['GitHub',tutor.githubUrl],['Portfolio',tutor.portfolioUrl],['LinkedIn',tutor.linkedinUrl]].filter((link):link is [string,string]=>Boolean(link[1]));
 return <article className="application-card">
  <div className="avatar">{tutor.firstName[0]}{tutor.lastName[0]}</div>
  <div>
   <h3>{tutor.firstName} {tutor.lastName}</h3>
   <p>{tutor.headline}</p>
   <div className="badges">{tutor.skills.map(s=><SkillBadge key={s.code}>{s.name}</SkillBadge>)}</div>
   <small>{tutor.yearsOfExperience} years · {countryName(tutor.country)} · ${tutor.hourlyRate}/hour, trial ${tutor.trialRate} · {tutor.email}{tutor.submittedAt&&` · submitted ${relativeTime(tutor.submittedAt)}`}</small>
   <button type="button" className="text-link" onClick={()=>setOpen(!open)}>{open?'Hide details':'Show bio and links'}</button>
   {open&&<div className="application-details">
    <p>{tutor.bio}</p>
    {tutor.teachingExperience&&<p><strong>Teaching:</strong> {tutor.teachingExperience}</p>}
    {tutor.languages.length>0&&<p><strong>Languages:</strong> {tutor.languages.join(', ')}</p>}
    {links.length>0&&<div className="profile-links">{links.map(([label,url])=><a href={url} target="_blank" rel="noreferrer" key={label}>{label} <ExternalLink size={13}/></a>)}</div>}
   </div>}
  </div>
  <div className="admin-actions">
   {status!=='rejected'&&<button type="button" className="btn ghost" disabled={busy} onClick={onReject}>{status==='approved'?'Take down':'Ask for changes'}</button>}
   {status!=='approved'&&<button type="button" className="btn" disabled={busy} onClick={onApprove}>{busy?'Saving…':'Approve'}</button>}
  </div>
 </article>;
}

function RejectDialog({tutor,busy,onClose,onConfirm}:{tutor:TutorApplication;busy:boolean;onClose:()=>void;onConfirm:(reason:string)=>void}){
 const[reason,setReason]=useState('');
 return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
  <div className="modal" role="dialog" aria-modal="true" aria-labelledby="reject-title" onMouseDown={e=>e.stopPropagation()}>
   <button type="button" className="modal-close" aria-label="Close" onClick={onClose}><X/></button>
   <h2 id="reject-title">Ask {tutor.firstName} for changes</h2>
   <p>Their profile leaves search until they save it again. What you write is sent to them and kept at the top of their profile editor.</p>
   <textarea className="reject-reason" value={reason} onChange={e=>setReason(e.target.value)} placeholder="For example: add a longer bio and a link to your work." rows={4}/>
   <div><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button type="button" className="btn danger" disabled={busy||!reason.trim()} onClick={()=>onConfirm(reason)}>{busy?'Sending…':'Send'}</button></div>
  </div>
 </div>;
}
