import{useEffect,useState}from'react';import{Link,useLocation,useNavigate,useParams}from'react-router-dom';import{Camera,CameraOff,Check,ChevronDown,Clock,Lock,Mic,MicOff,Settings,Speaker,Video}from'lucide-react';
import{callParties,initials}from'./call';
import{StreamVideo}from'./video';
import{ledgerService}from'../services/ledger.service';
import{scheduleService,type Booking}from'../services/schedule.service';
import{walletService}from'../services/wallet.service';
import{useAuth}from'../auth';
import{formatMoney,relativeTime}from'../lib/money';
import type{CurrencyCode,SessionPayment}from'../types/payments';

/** The lobby is the handoff into the room, so it shows the session that was actually booked,
    and the money held for it when the demo ledger has any. */
function useBookedSession(sessionId:string|undefined){
 const[booking,setBooking]=useState<Booking|null>(null);
 const[payment,setPayment]=useState<SessionPayment|null>(null);
 useEffect(()=>{
  if(!sessionId)return;
  let live=true;
  scheduleService.get(sessionId).then(found=>{if(live)setBooking(found)}).catch(()=>{/* the lobby still works without it */});
  ledgerService.bySession(sessionId).then(found=>{if(live)setPayment(found)}).catch(()=>{});
  return()=>{live=false};
 },[sessionId]);
 return{booking,payment};
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
export function LessonLobby(){const{bookingId}=useParams();const{search}=useLocation();const navigate=useNavigate();const[cam,setCam]=useState(true);
 // A demo tab (?as=) starts with its mic off, so two tabs on one computer don't feed back.
 const[mic,setMic]=useState(true);const[testing,setTesting]=useState(false);const[short,setShort]=useState(false);const{user}=useAuth();const{booking:session,payment}=useBookedSession(bookingId);const preview=useCameraPreview(cam);
 /* The lobby is shared by both sides, so it names whoever you are meeting — not whoever teaches. */
 const parties=callParties(session,user?.id);
 const meeting=session?{name:parties.them.name,role:parties.them.role==='Tutor'&&session.skill?`${session.skill} tutor`:parties.them.role}:null;const when=session?.startsAt?new Date(session.startsAt):null;
 const join=(camera:boolean)=>navigate(`/lesson/${bookingId}${search}`,{state:{startMuted:!mic,startCamera:camera}});
 return <main className="lesson-lobby"><header><Link to="/"><span>⌘</span> pairlore</Link><span>Having trouble? <button>Get help</button></span></header><div className="lobby-layout"><section className="device-preview"><div className={cam?'preview-active':'preview-off'}>{cam&&preview.stream?<StreamVideo stream={preview.stream} muted mirrored/>:<div className="preview-avatar">{initials(parties.me.name)}</div>}{cam?(!preview.stream&&<span>{preview.error??'Starting camera…'}</span>):<><CameraOff/><strong>Your camera is off</strong></>}</div><div className="preview-controls"><button className={!mic?'off':''} aria-label={mic?'Mute microphone':'Turn on microphone'} aria-pressed={!mic} onClick={()=>setMic(!mic)}>{mic?<Mic/>:<MicOff/>}</button><button className={!cam?'off':''} aria-label={cam?'Turn off camera':'Turn on camera'} aria-pressed={!cam} onClick={()=>setCam(!cam)}>{cam?<Camera/>:<CameraOff/>}</button><button aria-label="Device settings"><Settings/></button></div></section><aside><span className="lobby-time"><Clock/> {when?`Your session starts ${relativeTime(when.toISOString())}`:'No time set'}</span><div className="lobby-tutor"><div className="avatar">{meeting?initials(meeting.name):'?'}</div><div><strong>{meeting?.name??'Session not found'}</strong><span>{meeting?.role??'Check the link from your lessons page'}</span></div></div><h1>{session?.topic??'Practice session'}</h1><div className="lesson-facts"><p><span>Date</span>{when?when.toLocaleDateString('en',{weekday:'long',month:'short',day:'numeric',year:'numeric'}):'—'}</p><p><span>Time</span>{when?when.toLocaleTimeString('en',{hour:'numeric',minute:'2-digit'}):'—'} · {Intl.DateTimeFormat().resolvedOptions().timeZone}</p><p><span>Duration</span>{session?.durationMinutes??60} minutes</p>{payment&&<p><span>Rate</span>{formatMoney(payment.hourlyRate,payment.currency)} / hour</p>}</div>{payment&&<p className="lobby-escrow"><Lock size={13}/> {formatMoney(payment.heldAmount,payment.currency)} is held for this session. You are billed for the minutes taught.</p>}<div className="device-checks"><button onClick={()=>{setTesting(true);setTimeout(()=>setTesting(false),1200)}}><Mic/><span><strong>Microphone</strong>{testing?'Testing…':'Built-in microphone'}</span>{testing?<i className="audio-bars"/>:<Check/>}</button><button><Speaker/><span><strong>Speaker</strong>Default output</span><Check/></button><button><Video/><span><strong>Camera</strong>Integrated camera</span><ChevronDown/></button></div>{session&&<SeriesCost booking={session} paid={Boolean(payment)} learner={session.learner.id===user?.id} onShort={setShort}/>}<button className="btn lobby-join" disabled={short} onClick={()=>join(cam)}>Join lesson</button><button className="join-without" onClick={()=>join(false)} disabled={short}>Join without camera</button></aside></div></main>}

/* A schedule's sessions are paid for as they open. The learner sees what opening costs, and is
   stopped here when their wallet cannot cover it; the tutor sees that it waits on the learner. */
function SeriesCost({booking,paid,learner,onShort}:{booking:Booking;paid:boolean;learner:boolean;onShort:(short:boolean)=>void}){
 const[balance,setBalance]=useState<number|null>(null);
 const cost=booking.sessionCost;
 useEffect(()=>{
  if(!booking.seriesId||paid||!learner)return;
  let live=true;
  walletService.list().then(wallets=>{if(live)setBalance(wallets.find(w=>w.currency===booking.currency)?.available??0)}).catch(()=>{if(live)setBalance(0)});
  return()=>{live=false};
 },[booking.seriesId,booking.currency,paid,learner]);
 const short=Boolean(booking.seriesId)&&!paid&&learner&&balance!==null&&cost!==undefined&&balance<cost;
 useEffect(()=>onShort(short),[short,onShort]);

 if(!booking.seriesId||cost===undefined)return null;
 const price=formatMoney(cost,booking.currency as CurrencyCode);
 if(paid)return <p className="lobby-cost"><Lock size={13}/> Paid: {price} is held for this session.</p>;
 if(!learner)return <p className="lobby-cost">This session opens once {booking.learner.name.split(' ')[0]} has paid for it.</p>;
 if(short)return <p className="lobby-cost short">Opening this session takes {price}, and your wallet has {formatMoney(balance??0,booking.currency as CurrencyCode)}. <Link to="/student/wallet">Top up</Link> to open it.</p>;
 return <p className="lobby-cost">Opening this session takes {price} from your wallet.</p>;
}
