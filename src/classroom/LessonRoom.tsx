import{useEffect,useMemo,useState}from'react';import{useLocation,useNavigate,useParams}from'react-router-dom';import{Camera,Code2,Command,Hand,MessageCircle,Mic,MicOff,MonitorUp,MoreHorizontal,Notebook,PhoneOff,Settings,Video,Workflow,X}from'lucide-react';import{scheduleService,type Booking}from'../services/schedule.service';import{useAuth}from'../auth';import{useLessonTimer}from'../hooks/use-classroom';import type{ConnectionQuality}from'../types/classroom';import{ClassroomChat,LessonNotes}from'./panels';import{CallPanel,CallStage,ConnectionIndicator}from'./video';import{PeopleContext,callParties,firstName,initials,usePeerCall,type PeerCall}from'./call';import{callAccess,socketSignaling,type CallAccess,type LinkState}from'./connect';import{Whiteboard}from'./whiteboard';import{useSessionTelemetry}from'./telemetry';import{ConfirmModal}from'../ui-feedback';
/** Matches the default in useLessonTimer, so attended time is the part of it that has elapsed. */
const LESSON_SECONDS=50*60;
type Parties=ReturnType<typeof callParties>;
/** How the lobby hands over your device choices. */
type Entry={startMuted?:boolean;startCamera?:boolean}|null;
const quality:Record<PeerCall['status'],ConnectionQuality>={WAITING:'GOOD',CONNECTING:'POOR',CONNECTED:'EXCELLENT'};
export function PremiumLessonRoom(){const{bookingId}=useParams();const{state}=useLocation();const{user}=useAuth();const navigate=useNavigate();const[phase,setPhase]=useState<'CONNECTING'|'JOINING'|'READY'>('CONNECTING');
 // undefined while loading, null when the id isn't a booked session (the room still opens).
 const[session,setSession]=useState<Booking|null|undefined>(undefined);
 useEffect(()=>{if(!bookingId)return;let live=true;scheduleService.get(bookingId).then(found=>{if(live)setSession(found)}).catch(()=>{if(live)setSession(null)});return()=>{live=false}},[bookingId]);
 // undefined while asking, null when this server grants no call.
 const[access,setAccess]=useState<CallAccess|null|undefined>(undefined);
 const[refused,setRefused]=useState<string|null>(null);
 useEffect(()=>{if(!bookingId||refused)return;let live=true;callAccess(bookingId).then(found=>{if(live)setAccess(found)}).catch(problem=>{if(live)setRefused(problem instanceof Error?problem.message:'You cannot join this session right now.')});return()=>{live=false}},[bookingId,refused]);
 // A short settle while the session and the call ticket load, so the room does not flash open.
 useEffect(()=>{const joining=setTimeout(()=>setPhase('JOINING'),400);const ready=setTimeout(()=>setPhase('READY'),900);return()=>{clearTimeout(joining);clearTimeout(ready)}},[]);
 if(refused)return <JoiningState phase="ERROR" message={refused} retry={()=>setRefused(null)} dashboard={()=>navigate('/student/dashboard')}/>;
 if(phase!=='READY'||session===undefined||access===undefined)return <JoiningState phase={phase} retry={()=>setPhase('CONNECTING')} dashboard={()=>navigate('/student/dashboard')}/>;
 const parties=callParties(session,user?.id);const entry=state as Entry;
 const other=session?(user?.id===session.tutor.id?session.learner.id:session.tutor.id):null;
 return <Classroom bookingId={bookingId??'lesson'} title={session?.topic??'Practice session'} parties={parties} people={{me:user?.id??null,other}}
  startMuted={Boolean(entry?.startMuted)} startCamera={entry?.startCamera!==false} access={access}/>}
