import{ApiError,api}from'../services/api';
import type{Signal,SignalingChannel}from'./call';

export type CallAccess={signalUrl:string;ticket:string;iceServers:RTCIceServer[]};

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isBookingId=(id:string)=>UUID.test(id);

const RETRY_MS=[1000,2000,5000,10000];
const MAX_PENDING=100;

/** A ticket and servers for the call, or null when the backend has no say: a demo session, or no API.
    Throws when the backend refuses, such as a room that is not open yet. */
export async function callAccess(sessionId:string):Promise<CallAccess|null>{
 if(!isBookingId(sessionId))return null;
 try{return await api<CallAccess>(`/sessions/${sessionId}/connect`,{method:'POST'})}
 catch(problem){if(problem instanceof ApiError&&problem.status!==404)throw problem;return null}
}

export type LinkState={open:boolean;reason?:string};

/** Signals through the signaling service. A dropped socket reconnects with a fresh ticket, and sends
    the hello again so the other side knows this tab is still here. Other messages wait for the socket.
    onState reports whether the socket is up, so the room can say when the two sides cannot meet. */
export function socketSignaling(sessionId:string,first:CallAccess,onState?:(state:LinkState)=>void):SignalingChannel{
 const handlers=new Set<(signal:Signal)=>void>();
 const pending:string[]=[];
 let socket:WebSocket|null=null;
 let hello:string|null=null;
 let attempt=0;
 let closed=false;

 const connect=(access:CallAccess)=>{
  const ws=new WebSocket(`${access.signalUrl}?ticket=${encodeURIComponent(access.ticket)}`);
  socket=ws;
  ws.onopen=()=>{
   attempt=0;
   onState?.({open:true});
   if(hello)ws.send(hello);
   pending.splice(0).forEach(message=>ws.send(message));
  };
  ws.onmessage=event=>{
   try{const signal=JSON.parse(event.data) as Signal;handlers.forEach(handler=>handler(signal))}
   catch{/* not a signal */}
  };
  ws.onclose=event=>{
   if(closed||socket!==ws)return;
   onState?.({open:false,reason:event.reason||(event.code===1006?'the call service could not be reached':`the call service closed the connection (${event.code})`)});
   retry();
  };
 };

 // Stops only when the backend refuses a new ticket, such as after the session has ended.
 const retry=()=>{
  const wait=RETRY_MS[Math.min(attempt++,RETRY_MS.length-1)];
  setTimeout(()=>{
   if(closed)return;
   callAccess(sessionId)
    .then(access=>{if(closed)return;if(access?.signalUrl)connect(access);else{onState?.({open:false,reason:'this server has no call service configured'});retry()}})
    .catch(problem=>{if(problem instanceof ApiError)onState?.({open:false,reason:problem.message});else retry()});
  },wait);
 };

 connect(first);
 return{
  send:signal=>{
   const message=JSON.stringify(signal);
   const open=socket?.readyState===WebSocket.OPEN;
   if(signal.type==='hello'&&!signal.reply)hello=message;
   if(open)socket!.send(message);
   else if(signal.type!=='hello'&&pending.length<MAX_PENDING)pending.push(message);
  },
  subscribe:handler=>{handlers.add(handler);return()=>{handlers.delete(handler)}},
  close:()=>{closed=true;socket?.close()},
 };
}
