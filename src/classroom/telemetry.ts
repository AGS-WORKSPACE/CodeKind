import{useEffect,useRef}from'react';
import{api,apiUrl}from'../services/api';
import type{PeerCall}from'./call';
import{isBookingId}from'./connect';

const SAMPLE_EVERY=10_000;

type Kind='media.state'|'media.sample'|'connection.degraded'|'participant.reconnected';
type ClientEvent={eventId:string;type:Kind;occurredAt:string;sequence:number;payload:Record<string,unknown>};
type Totals={audioSent:number;videoSent:number;audioReceived:number;videoReceived:number;packetsLost:number};

/** Adds up the byte counters in a stats report, so each sample can report the change since the last. */
function totals(report:RTCStatsReport){
 const sum:Totals={audioSent:0,videoSent:0,audioReceived:0,videoReceived:0,packetsLost:0};
 let rttMs:number|null=null;
 report.forEach(stat=>{
  if(stat.type==='outbound-rtp')sum[stat.kind==='audio'?'audioSent':'videoSent']+=stat.bytesSent??0;
  if(stat.type==='inbound-rtp'){sum[stat.kind==='audio'?'audioReceived':'videoReceived']+=stat.bytesReceived??0;sum.packetsLost+=stat.packetsLost??0}
  if(stat.type==='candidate-pair'&&stat.nominated&&stat.currentRoundTripTime!==undefined)rttMs=Math.round(stat.currentRoundTripTime*1000);
 });
 return{sum,rttMs};
}

/** Reports what happens in the room to the session's evidence record. The server records joining
    and leaving itself; everything sent from here is stored as the browser's claim. */
export function useSessionTelemetry(sessionId:string,call:PeerCall){
 const enabled=isBookingId(sessionId);
 const queue=useRef<ClientEvent[]>([]);
 const sequence=useRef(0);
 const callRef=useRef(call);callRef.current=call;

 const push=(type:Kind,payload:Record<string,unknown>)=>{
  if(!enabled)return;
  queue.current.push({eventId:crypto.randomUUID(),type,occurredAt:new Date().toISOString(),sequence:++sequence.current,payload});
 };

 // Joining and leaving. Leaving goes as a beacon, which survives the tab closing.
 useEffect(()=>{
  if(!enabled)return;
  const base=`/sessions/${sessionId}`;
  api(`${base}/join`,{method:'POST'}).catch(()=>{});
  const send=(path:string,body:unknown)=>navigator.sendBeacon(apiUrl(path),new Blob([JSON.stringify(body)],{type:'application/json'}));
  const leave=()=>{
   if(queue.current.length)send(`${base}/events`,{events:queue.current.splice(0)});
   send(`${base}/leave`,{reason:'left the room'});
  };
  window.addEventListener('pagehide',leave);
  return()=>{window.removeEventListener('pagehide',leave);leave()};
 },[enabled,sessionId]);

 // A sample every ten seconds, sent with whatever else has queued up.
 useEffect(()=>{
  if(!enabled)return;
  let previous:Totals|null=null;
  const timer=setInterval(async()=>{
   const report=await callRef.current.stats().catch(()=>null);
   if(report){
    const{sum,rttMs}=totals(report);
    const change=previous?Object.fromEntries(Object.entries(sum).map(([key,value])=>[key,Math.max(0,value-previous![key as keyof Totals])])):sum;
    previous=sum;
    push('media.sample',{...change,rttMs,connected:callRef.current.status==='CONNECTED'});
   }else push('media.sample',{audioSent:0,videoSent:0,audioReceived:0,videoReceived:0,connected:false});
   const events=queue.current.splice(0);
   if(events.length)api(`/sessions/${sessionId}/events`,{method:'POST',body:JSON.stringify({events})}).catch(()=>{queue.current.unshift(...events.slice(-50))});
  },SAMPLE_EVERY);
  return()=>clearInterval(timer);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[enabled,sessionId]);

 // Camera, mic and screen share changes.
 useEffect(()=>{push('media.state',{muted:call.muted,camera:call.camera,sharing:call.sharing})},
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [call.muted,call.camera,call.sharing]);

 // Losing the connection, and getting it back. The other person leaving is not a lost connection.
 const lastStatus=useRef(call.status);
 const dropped=useRef(false);
 useEffect(()=>{
  const before=lastStatus.current;lastStatus.current=call.status;
  if(before==='CONNECTED'&&call.status==='CONNECTING'){dropped.current=true;push('connection.degraded',{status:'connecting'})}
  if(call.status==='CONNECTED'&&dropped.current){dropped.current=false;push('participant.reconnected',{})}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[call.status]);
}