function Classroom({bookingId,title,parties,people,startMuted,startCamera,access}:{bookingId:string;title:string;parties:Parties;people:{me:string|null;other:string|null};startMuted:boolean;startCamera:boolean;access:CallAccess|null}){
 const nav=useNavigate();
 const timer=useLessonTimer();
 const{me,them,side}=parties;
 /* The two browsers find each other through the signalling service. Without it there is no call,
    and the room says so rather than leaving both people waiting on each other. */
 const[link,setLink]=useState<LinkState|null>(access?.signalUrl?{open:false}:null);
 const signaling=useMemo(()=>access?.signalUrl?(room:string)=>socketSignaling(room,access,setLink):undefined,[access]);
 const call=usePeerCall({room:bookingId,name:me.name,startMuted,startCamera,signaling,iceServers:access?.iceServers});
 useSessionTelemetry(bookingId,call);
 const[rightTab,setRightTab]=useState('CHAT');
 const[centerMode,setCenterMode]=useState<'WHITEBOARD'|'CALL'>('CALL');
 const[mobileTab,setMobileTab]=useState('CALL');
 const[end,setEnd]=useState(false);
 const[settings,setSettings]=useState(false);
 const[commands,setCommands]=useState(false);
 // Both sides settle with the same attended time, so whichever summary loads first bills correctly.
 const toSummary=(attendedSeconds:number)=>nav(`/lesson/${bookingId}/summary`,{state:{attendedSeconds,view:side}});
 const endForEveryone=()=>{const attendedSeconds=Math.max(0,LESSON_SECONDS-timer.seconds);call.end(attendedSeconds);toSummary(attendedSeconds)};
 useEffect(()=>{if(call.ended)toSummary(call.ended.attendedSeconds)},[call.ended]);// eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(call.peer?.sharing||call.sharing)setCenterMode('CALL')},[call.peer?.sharing,call.sharing]);
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{
   const mod=e.ctrlKey||e.metaKey;
   if(mod&&e.key.toLowerCase()==='k'){e.preventDefault();setCommands(true)}
   if(e.key==='Escape'){setCommands(false);setSettings(false);setEnd(false)}
  };
  window.addEventListener('keydown',key);
  return()=>window.removeEventListener('keydown',key);
 },[]);
 const action=(id:string)=>{
  if(id==='chat')setRightTab('CHAT');
  if(id==='notes')setRightTab('NOTES');
  if(id==='whiteboard')setCenterMode('WHITEBOARD');
  if(id==='call')setCenterMode('CALL');
  if(id==='settings')setSettings(true);
  if(id==='leave')setEnd(true);
  setCommands(false);
 };

 return <PeopleContext.Provider value={{me,them,connected:call.status==='CONNECTED'}}>
  <main className={`premium-classroom no-editor mobile-${mobileTab.toLowerCase()}`}>
   <LessonTopbar timer={timer} title={title} otherName={them.name} avatars={[initials(me.name),initials(them.name)]} quality={quality[call.status]} onSettings={()=>setSettings(true)} onLeave={()=>setEnd(true)}/>
   <div className="classroom-mobile-tabs">{['CALL','WHITEBOARD','CHAT','NOTES'].map(tab=>
    <button className={mobileTab===tab?'active':''} onClick={()=>{setMobileTab(tab);if(tab==='CHAT')setRightTab('CHAT');if(tab==='NOTES')setRightTab('NOTES');if(tab==='WHITEBOARD')setCenterMode('WHITEBOARD');if(tab==='CALL')setCenterMode('CALL')}} key={tab}>{tab}</button>)}</div>
   {call.unavailable&&<p className="call-unavailable">{call.unavailable} You can still use the whiteboard, chat and notes.</p>}
   <div className="classroom-grid">
    <div className="class-center">
     {centerMode==='CALL'?<CallStage call={call} me={me} them={them} link={link} onReturn={()=>setCenterMode('WHITEBOARD')}/>:<Whiteboard link={call.board}/>}
    </div>
    <aside className="class-right">
     <CallPanel call={call} me={me} them={them} link={link} focused={centerMode==='CALL'} onFocus={()=>setCenterMode('CALL')}/>
     <div className="right-tabs">{[['CHAT',MessageCircle],['NOTES',Notebook]].map(([tab,Icon])=>
      <button className={rightTab===tab?'active':''} onClick={()=>setRightTab(tab as string)} key={tab as string}><Icon/>{tab as string}</button>)}</div>
     <div className="right-content">{rightTab==='CHAT'?<ClassroomChat otherId={people.other} myId={people.me}/>:<LessonNotes bookingId={bookingId}/>}</div>
    </aside>
   </div>
   <CallControls muted={call.muted} camera={call.camera} sharing={call.sharing} onMute={call.toggleMute} onCamera={call.toggleCamera} onShare={call.toggleShare}
    onWhiteboard={()=>setCenterMode(centerMode==='WHITEBOARD'?'CALL':'WHITEBOARD')} onChat={()=>setRightTab('CHAT')} onMore={()=>setCommands(true)} onEnd={()=>setEnd(true)}/>
   {commands&&<CommandPalette onClose={()=>setCommands(false)} onAction={action}/>}
   {settings&&<ClassroomSettings onClose={()=>setSettings(false)}/>}
   <ConfirmModal open={end} title="End lesson for everyone?" description="The classroom will close and both participants will move to the lesson summary." confirmLabel="End lesson" onClose={()=>setEnd(false)} onConfirm={endForEveryone}/>
  </main>
 </PeopleContext.Provider>;
}

