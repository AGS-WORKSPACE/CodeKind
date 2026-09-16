import{useEffect,useRef,useState}from'react';
import{Link,useSearchParams}from'react-router-dom';
import{Check,Code2,MailCheck,TriangleAlert}from'lucide-react';
import{useAuth,workspacePath}from'./auth';
import{ApiError}from'./services/api';
import{authService}from'./services/auth.service';

const problemText=(problem:unknown,fallback:string)=>problem instanceof ApiError?problem.message:fallback;

function AuthShell({icon=<Code2/>,title,text,children}:{icon?:React.ReactNode;title:string;text:string;children?:React.ReactNode}){
 return <main className="auth"><Link to="/" className="auth-logo"><Code2/> pairlore</Link><section className="auth-card">
  <span className="auth-mark">{icon}</span><h1>{title}</h1><p>{text}</p>{children}
 </section></main>;
}

/** The link in the verification email lands here. */
export function VerifyEmailPage(){
 const[params]=useSearchParams();
 const token=params.get('token');
 const{user,refresh}=useAuth();
 const[state,setState]=useState<'checking'|'done'|'failed'>(token?'checking':'failed');
 const[message,setMessage]=useState('');
 const started=useRef(false);

 useEffect(()=>{
  // A token is single-use, so React's development double effect must not spend it twice.
  if(!token||started.current)return;
  started.current=true;
  authService.verifyEmail(token)
   .then(()=>refresh()).then(()=>setState('done'))
   .catch(problem=>{setMessage(problemText(problem,'We could not reach Pairlore. Try the link again shortly.'));setState('failed')});
 },[token,refresh]);

 if(state==='checking')return <AuthShell icon={<MailCheck/>} title="Confirming your email" text="This takes a moment."/>;
 if(state==='done')return <AuthShell icon={<Check/>} title="Your email is confirmed" text="You can now book sessions.">
  <Link className="btn wide" to={user?workspacePath(user.role):'/login'}>{user?'Continue':'Log in'}</Link>
 </AuthShell>;
 return <AuthShell icon={<TriangleAlert/>} title="This link did not work" text={message||'The link is missing its code. Open it again from your email.'}>
  <p className="auth-note">Links work once and expire after 48 hours. {user?'Ask for a new one from your dashboard.':'Log in to ask for a new one.'}</p>
  <Link className="btn wide" to={user?workspacePath(user.role):'/login'}>{user?'Go to your dashboard':'Log in'}</Link>
 </AuthShell>;
}

export function ForgotPasswordPage(){
 const[email,setEmail]=useState('');
 const[busy,setBusy]=useState(false);
 const[sent,setSent]=useState(false);
 const[error,setError]=useState('');
 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();setBusy(true);setError('');
  try{await authService.requestPasswordReset(email);setSent(true)}
  catch(problem){setError(problemText(problem,'We could not reach Pairlore. Try again shortly.'))}
  finally{setBusy(false)}
 };
 // The answer is the same whether or not the address has an account.
 if(sent)return <AuthShell icon={<MailCheck/>} title="Check your inbox" text={`If ${email} has a Pairlore account, we have sent it a link to reset the password. The link works for one hour.`}>
  <Link className="btn wide" to="/login">Back to login</Link>
 </AuthShell>;
 return <AuthShell title="Reset your password" text="Enter the email you signed up with and we will send you a reset link.">
  <form onSubmit={submit}>
   {error&&<div className="form-error">{error}</div>}
   <label>Email<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
   <button className="btn wide" disabled={busy}>{busy?'Sending…':'Send reset link'}</button>
  </form>
  <small>Remembered it? <Link to="/login">Log in</Link></small>
 </AuthShell>;
}

/** The link in the password reset email lands here. */
export function ResetPasswordPage(){
 const[params]=useSearchParams();
 const token=params.get('token')??'';
 const[form,setForm]=useState({password:'',confirm:''});
 const[busy,setBusy]=useState(false);
 const[done,setDone]=useState(false);
 const[error,setError]=useState('');
 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();setError('');
  if(form.password!==form.confirm){setError('The passwords do not match');return}
  setBusy(true);
  try{await authService.resetPassword(token,form.password);setDone(true)}
  catch(problem){setError(problemText(problem,'We could not reach Pairlore. Try again shortly.'))}
  finally{setBusy(false)}
 };
 if(!token)return <AuthShell icon={<TriangleAlert/>} title="This link did not work" text="The link is missing its code. Open it again from your email, or ask for a new one.">
  <Link className="btn wide" to="/forgot-password">Ask for a new link</Link>
 </AuthShell>;
 if(done)return <AuthShell icon={<Check/>} title="Your password is changed" text="Other devices have been signed out. Log in with your new password.">
  <Link className="btn wide" to="/login">Log in</Link>
 </AuthShell>;
 return <AuthShell title="Choose a new password" text="Use at least 8 characters.">
  <form onSubmit={submit}>
   {error&&<div className="form-error">{error}{error.includes('expired')&&<> <Link to="/forgot-password">Ask for a new link</Link></>}</div>}
   <label>New password<input type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/></label>
   <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} value={form.confirm} onChange={e=>setForm({...form,confirm:e.target.value})} required/></label>
   <button className="btn wide" disabled={busy}>{busy?'Saving…':'Change password'}</button>
  </form>
 </AuthShell>;
}
