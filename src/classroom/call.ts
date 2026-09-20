import{createContext,useCallback,useContext,useEffect,useRef,useState}from'react';
import type{Booking}from'../services/schedule.service';

// ---------------------------------------------------------------------------
// Who is who in a session
// ---------------------------------------------------------------------------

export type CallSide='tutor'|'learner';
export type CallParty={name:string;role:'Tutor'|'Learner'};

/** Which side of the booking you are on. Nobody can join as the other person. */
export function callParties(booking:Booking|null,userId:string|undefined){
 const side:CallSide=booking&&userId===booking.tutor.id?'tutor':'learner';
 const tutor:CallParty={name:booking?.tutor.name??'Your tutor',role:'Tutor'};
 const learner:CallParty={name:booking?.learner.name??'Your learner',role:'Learner'};
 return{side,otherSide:(side==='tutor'?'learner':'tutor') as CallSide,me:side==='tutor'?tutor:learner,them:side==='tutor'?learner:tutor};
}
export const initials=(name:string)=>name.split(' ').map(part=>part[0]).join('').slice(0,2).toUpperCase();
export const firstName=(name:string)=>name.split(' ')[0]??name;

/** The people in the room, for the panels (participants, chat, editor cursors) that name them. */
type People={me:CallParty;them:CallParty;connected:boolean};
export const PeopleContext=createContext<People|null>(null);
// Outside a live room the panels keep the mock lesson's cast.
const MOCK_CAST:People={me:{name:'David Okafor',role:'Learner'},them:{name:'Sarah Chen',role:'Tutor'},connected:true};
export function usePeople(){const people=useContext(PeopleContext)??MOCK_CAST;return{...people,tutor:people.me.role==='Tutor'?people.me:people.them}}

// ---------------------------------------------------------------------------
// Signalling: how the two ends find each other. Only this travels through it — audio and video go
// directly between the browsers once connected.
// ---------------------------------------------------------------------------

export type Signal=
 |{type:'hello';from:string;name:string;reply?:boolean}
 |{type:'offer'|'answer';from:string;to:string;sdp:RTCSessionDescriptionInit}
 |{type:'ice';from:string;to:string;candidate:RTCIceCandidateInit}
 |{type:'media';from:string;muted:boolean;camera:boolean;sharing:boolean;ready:boolean}
 |{type:'end';from:string;attendedSeconds:number}
 |{type:'bye';from:string}
 // The whiteboard travels the same way: one message per finished stroke, and one to take it back.
 |{type:'board';from:string;stroke:BoardStroke}
 |{type:'board-undo';from:string;strokeId:string}
 |{type:'board-clear';from:string};

/** A stroke in board space: every point is a fraction of the width and height, so two windows of
    different sizes draw the same thing. */
export type BoardStroke={id:string;colour:string;width:number;points:{x:number;y:number}[]};
export type BoardLink={send:(stroke:BoardStroke)=>void;undo:(strokeId:string)=>void;clear:()=>void;subscribe:(handler:(event:BoardEvent)=>void)=>()=>void};
export type BoardEvent={kind:'stroke';stroke:BoardStroke}|{kind:'undo';strokeId:string}|{kind:'clear'};

export type SignalingChannel={send:(signal:Signal)=>void;subscribe:(handler:(signal:Signal)=>void)=>()=>void;close:()=>void};

// ---------------------------------------------------------------------------
// The call
// ---------------------------------------------------------------------------

const NO_SERVERS:RTCIceServer[]=[];

export type CallStatus='WAITING'|'CONNECTING'|'CONNECTED';
/** `ready` is false while their camera/mic request is still pending (a permission prompt, say). */
export type PeerInfo={name:string;muted:boolean;camera:boolean;sharing:boolean;ready:boolean};

// Camera and mic if possible, mic alone if there is no camera, and nothing (receive only) otherwise.
async function acquireMedia(){
 if(!navigator.mediaDevices?.getUserMedia)throw new Error('This browser cannot use a camera or microphone.');
 try{return await navigator.mediaDevices.getUserMedia({audio:true,video:{width:{ideal:1280},height:{ideal:720}}})}
 catch(error){if(error instanceof DOMException&&error.name==='NotAllowedError')throw error;return navigator.mediaDevices.getUserMedia({audio:true})}
}
const mediaProblem=(error:unknown)=>error instanceof DOMException&&error.name==='NotAllowedError'
 ?'Camera and microphone are blocked. Allow them in the address bar to be seen and heard.'
 :'No camera or microphone was found. You can still see and hear the other person.';

