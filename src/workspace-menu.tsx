import{useEffect,useRef,useState}from'react';
import{useNavigate}from'react-router-dom';
import{Check,Plus}from'lucide-react';
import{useAuth,workspacePath}from'./auth';
import type{Role}from'./services/auth.service';

const NAMES:Record<Role,string>={STUDENT:'Learning',TUTOR:'Teaching',ORGANIZATION:'Organisation',ADMIN:'Administration'};
// Only these can be added from the menu; admin and organisation are set up elsewhere.
const ADDABLE:Role[]=['STUDENT','TUTOR'];

/** The avatar menu: switch between the workspaces this account holds, or add learning or teaching. */
export function WorkspaceMenu({initials,name}:{initials:string;name:string}){
 const{user,workspaces,chooseWorkspace,addWorkspace}=useAuth();
 const navigate=useNavigate();
 const[open,setOpen]=useState(false);
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState('');
 const menu=useRef<HTMLDivElement>(null);

 useEffect(()=>{
  if(!open)return;
  const close=(event:MouseEvent)=>{if(!menu.current?.contains(event.target as Node))setOpen(false)};
  document.addEventListener('mousedown',close);
  return()=>document.removeEventListener('mousedown',close);
 },[open]);

 const go=async(action:()=>Promise<{role:Role|null}>,to?:string)=>{
  setBusy(true);setError('');
  try{const account=await action();setOpen(false);navigate(to??workspacePath(account.role))}
  catch(problem){setError(problem instanceof Error?problem.message:'That did not work. Try again.')}
  finally{setBusy(false)}
 };

 const missing=ADDABLE.filter(role=>!workspaces.includes(role));
 return <div className="workspace-menu" ref={menu}>
  <button type="button" className="avatar tiny" title={name} aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(!open)}>{initials}</button>
  {open&&user&&<div className="workspace-menu-list" role="menu">
   <strong>{name}</strong><small>{user.email}</small>
   <span>Workspaces</span>
   {workspaces.map(role=><button type="button" role="menuitem" key={role} disabled={busy||role===user.role} onClick={()=>go(()=>chooseWorkspace(role))}>
    {NAMES[role]}{role===user.role&&<Check size={14}/>}
   </button>)}
   {missing.map(role=><button type="button" role="menuitem" className="add" key={role} disabled={busy} onClick={()=>go(()=>addWorkspace(role),role==='TUTOR'?'/tutor/onboarding':undefined)}>
    <Plus size={14}/> Add {NAMES[role].toLowerCase()}
   </button>)}
   {error&&<p className="form-error">{error}</p>}
  </div>}
 </div>;
}
