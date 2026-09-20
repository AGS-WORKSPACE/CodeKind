import{useEffect,useState}from'react';
import{api,offlineFallback}from'./api';

export type NotificationKind='lesson'|'message'|'assignment'|'payment'|'review'|'approval'|'account';
export type AppNotification={id:string;kind:NotificationKind;title:string;body:string;link:string|null;read:boolean;createdAt:string};
export type Inbox={items:AppNotification[];unread:number};

const hoursAgo=(hours:number)=>new Date(Date.now()-hours*3600_000).toISOString();
let demo:AppNotification[]=[
 {id:'n1',kind:'lesson',title:'Lesson starts tomorrow',body:'React hooks with Maya at 3:30 PM.',link:null,read:false,createdAt:hoursAgo(.2)},
 {id:'n2',kind:'message',title:'New message from Maya',body:'I reviewed your weather dashboard.',link:null,read:false,createdAt:hoursAgo(1)},
 {id:'n3',kind:'assignment',title:'New assignment',body:'Build a weather card component by Friday.',link:null,read:true,createdAt:hoursAgo(26)},
 {id:'n4',kind:'payment',title:'Payment receipt ready',body:'Your $42 lesson payment was successful.',link:null,read:true,createdAt:hoursAgo(50)},
];
const demoInbox=async():Promise<Inbox>=>({items:demo,unread:demo.filter(n=>!n.read).length});

export const notificationService={
 inbox:()=>offlineFallback(()=>api<Inbox>('/notifications'),demoInbox),
 markRead:(id:string)=>offlineFallback(
  ()=>api<unknown>(`/notifications/${id}/read`,{method:'POST'}).then(()=>undefined),
  async()=>{demo=demo.map(n=>n.id===id?{...n,read:true}:n)}),
 markAllRead:()=>offlineFallback(
  ()=>api<unknown>('/notifications/read-all',{method:'POST'}).then(()=>undefined),
  async()=>{demo=demo.map(n=>({...n,read:true}))}),
};

/* The bell sits on every page while a notification can arrive at any moment, so the unread count is
   kept in one place: read again on a timer, when the tab comes back, and after the inbox is read. */
let unread=0;
const watchers=new Set<(count:number)=>void>();
export const countUnread=()=>notificationService.inbox()
 .then(inbox=>{unread=inbox.unread;watchers.forEach(watcher=>watcher(unread))})
 .catch(()=>{/* leave the last count alone */});

export function useUnread(enabled=true){
 const[count,setCount]=useState(unread);
 useEffect(()=>{
  if(!enabled)return;
  watchers.add(setCount);
  void countUnread();
  const timer=setInterval(countUnread,60_000);
  const onReturn=()=>{if(!document.hidden)void countUnread()};
  document.addEventListener('visibilitychange',onReturn);
  return()=>{watchers.delete(setCount);clearInterval(timer);document.removeEventListener('visibilitychange',onReturn)};
 },[enabled]);
 return enabled?count:0;
}