/**
 * A two-person WebRTC call for one session. Whoever is already in the room makes the offer when the
 * other arrives, so the newcomer only ever answers; if both arrive at once, the larger id's offer
 * wins. Signals are handled one at a time, so an ICE candidate never races ahead of its offer.
 *
 * The call does not wait for the camera: every connection has an audio and a video slot from the
 * start, and tracks are swapped into them (replaceTrack, no renegotiation) whenever they arrive —
 * so a slow permission prompt only delays your picture, never the connection.
 */
export function usePeerCall({room,name,startMuted=false,startCamera=true,signaling,iceServers=NO_SERVERS}:{room:string;name:string;startMuted?:boolean;startCamera?:boolean;signaling?:(room:string)=>SignalingChannel;iceServers?:RTCIceServer[]}){
 const[status,setStatus]=useState<CallStatus>('WAITING');
 const[mediaReady,setMediaReady]=useState(false);
 const[local,setLocal]=useState<MediaStream|null>(null);
 const[remote,setRemote]=useState<MediaStream|null>(null);
 const[peer,setPeer]=useState<PeerInfo|null>(null);
 const[mediaError,setMediaError]=useState<string|null>(null);
 const[muted,setMuted]=useState(startMuted);
 const[camera,setCamera]=useState(startCamera);
 const[share,setShare]=useState<MediaStream|null>(null);
 const[ended,setEnded]=useState<{attendedSeconds:number}|null>(null);
 const[trouble,setTrouble]=useState<string|null>(null);
 const boardHandlers=useRef(new Set<(event:BoardEvent)=>void>());
 const media=useRef({muted:startMuted,camera:startCamera,sharing:false});
 const nameRef=useRef(name);nameRef.current=name;
 const link=useRef<{send:(signal:Signal)=>void;announce:()=>void;setScreen:(track:MediaStreamTrack|null)=>void;stream:MediaStream|null;me:string;connection:()=>RTCPeerConnection|null}|null>(null);

 /* Without a signalling service the two browsers cannot find each other, so the room says so
    rather than sitting on "waiting" forever. */
 const unavailable=signaling?null:'Live video is not set up on this server yet.';
 // A call that cannot find a path between the two networks needs a relay, so name that as the cause.
 const relayed=iceServers.some(server=>[server.urls].flat().some(url=>String(url).startsWith('turn')));
 const noPath=relayed
  ?'The call could not find a way through either network. Try again, or use another network.'
  :'The call could not find a way through either network. This server has no TURN relay set up, which is usually the reason.';

 useEffect(()=>{
  if(!signaling)return;
  const me=crypto.randomUUID(); // per mount, so a reloaded tab counts as a new arrival
  const channel=signaling(room);
  let disposed=false;
  let pc:RTCPeerConnection|null=null;
  let peerId:string|null=null;
  let stream:MediaStream|null=null;
  let queued:RTCIceCandidateInit[]=[];
  let slow:ReturnType<typeof setTimeout>|undefined;
  let settled=false; // the camera/mic request has finished, one way or the other
  const send=(signal:Signal)=>{if(!disposed)channel.send(signal)};
  const announce=()=>send({type:'media',from:me,ready:settled,sharing:media.current.sharing,muted:media.current.muted||!stream?.getAudioTracks().length,camera:media.current.camera&&Boolean(stream?.getVideoTracks().length)});

  // While sharing, the screen goes out in place of the camera: one swap, no renegotiation.
  let screen:MediaStreamTrack|null=null;
  const outgoing=(kind:string)=>kind==='video'&&screen?screen:stream?.getTracks().find(track=>track.kind===kind)??null;
  const attachTracks=(conn:RTCPeerConnection)=>{for(const slot of conn.getTransceivers()){const track=outgoing(slot.receiver.track.kind);if(slot.sender.track!==track)slot.sender.replaceTrack(track).catch(()=>{})}};
  const setScreen=(track:MediaStreamTrack|null)=>{screen=track;if(pc)attachTracks(pc)};
  link.current={send,announce,setScreen,stream:null,me,connection:()=>pc};
  // Saying hello again lets a peer who lost us too find us once either of us is back.
  const reset=()=>{pc?.close();pc=null;peerId=null;queued=[];setRemote(null);setPeer(null);setStatus('WAITING');send({type:'hello',from:me,name:nameRef.current})};
  // The offerer creates the audio/video slots; the answerer adopts the offer's (slots made with
  // addTransceiver are never matched to a remote offer, so pre-creating them there would send nothing).
  const open=(other:string,offerer:boolean)=>{
   pc?.close();queued=[];peerId=other;
   const conn=new RTCPeerConnection({iceServers});
   pc=conn;
   if(offerer){conn.addTransceiver('audio',{direction:'sendrecv'});conn.addTransceiver('video',{direction:'sendrecv'});attachTracks(conn)}
   const incoming=new MediaStream();
   conn.ontrack=event=>{if(conn!==pc)return;incoming.addTrack(event.track);setRemote(new MediaStream(incoming.getTracks()))};
   conn.onicecandidate=event=>{if(event.candidate)send({type:'ice',from:me,to:other,candidate:event.candidate.toJSON()})};
   conn.onconnectionstatechange=()=>{
    if(conn!==pc)return;
    const state=conn.connectionState;
    if(state==='connected'){setStatus('CONNECTED');setTrouble(null);clearTimeout(slow)}
    else if(state==='disconnected')setStatus('CONNECTING');
    else if(state==='failed'){setTrouble(noPath);reset()}
   };
   // Connecting normally takes a second or two; a minute of it means the media has nowhere to go.
   clearTimeout(slow);
   slow=setTimeout(()=>{if(conn===pc&&conn.connectionState!=='connected')setTrouble(noPath)},20000);
   setStatus('CONNECTING');
   return conn;
  };
  const flush=async()=>{for(const candidate of queued.splice(0))await pc?.addIceCandidate(candidate).catch(()=>{})};

  const handle=async(signal:Signal)=>{
   if(disposed||signal.from===me||('to' in signal&&signal.to!==me))return;
   switch(signal.type){
    case 'hello':{
     setPeer(current=>({name:signal.name,muted:current?.muted??false,camera:current?.camera??false,sharing:current?.sharing??false,ready:current?.ready??false}));
     // A reply, or a hello resent after a signaling reconnect while the call itself still works.
     if(signal.reply||(peerId===signal.from&&pc?.connectionState==='connected'))return;
     send({type:'hello',from:me,name:nameRef.current,reply:true});
     const conn=open(signal.from,true);
     await conn.setLocalDescription(await conn.createOffer());
     send({type:'offer',from:me,to:signal.from,sdp:conn.localDescription!.toJSON()});
     announce();
     return;
    }
    case 'offer':{
     if(pc&&peerId===signal.from&&pc.signalingState==='have-local-offer'&&me>signal.from)return;
     const conn=open(signal.from,false);
     await conn.setRemoteDescription(signal.sdp);
     conn.getTransceivers().forEach(slot=>{slot.direction='sendrecv'});attachTracks(conn);
     await conn.setLocalDescription(await conn.createAnswer());
     send({type:'answer',from:me,to:signal.from,sdp:conn.localDescription!.toJSON()});
     await flush();announce();
     return;
    }
    case 'answer':
     if(pc&&peerId===signal.from&&pc.signalingState==='have-local-offer'){await pc.setRemoteDescription(signal.sdp);await flush()}
     return;
    case 'ice':
     if(!pc||peerId!==signal.from)return;
     if(pc.remoteDescription)await pc.addIceCandidate(signal.candidate).catch(()=>{});else queued.push(signal.candidate);
     return;
    case 'media':setPeer(current=>current&&{...current,muted:signal.muted,camera:signal.camera,sharing:signal.sharing,ready:signal.ready});return;
    case 'board':boardHandlers.current.forEach(handler=>handler({kind:'stroke',stroke:signal.stroke}));return;
    case 'board-undo':boardHandlers.current.forEach(handler=>handler({kind:'undo',strokeId:signal.strokeId}));return;
    case 'board-clear':boardHandlers.current.forEach(handler=>handler({kind:'clear'}));return;
    case 'end':setEnded({attendedSeconds:signal.attendedSeconds});return;
    case 'bye':if(!peerId||peerId===signal.from)reset();return;
   }
  };

  acquireMedia()
   .then(acquired=>{if(disposed){acquired.getTracks().forEach(track=>track.stop());return}stream=acquired;if(link.current)link.current.stream=acquired;acquired.getAudioTracks().forEach(track=>{track.enabled=!media.current.muted});acquired.getVideoTracks().forEach(track=>{track.enabled=media.current.camera});if(!acquired.getVideoTracks().length){media.current.camera=false;setCamera(false)}setLocal(acquired);if(pc)attachTracks(pc)})
   .catch(error=>{if(disposed)return;setMediaError(mediaProblem(error));media.current={muted:true,camera:false,sharing:false};setMuted(true);setCamera(false)})
   .finally(()=>{if(disposed)return;settled=true;setMediaReady(true);announce()});
  let chain:Promise<unknown>=Promise.resolve();
  const unsubscribe=channel.subscribe(signal=>{chain=chain.then(()=>handle(signal)).catch(()=>{})});
  send({type:'hello',from:me,name:nameRef.current});
  const bye=()=>channel.send({type:'bye',from:me});
  window.addEventListener('pagehide',bye);
  return()=>{bye();disposed=true;window.removeEventListener('pagehide',bye);unsubscribe();channel.close();pc?.close();stream?.getTracks().forEach(track=>track.stop());link.current=null};
 },[room,signaling,iceServers]);

 // Stops sharing, whether from our button or the browser's own "stop sharing" bar.
 const stopShare=useCallback(()=>{
  setShare(current=>{current?.getTracks().forEach(track=>track.stop());return null});
  media.current.sharing=false;
  link.current?.setScreen(null);
  link.current?.announce();
 },[]);

 const toggleShare=useCallback(async()=>{
  if(media.current.sharing){stopShare();return}
  if(!navigator.mediaDevices?.getDisplayMedia)return;
  try{
   const display=await navigator.mediaDevices.getDisplayMedia({video:true});
   const track=display.getVideoTracks()[0];
   if(!track){display.getTracks().forEach(t=>t.stop());return}
   track.onended=()=>stopShare();
   setShare(display);
   media.current.sharing=true;
   link.current?.setScreen(track);
   link.current?.announce();
  }catch{/* the picker was dismissed */}
 },[stopShare]);

 const toggleMute=useCallback(()=>{const next=!media.current.muted;media.current.muted=next;setMuted(next);link.current?.stream?.getAudioTracks().forEach(track=>{track.enabled=!next});link.current?.announce()},[]);
 const toggleCamera=useCallback(()=>{const stream=link.current?.stream;if(!stream?.getVideoTracks().length)return;const next=!media.current.camera;media.current.camera=next;setCamera(next);stream.getVideoTracks().forEach(track=>{track.enabled=next});link.current?.announce()},[]);
 /** Ends the session for both sides; the other tab moves to the summary with the same attended time. */
 const end=useCallback((attendedSeconds:number)=>{const current=link.current;current?.send({type:'end',from:current.me,attendedSeconds})},[]);

 // Connection statistics for telemetry; null while no peer is connected.
 const stats=useCallback(async()=>link.current?.connection()?.getStats()??null,[]);
 /* The whiteboard rides the signalling channel, so both sides see the same board without another
    service. Drawing still works alone when there is nobody to send to. */
 const board=useRef<BoardLink>({
  send:stroke=>link.current?.send({type:'board',from:link.current.me,stroke}),
  undo:strokeId=>link.current?.send({type:'board-undo',from:link.current.me,strokeId}),
  clear:()=>link.current?.send({type:'board-clear',from:link.current.me}),
  subscribe:handler=>{boardHandlers.current.add(handler);return()=>{boardHandlers.current.delete(handler)}},
 }).current;

 return{status,mediaReady,local,remote,share,peer,mediaError,unavailable,trouble,board,muted,camera,sharing:share!==null,ended,toggleMute,toggleCamera,toggleShare,end,stats};
}
export type PeerCall=ReturnType<typeof usePeerCall>;
