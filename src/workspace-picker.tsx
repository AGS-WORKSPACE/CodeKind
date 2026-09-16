import{useState}from'react';
import{Navigate,useNavigate}from'react-router-dom';
import{ArrowRight,BookOpen,Building2,GraduationCap,ShieldCheck}from'lucide-react';
import{useAuth,workspacePath}from'./auth';
import type{Role}from'./services/auth.service';

const WORKSPACES:Record<Role,{title:string;text:string;icon:React.ReactNode}>={
 STUDENT:{title:'Learning',text:'Book sessions, follow your paths and join your classroom.',icon:<BookOpen/>},
 TUTOR:{title:'Teaching',text:'Take sessions, keep your calendar and track what you earn.',icon:<GraduationCap/>},
 ORGANIZATION:{title:'Organisation',text:'Invite trainers and schedule their sessions from one place.',icon:<Building2/>},
 ADMIN:{title:'Administration',text:'Moderate the marketplace, appeals and platform settings.',icon:<ShieldCheck/>},
};

/** Shown right after signing in when an account holds more than one workspace. */
export function WorkspacePicker(){
 const{user,workspaces,loading,chooseWorkspace}=useAuth();
 const navigate=useNavigate();
 const[entering,setEntering]=useState<Role|null>(null);
 const[error,setError]=useState('');

 if(loading)return <main className="workspace-picker"><p className="picker-status">Loading your account…</p></main>;
 if(!user)return <Navigate to="/login" replace/>;
 if(user.role&&workspaces.length<2)return <Navigate to={workspacePath(user.role)} replace/>;

 const enter=async(role:Role)=>{
  setEntering(role);setError('');
  try{const account=await chooseWorkspace(role);navigate(workspacePath(account.role))}
  catch(problem){setError(problem instanceof Error?problem.message:'Could not open that workspace');setEntering(null)}
 };

 return <main className="workspace-picker">
  <span className="eyebrow">WELCOME BACK, {user.firstName.toUpperCase()}</span>
  <h1>Where are you working today?</h1>
  <p>Your account holds more than one workspace. You can switch at any time.</p>
  {error&&<div className="form-error">{error}</div>}
  <div className="picker-grid">{workspaces.map(role=>{
   const workspace=WORKSPACES[role];
   return <button type="button" key={role} disabled={entering!==null} onClick={()=>enter(role)}>
    <span className="picker-icon">{workspace.icon}</span>
    <strong>{workspace.title}</strong>
    <small>{workspace.text}</small>
    <span className="picker-go">{entering===role?'Opening…':'Enter'} <ArrowRight/></span>
   </button>;
  })}</div>
 </main>;
}
