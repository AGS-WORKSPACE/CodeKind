import{useCallback,useEffect,useRef,useState}from'react';import{CameraOff,ChevronDown,ChevronUp,ExternalLink,Maximize2,MicOff,Minimize2,Volume2,Wifi}from'lucide-react';import type{ConnectionQuality}from'../types/classroom';
import{firstName,initials,type CallParty,type PeerCall}from'./call';

/** Binds a MediaStream to a <video>. Remote audio can be refused by autoplay rules; then it plays
    muted and `onBlocked` lets the caller offer a "turn on sound" button. */
export function StreamVideo({stream,muted=false,mirrored=false,hidden=false,contain=false,onBlocked}:{stream:MediaStream;muted?:boolean;mirrored?:boolean;hidden?:boolean;contain?:boolean;onBlocked?:()=>void}){
 const ref=useRef<HTMLVideoElement>(null);
 useEffect(()=>{const video=ref.current;if(!video)return;if(video.srcObject!==stream)video.srcObject=stream;video.muted=muted;video.play().catch(()=>{if(muted)return;video.muted=true;video.play().catch(()=>{});onBlocked?.()})},[stream,muted,onBlocked]);
 return <video ref={ref} className={`stream-video${mirrored?' mirrored':''}${hidden?' hidden':''}${contain?' contain':''}`} autoPlay playsInline/>;
}

const statusLabel=(call:PeerCall,them:CallParty)=>call.status==='CONNECTED'?'Live · peer to peer':call.status==='CONNECTING'?'Connecting…':`Waiting for ${firstName(them.name)}`;

/** The other person. Its <video> is the only thing playing their audio, so render it once. */
function RemoteTile({call,them,onInvite,large=false}:{call:PeerCall;them:CallParty;onInvite:()=>void;large?:boolean}){
 const[soundBlocked,setSoundBlocked]=useState(false);const blocked=useCallback(()=>setSoundBlocked(true),[]);
 const first=firstName(them.name);
 const connected=call.status==='CONNECTED'&&call.remote;
 const starting=!call.peer?.ready;
 const sharing=Boolean(call.peer?.sharing);
 const cameraOff=!sharing&&(starting||!call.peer?.camera);
 return <article className={`video-tile remote${large?' large':''}${connected?' live':''}`}>
  <div className="video-person">
   {call.remote&&<StreamVideo key={soundBlocked?'blocked':'open'} stream={call.remote} muted={soundBlocked} contain={sharing} hidden={!connected||cameraOff} onBlocked={blocked}/>}
   {!connected?<div className="call-waiting"><div className="avatar-video">{initials(them.name)}</div><strong>{call.status==='CONNECTING'?`Connecting to ${first}…`:`Waiting for ${first} to join`}</strong>
     {call.status!=='CONNECTING'&&<><button type="button" onClick={onInvite}><ExternalLink/> Open {first}’s side in a new tab</button><small>Demo: the call connects between tabs of this browser.</small></>}</div>
    :cameraOff?<div className="camera-off"><div>{initials(them.name)}</div>{!starting&&<CameraOff/>}<span>{starting?`${first} is starting their camera…`:`${first}’s camera is off`}</span></div>:null}
   {soundBlocked&&<button type="button" className="sound-unlock" onClick={()=>setSoundBlocked(false)}><Volume2/> Turn on {first}’s sound</button>}
  </div>
  <footer><span><i className={connected?'live':''}/>{sharing&&connected?`${first} is sharing their screen`:them.name}{them.role==='Tutor'&&<b>Tutor</b>}</span>{call.peer?.muted&&connected&&<MicOff aria-label={`${first} is muted`}/>}</footer>
 </article>;
}

function SelfTile({call,me,pip=false}:{call:PeerCall;me:CallParty;pip?:boolean}){
 const showVideo=call.share??(call.local&&call.camera&&call.local.getVideoTracks().length>0?call.local:null);
 return <article className={`video-tile self${pip?' pip':''}`}>
  <div className="video-person">
   {showVideo?<StreamVideo stream={showVideo} muted mirrored={!call.sharing} contain={call.sharing}/>:<div className="camera-off"><div>{initials(me.name)}</div>{call.mediaReady&&<CameraOff/>}<span>{!call.mediaReady?'Starting camera…':call.mediaError??'Your camera is off'}</span></div>}
  </div>
  <footer><span>{call.sharing?'You · sharing your screen':`You · ${me.name}`}</span>{call.muted&&<MicOff aria-label="You are muted"/>}</footer>
 </article>;
}

/** Sidebar call panel. While the call is open in the main view, it steps aside so audio plays once. */
export function CallPanel({call,me,them,onInvite,focused,onFocus,demoTab}:{call:PeerCall;me:CallParty;them:CallParty;onInvite:()=>void;focused:boolean;onFocus:()=>void;demoTab:boolean}){
 const[collapsed,setCollapsed]=useState(false);
 return <div className={`video-panel${collapsed?' minimized':''}${call.status!=='CONNECTED'?' waiting':''}`}>
  <header><span className={call.status==='CONNECTED'?'live':''}>{statusLabel(call,them)}</span><div>{!focused&&<button type="button" aria-label="Show the call in the main view" title="Focus call" onClick={onFocus}><Maximize2/></button>}<button type="button" aria-label={collapsed?'Show videos':'Hide videos'} onClick={()=>setCollapsed(!collapsed)}>{collapsed?<ChevronDown/>:<ChevronUp/>}</button></div></header>
  {demoTab&&!collapsed&&<p className="call-demo-note">Demo tab: you are {me.name}. Your mic started muted so the two tabs don’t echo.</p>}
  {!collapsed&&(focused?<p className="call-focused">The call is open in the main view.</p>:<><RemoteTile call={call} them={them} onInvite={onInvite}/><SelfTile call={call} me={me}/></>)}
 </div>;
}

/** The call as the main view: the other person large, you picture-in-picture. */
export function CallStage({call,me,them,onInvite,onReturn}:{call:PeerCall;me:CallParty;them:CallParty;onInvite:()=>void;onReturn:()=>void}){
 return <div className="call-stage"><RemoteTile call={call} them={them} onInvite={onInvite} large/><SelfTile call={call} me={me} pip/><button type="button" className="call-stage-back" onClick={onReturn}><Minimize2/> Back to the editor</button></div>;
}

export function ConnectionIndicator({quality}:{quality:ConnectionQuality}){return <div className={`connection ${quality.toLowerCase()}`} title={`Connection: ${quality.toLowerCase()}`}><Wifi/><span>{quality[0]+quality.slice(1).toLowerCase()}</span></div>}
