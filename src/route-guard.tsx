import{useState}from'react';
import{Link,Navigate,useLocation,useNavigate}from'react-router-dom';
import{ArrowRight,Code2}from'lucide-react';
import{useAuth,workspacePath}from'./auth';
import type{Role}from'./services/auth.service';

const NAMES:Record<Role,string>={STUDENT:'learning',TUTOR:'teaching',ORGANIZATION:'organisation',ADMIN:'administration'};

/** Keeps a page to the workspaces allowed on it. The backend still checks every request;
    this only stops people landing on a page that cannot load for them. */
export function ProtectedRoute({roles,children}:{roles:Role[];children:React.ReactNode}){
 const{user,workspaces,loading}=useAuth();
 const location=useLocation();

 if(loading)return <div className="placeholder"><div className="loading-spinner"/><p>Checking your account…</p></div>;
 if(!user)return <Navigate to="/login" replace state={{from:location.pathname+location.search}}/>;
 if(!user.role)return <Navigate to="/choose-workspace" replace/>;
 if(roles.includes(user.role))return children;

 // The account holds a workspace this page belongs to, so offer to switch rather than bounce.
 const held=roles.find(role=>workspaces.includes(role));
 if(held)return <SwitchWorkspace role={held}/>;
 return <Navigate to={workspacePath(user.role)} replace/>;
}

function SwitchWorkspace({role}:{role:Role}){
 const{chooseWorkspace}=useAuth();
 const navigate=useNavigate();
 const{pathname,search}=useLocation();
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState('');
 const switchNow=async()=>{
  setBusy(true);setError('');
  try{await chooseWorkspace(role);navigate(pathname+search,{replace:true})}
  catch(problem){setError(problem instanceof Error?problem.message:'Could not switch workspace');setBusy(false)}
 };
 return <main className="auth"><section className="auth-card">
  <span className="auth-mark"><Code2/></span>
  <h1>This page is in your {NAMES[role]} workspace</h1>
  <p>Switch to it to continue. You can come back at any time from the menu under your initials.</p>
  {error&&<div className="form-error">{error}</div>}
  <button type="button" className="btn wide" disabled={busy} onClick={switchNow}>{busy?'Switching…':`Switch to ${NAMES[role]}`} <ArrowRight/></button>
  <small><Link to="/choose-workspace">Choose another workspace</Link></small>
 </section></main>;
}