function LessonTopbar({timer,title,otherName,avatars,quality,onSettings,onLeave}:{timer:ReturnType<typeof useLessonTimer>;title:string;otherName:string;avatars:string[];quality:ConnectionQuality;onSettings:()=>void;onLeave:()=>void}){return <header className="class-topbar"><div className="class-brand"><span><Code2/></span><strong>pairlore</strong><i/></div><div className="class-title"><strong>{title}</strong><span>Session with {otherName}</span></div><div className="top-participants">{avatars.map((a,i)=><div key={i}>{a}</div>)}</div><ConnectionIndicator quality={quality}/><div className={`lesson-timer ${timer.state}`}><span>{timer.label}</span><small>{timer.state==='overtime'?'overtime':'remaining'}</small></div><button aria-label="Classroom settings" onClick={onSettings}><Settings/></button><button className="leave-btn" onClick={onLeave}>Leave lesson</button></header>}
function CallControls({muted,camera,sharing,onMute,onCamera,onShare,onWhiteboard,onChat,onMore,onEnd}:{muted:boolean;camera:boolean;sharing:boolean;onMute:()=>void;onCamera:()=>void;onShare:()=>void;onWhiteboard:()=>void;onChat:()=>void;onMore:()=>void;onEnd:()=>void}){return <div className="floating-controls"><Control label={muted?'Unmute':'Mute'} active={muted} onClick={onMute} icon={muted?<MicOff/>:<Mic/>}/><Control label={camera?'Camera':'Start video'} active={!camera} onClick={onCamera} icon={camera?<Camera/>:<Video/>}/><Control label={sharing?'Stop share':'Share screen'} active={sharing} onClick={onShare} icon={<MonitorUp/>}/><Control label="Raise hand" onClick={()=>{}} icon={<Hand/>}/><Control label="Whiteboard" onClick={onWhiteboard} icon={<Workflow/>}/><Control label="Chat" onClick={onChat} icon={<MessageCircle/>}/><Control label="More" onClick={onMore} icon={<MoreHorizontal/>}/><button className="end-call" onClick={onEnd}><PhoneOff/><span>End</span></button></div>}
function Control({label,icon,active,onClick}:{label:string;icon:React.ReactNode;active?:boolean;onClick:()=>void}){return <button className={active?'active':''} title={label} aria-label={label} onClick={onClick}>{icon}<span>{label}</span></button>}
function JoiningState({phase,message,retry,dashboard}:{phase:string;message?:string;retry:()=>void;dashboard:()=>void}){return <main className="joining-state"><div className="joining-mark"><Code2/></div>{phase==='ERROR'?<><h1>Unable to join lesson</h1><p>{message??'Check your connection and try again.'}</p><div><button className="btn" onClick={retry}>Try again</button><button className="btn ghost" onClick={dashboard}>Return to dashboard</button></div></>:<><div className="join-spinner"/><h1>{phase==='CONNECTING'?'Connecting to lesson…':'Joining classroom…'}</h1><p>Preparing your collaborative workspace</p></>}</main>}
function CommandPalette({onClose,onAction}:{onClose:()=>void;onAction:(id:string)=>void}){const[q,setQ]=useState('');const cmds=[['call','Show the call',''],['whiteboard','Open Whiteboard',''],['chat','Open Chat',''],['notes','Open Notes',''],['settings','Classroom settings',''],['leave','Leave Lesson','']].filter(x=>x[1].toLowerCase().includes(q.toLowerCase()));return <div className="palette-backdrop" onMouseDown={onClose}><div className="command-palette" onMouseDown={e=>e.stopPropagation()}><label><SearchIcon/><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Type a command…"/></label>{cmds.map(c=><button onClick={()=>onAction(c[0])} key={c[0]}><Command/>{c[1]}<kbd>{c[2]}</kbd></button>)}</div></div>}
function SearchIcon(){return <span>⌕</span>}
function ClassroomSettings({onClose}:{onClose:()=>void}){const[tab,setTab]=useState('Editor');return <div className="palette-backdrop"><div className="class-settings"><header><h2>Classroom settings</h2><button onClick={onClose}><X/></button></header><div className="settings-content"><nav>{['Audio','Video','Editor','Appearance','Shortcuts'].map(x=><button className={tab===x?'active':''} onClick={()=>setTab(x)} key={x}>{x}</button>)}</nav><section><h3>{tab}</h3><label>Font size<select defaultValue="14"><option>12</option><option>14</option><option>16</option><option>18</option></select></label><label>Word wrap<input type="checkbox" defaultChecked/></label><label>Show minimap<input type="checkbox" defaultChecked/></label><label>Tab size<select defaultValue="2"><option>2</option><option>4</option></select></label><button className="btn" onClick={onClose}>Save settings</button></section></div></div></div>}
