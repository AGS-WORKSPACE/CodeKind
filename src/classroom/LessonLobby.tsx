import{useEffect,useState}from'react';import{Link,useLocation,useNavigate,useParams,useSearchParams}from'react-router-dom';import{Camera,CameraOff,Check,ChevronDown,Clock,Lock,Mic,MicOff,Settings,Speaker,Video}from'lucide-react';
import{callParties,initials}from'./call';
import{StreamVideo}from'./video';
import{ledgerService}from'../services/ledger.service';
import{useAuth}from'../auth';
import{formatMoney,relativeTime}from'../lib/money';
import type{SessionPayment}from'../types/payments';

/** The lobby is the handoff into the room, so it shows the session that was actually booked. */
function useBookedSession(sessionId:string|undefined){
 const[session,setSession]=useState<SessionPayment|null>(null);
 useEffect(()=>{
  if(!sessionId)return;
  let live=true;
  ledgerService.bySession(sessionId).then(found=>{if(live)setSession(found)}).catch(()=>{/* the lobby still works without it */});
  return()=>{live=false};
 },[sessionId]);
 return session;
}
/** A real self-view while you check your camera. Released as soon as you turn it off or leave. */
function useCameraPreview(enabled:boolean){
 const[stream,setStream]=useState<MediaStream|null>(null);
 const[error,setError]=useState<string|null>(null);
 useEffect(()=>{
  if(!enabled||!navigator.mediaDevices?.getUserMedia)return;
  let live=true;let acquired:MediaStream|null=null;
  navigator.mediaDevices.getUserMedia({video:true}).then(found=>{acquired=found;if(live){setStream(found);setError(null)}else found.getTracks().forEach(t=>t.stop())})
   .catch(problem=>{if(live)setError(problem instanceof DOMException&&problem.name==='NotAllowedError'?'Camera blocked. Allow it in the address bar.':'No camera found.')});
  return()=>{live=false;acquired?.getTracks().forEach(t=>t.stop());setStream(null)};
 },[enabled]);
 return{stream,error};
}
export function LessonLobby(){const{bookingId}=useParams();const[params]=useSearchParams();const{search}=useLocation();const navigate=useNavigate();const[cam,setCam]=useState(true);
 // A demo tab (?as=) starts with its mic off, so two tabs on one computer don't feed back.
 const[mic,setMic]=useState(()=>!params.get('as'));const[testing,setTesting]=useState(false);const{user}=useAuth();const session=useBookedSession(bookingId);const preview=useCameraPreview(cam);
 /* The lobby is shared by both sides, so it names whoever you are meeting — not whoever teaches. */
 const parties=callParties(session,user?.id,params.get('as'));
 const meeting=session?{name:parties.them.name,role:parties.them.role==='Tutor'&&session.skill?`${session.skill} tutor`:parties.them.role}:null;const when=session?.startsAt?new Date(session.startsAt):null;
 const join=(camera:boolean)=>navigate(`/lesson/${bookingId}${search}`,{state:{startMuted:!mic,startCamera:camera}});
 return <main className="lesson-lobby"><header><Link to="/"><span>⌘</span> pairlore</Link><span>Having trouble? <button>Get help</button></span></header><div className="lobby-layout"><section className="device-preview"><div className={cam?'preview-active':'preview-off'}>{cam&&preview.stream?<StreamVideo stream={preview.stream} muted mirrored/>:<div className="preview-avatar">{initials(parties.me.name)}</div>}{cam?(!preview.stream&&<span>{preview.error??'Starting camera…'}</span>):<><CameraOff/><strong>Your camera is off</strong></>}</div><div className="preview-controls"><button className={!mic?'off':''} aria-label={mic?'Mute microphone':'Turn on microphone'} aria-pressed={!mic} onClick={()=>setMic(!mic)}>{mic?<Mic/>:<MicOff/>}</button><button className={!cam?'off':''} aria-label={cam?'Turn off camera':'Turn on camera'} aria-pressed={!cam} onClick={()=>setCam(!cam)}>{cam?<Camera/>:<CameraOff/>}</button><button aria-label="Device settings"><Settings/></button></div></section><aside><span className="lobby-time"><Clock/> {when?`Your session starts ${relativeTime(when.toISOString())}`:'Your lesson starts in 8 minutes'}</span><div className="lobby-tutor"><div className="avatar">{meeting?initials(meeting.name):'SC'}</div><div><strong>{meeting?.name??'Sarah Chen'}</strong><span>{meeting?.role??'JavaScript tutor · 4.98 ★'}</span></div></div><h1>{session?.topic??'JavaScript Array Methods'}</h1>{parties.demoTab&&<p className="lobby-demo">Demo tab: you’re joining as {parties.me.name}. Your mic starts off so the two tabs don’t echo.</p>}<div className="lesson-facts"><p><span>Date</span>{when?when.toLocaleDateString('en',{weekday:'long',month:'short',day:'numeric',year:'numeric'}):'Thursday, Sep 3, 2026'}</p><p><span>Time</span>{when?when.toLocaleTimeString('en',{hour:'numeric',minute:'2-digit'}):'3:00 PM'} · {Intl.DateTimeFormat().resolvedOptions().timeZone}</p><p><span>Duration</span>{session?.scheduledMinutes??60} minutes</p>{session&&<p><span>Rate</span>{formatMoney(session.hourlyRate,session.currency)} / hour</p>}</div>{session&&<p className="lobby-escrow"><Lock size={13}/> {formatMoney(session.heldAmount,session.currency)} is held for this session. You are billed for the minutes taught.</p>}<div className="device-checks"><button onClick={()=>{setTesting(true);setTimeout(()=>setTesting(false),1200)}}><Mic/><span><strong>Microphone</strong>{testing?'Testing…':'Built-in microphone'}</span>{testing?<i className="audio-bars"/>:<Check/>}</button><button><Speaker/><span><strong>Speaker</strong>Default output</span><Check/></button><button><Video/><span><strong>Camera</strong>Integrated camera</span><ChevronDown/></button></div><button className="btn lobby-join" onClick={()=>join(cam)}>Join lesson</button><button className="join-without" onClick={()=>join(false)}>Join without camera</button></aside></div></main>}
