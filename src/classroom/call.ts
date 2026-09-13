import{createContext,useCallback,useContext,useEffect,useRef,useState}from'react';
import type{SessionPayment}from'../types/payments';

// ---------------------------------------------------------------------------
// Who is who in a session
// ---------------------------------------------------------------------------

export type CallSide='tutor'|'learner';
export type CallParty={name:string;role:'Tutor'|'Learner'};

/** Your side comes from the session (the payee teaches). `?as=tutor|learner` overrides it, so one
    person can demo both ends of a call from two tabs of the same browser. */
export function callParties(session:SessionPayment|null,userId:string|undefined,as:string|null){
 const override:CallSide|null=as==='tutor'||as==='learner'?as:null;
 const side:CallSide=override??(session&&userId===session.payeeId?'tutor':'learner');
 const tutor:CallParty={name:session?.payeeName??'Your tutor',role:'Tutor'};
 const learner:CallParty={name:session?.payerName??'Your learner',role:'Learner'};
 return{side,otherSide:(side==='tutor'?'learner':'tutor') as CallSide,demoTab:Boolean(override),me:side==='tutor'?tutor:learner,them:side==='tutor'?learner:tutor};
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
 |{type:'media';from:string;muted:boolean;camera:boolean;ready:boolean}
 |{type:'end';from:string;attendedSeconds:number}
 |{type:'bye';from:string};

export type SignalingChannel={send:(signal:Signal)=>void;subscribe:(handler:(signal:Signal)=>void)=>()=>void;close:()=>void};

/* Tabs of one browser, over BroadcastChannel: enough to demo a real call on one computer with no
   server. For calls between devices, a WebSocket channel from the backend (one room per session id,
   relaying these same Signal messages) replaces this function and nothing else changes. */
export function browserSignaling(room:string):SignalingChannel{
 const channel=new BroadcastChannel(`pairlore-call:${room}`);
 const handlers=new Set<(signal:Signal)=>void>();
 channel.onmessage=event=>handlers.forEach(handler=>handler(event.data as Signal));
 return{send:signal=>channel.postMessage(signal),subscribe:handler=>{handlers.add(handler);return()=>{handlers.delete(handler)}},close:()=>channel.close()};
}

// ---------------------------------------------------------------------------
// The call
// ---------------------------------------------------------------------------

export type CallStatus='WAITING'|'CONNECTING'|'CONNECTED';
/** `ready` is false while their camera/mic request is still pending (a permission prompt, say). */
export type PeerInfo={name:string;muted:boolean;camera:boolean;ready:boolean};

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
export function usePeerCall({room,name,startMuted=false,startCamera=true,signaling=browserSignaling}:{room:string;name:string;startMuted?:boolean;startCamera?:boolean;signaling?:(room:string)=>SignalingChannel}){
 const[status,setStatus]=useState<CallStatus>('WAITING');
 const[mediaReady,setMediaReady]=useState(false);
 const[local,setLocal]=useState<MediaStream|null>(null);
 const[remote,setRemote]=useState<MediaStream|null>(null);
 const[peer,setPeer]=useState<PeerInfo|null>(null);
 const[mediaError,setMediaError]=useState<string|null>(null);
 const[muted,setMuted]=useState(startMuted);
 const[camera,setCamera]=useState(startCamera);
 const[ended,setEnded]=useState<{attendedSeconds:number}|null>(null);
 const media=useRef({muted:startMuted,camera:startCamera});
 const nameRef=useRef(name);nameRef.current=name;
 const link=useRef<{send:(signal:Signal)=>void;announce:()=>void;stream:MediaStream|null;me:string}|null>(null);

 useEffect(()=>{
  const me=crypto.randomUUID(); // per mount, so a reloaded tab counts as a new arrival
  const channel=signaling(room);
  let disposed=false;
  let pc:RTCPeerConnection|null=null;
  let peerId:string|null=null;
  let stream:MediaStream|null=null;
  let queued:RTCIceCandidateInit[]=[];
  let settled=false; // the camera/mic request has finished, one way or the other
  const send=(signal:Signal)=>{if(!disposed)channel.send(signal)};
  const announce=()=>send({type:'media',from:me,ready:settled,muted:media.current.muted||!stream?.getAudioTracks().length,camera:media.current.camera&&Boolean(stream?.getVideoTracks().length)});
  link.current={send,announce,stream:null,me};

  const attachTracks=(conn:RTCPeerConnection)=>{for(const slot of conn.getTransceivers()){const track=stream?.getTracks().find(t=>t.kind===slot.receiver.track.kind)??null;if(slot.sender.track!==track)slot.sender.replaceTrack(track).catch(()=>{})}};
  const reset=()=>{pc?.close();pc=null;peerId=null;queued=[];setRemote(null);setPeer(null);setStatus('WAITING')};
  // The offerer creates the audio/video slots; the answerer adopts the offer's (slots made with
  // addTransceiver are never matched to a remote offer, so pre-creating them there would send nothing).
  const open=(other:string,offerer:boolean)=>{
   pc?.close();queued=[];peerId=other;
   const conn=new RTCPeerConnection();
   pc=conn;
   if(offerer){conn.addTransceiver('audio',{direction:'sendrecv'});conn.addTransceiver('video',{direction:'sendrecv'});attachTracks(conn)}
   const incoming=new MediaStream();
   conn.ontrack=event=>{if(conn!==pc)return;incoming.addTrack(event.track);setRemote(new MediaStream(incoming.getTracks()))};
   conn.onicecandidate=event=>{if(event.candidate)send({type:'ice',from:me,to:other,candidate:event.candidate.toJSON()})};
   conn.onconnectionstatechange=()=>{if(conn!==pc)return;const state=conn.connectionState;if(state==='connected')setStatus('CONNECTED');else if(state==='disconnected')setStatus('CONNECTING');else if(state==='failed')reset()};
   setStatus('CONNECTING');
   return conn;
  };
  const flush=async()=>{for(const candidate of queued.splice(0))await pc?.addIceCandidate(candidate).catch(()=>{})};

  const handle=async(signal:Signal)=>{
   if(disposed||signal.from===me||('to' in signal&&signal.to!==me))return;
   switch(signal.type){
    case 'hello':{
     setPeer(current=>({name:signal.name,muted:current?.muted??false,camera:current?.camera??false,ready:current?.ready??false}));
     if(signal.reply)return;
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
    case 'media':setPeer(current=>current&&{...current,muted:signal.muted,camera:signal.camera,ready:signal.ready});return;
    case 'end':setEnded({attendedSeconds:signal.attendedSeconds});return;
    case 'bye':if(!peerId||peerId===signal.from)reset();return;
   }
  };

  acquireMedia()
   .then(acquired=>{if(disposed){acquired.getTracks().forEach(track=>track.stop());return}stream=acquired;if(link.current)link.current.stream=acquired;acquired.getAudioTracks().forEach(track=>{track.enabled=!media.current.muted});acquired.getVideoTracks().forEach(track=>{track.enabled=media.current.camera});if(!acquired.getVideoTracks().length){media.current.camera=false;setCamera(false)}setLocal(acquired);if(pc)attachTracks(pc)})
   .catch(error=>{if(disposed)return;setMediaError(mediaProblem(error));media.current={muted:true,camera:false};setMuted(true);setCamera(false)})
   .finally(()=>{if(disposed)return;settled=true;setMediaReady(true);announce()});
  let chain:Promise<unknown>=Promise.resolve();
  const unsubscribe=channel.subscribe(signal=>{chain=chain.then(()=>handle(signal)).catch(()=>{})});
  send({type:'hello',from:me,name:nameRef.current});
  const bye=()=>channel.send({type:'bye',from:me});
  window.addEventListener('pagehide',bye);
  return()=>{bye();disposed=true;window.removeEventListener('pagehide',bye);unsubscribe();channel.close();pc?.close();stream?.getTracks().forEach(track=>track.stop());link.current=null};
 },[room,signaling]);

 const toggleMute=useCallback(()=>{const next=!media.current.muted;media.current.muted=next;setMuted(next);link.current?.stream?.getAudioTracks().forEach(track=>{track.enabled=!next});link.current?.announce()},[]);
 const toggleCamera=useCallback(()=>{const stream=link.current?.stream;if(!stream?.getVideoTracks().length)return;const next=!media.current.camera;media.current.camera=next;setCamera(next);stream.getVideoTracks().forEach(track=>{track.enabled=next});link.current?.announce()},[]);
 /** Ends the session for both sides; the other tab moves to the summary with the same attended time. */
 const end=useCallback((attendedSeconds:number)=>{const current=link.current;current?.send({type:'end',from:current.me,attendedSeconds})},[]);

 return{status,mediaReady,local,remote,peer,mediaError,muted,camera,ended,toggleMute,toggleCamera,end};
}
export type PeerCall=ReturnType<typeof usePeerCall>;
