import{useCallback,useEffect,useRef,useState}from'react';
import{Link,useLocation,useNavigate,useParams}from'react-router-dom';
import{MessageCircle,Send}from'lucide-react';
import{DashboardShell}from'./components';
import{useAuth}from'./auth';
import{messagesService,type Conversation,type Message}from'./services/messages.service';

// The thread is polled while the page is open; live delivery arrives with its own epic.
const REFRESH_MS=10000;
const initials=(name:string)=>name.split(' ').map(part=>part[0]).join('').slice(0,2).toUpperCase();
const timeOf=(iso:string)=>new Date(iso).toLocaleTimeString('en',{hour:'numeric',minute:'2-digit'});
const dayOf=(iso:string)=>{
 const date=new Date(iso),today=new Date();
 if(date.toDateString()===today.toDateString())return 'Today';
 return date.toLocaleDateString('en',{month:'short',day:'numeric',year:date.getFullYear()===today.getFullYear()?undefined:'numeric'});
};

export function Messages(){
 const{pathname}=useLocation();
 const{conversationId}=useParams();
 const navigate=useNavigate();
 const{user}=useAuth();
 const role=pathname.startsWith('/tutor/')?'tutor':'student';
 const[conversations,setConversations]=useState<Conversation[]|null>(null);
 const[error,setError]=useState<string|null>(null);
 const open=conversations?.find(c=>c.id===conversationId)??conversations?.[0];

 // Stable, because the thread's polling restarts whenever these change.
 const markRead=useCallback((id:string)=>setConversations(current=>current?.map(c=>c.id===id?{...c,unread:0}:c)??null),[]);
 const loadConversations=useCallback(()=>messagesService.conversations()
  .then(setConversations)
  .catch(problem=>setError(problem instanceof Error?problem.message:'Your conversations could not be loaded.')),[]);
 useEffect(()=>{void loadConversations();const timer=setInterval(loadConversations,REFRESH_MS);return()=>clearInterval(timer)},[loadConversations]);

 return <DashboardShell role={role}>
  <div className="workspace-title"><div><h1>Messages</h1><p>Everyone you teach or learn from. A conversation opens as soon as you have a session together.</p></div></div>
  {error&&<p className="ledger-error">{error}</p>}
  {conversations&&!conversations.length
   ?<section className="workspace-empty"><MessageCircle/><h3>No conversations yet</h3>
     <p>{role==='student'?'Book a session and you can message that tutor from your lessons.':'When someone books you, you can message them from My Students.'}</p>
     <Link className="btn" to={role==='student'?'/tutors':'/tutor/students'}>{role==='student'?'Find a tutor':'My students'}</Link></section>
   :<div className="messages-layout">
     <aside className="conversation-list">
      {!conversations?<p className="org-empty">Loading…</p>:conversations.map(conversation=>
       <button key={conversation.id} className={conversation.id===open?.id?'conversation active':'conversation'}
        onClick={()=>navigate(`/${role}/messages/${conversation.id}`)}>
        <span className="avatar sm">{initials(conversation.otherName)}</span>
        <span className="conversation-copy"><strong>{conversation.otherName}</strong><small>{conversation.preview||'No messages yet'}</small></span>
        {conversation.unread>0&&<b className="unread">{conversation.unread}</b>}
       </button>)}
     </aside>
     {open?<Thread key={open.id} conversation={open} meId={user?.id??''} onSent={loadConversations} onRead={markRead}/>
      :<section className="thread"><p className="org-empty">Choose a conversation.</p></section>}
    </div>}
 </DashboardShell>;
}

function Thread({conversation,meId,onSent,onRead}:{conversation:Conversation;meId:string;onSent:()=>void;onRead:(id:string)=>void}){
 const[messages,setMessages]=useState<Message[]|null>(null);
 const[draft,setDraft]=useState('');
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);
 const foot=useRef<HTMLDivElement>(null);

 // Opening the thread marks it read on the server, so the badge goes at the same moment.
 const load=useCallback(()=>messagesService.messages(conversation.id)
  .then(page=>{setMessages(page.items);onRead(conversation.id)})
  .catch(problem=>setError(problem instanceof Error?problem.message:'This conversation could not be opened.')),[conversation.id,onRead]);
 useEffect(()=>{void load();const timer=setInterval(load,REFRESH_MS);return()=>clearInterval(timer)},[load]);
 useEffect(()=>{foot.current?.scrollIntoView({block:'end'})},[messages?.length]);

 const send=async(event:React.FormEvent)=>{
  event.preventDefault();
  if(!draft.trim())return;
  setBusy(true);setError(null);
  try{
   const sent=await messagesService.send(conversation.id,draft.trim());
   setMessages(current=>[...(current??[]),sent]);
   setDraft('');
   onSent();
  }catch(problem){setError(problem instanceof Error?problem.message:'That message did not send.')}
  finally{setBusy(false)}
 };

 let lastDay='';
 return <section className="thread">
  <header><span className="avatar sm">{initials(conversation.otherName)}</span><strong>{conversation.otherName}</strong></header>
  <div className="thread-body">
   {!messages?<p className="org-empty">Loading…</p>
    :!messages.length?<p className="org-empty">Say hello. Messages are kept with your sessions together.</p>
    :messages.map(message=>{
      const day=dayOf(message.createdAt);
      const divider=day!==lastDay;
      lastDay=day;
      return <div key={message.id}>
       {divider&&<div className="day">{day}</div>}
       <div className={message.senderId===meId?'bubble me':'bubble them'}>{message.body}<small>{timeOf(message.createdAt)}</small></div>
      </div>;
     })}
   <div ref={foot}/>
  </div>
  {error&&<p className="ledger-error">{error}</p>}
  <form className="message-input" onSubmit={send}>
   <input value={draft} onChange={event=>setDraft(event.target.value)} placeholder={`Message ${conversation.otherName.split(' ')[0]}…`} aria-label="Message"/>
   <button className="send" disabled={busy||!draft.trim()} aria-label="Send message"><Send size={15}/></button>
  </form>
 </section>;
}

/** Opens the conversation with someone and goes to it, from wherever they are named. */
export function MessageButton({userId,label='Message',className='btn ghost'}:{userId:string;label?:string;className?:string}){
 const{pathname}=useLocation();
 const navigate=useNavigate();
 const[busy,setBusy]=useState(false);
 const role=pathname.startsWith('/tutor/')?'tutor':'student';

 const open=async()=>{
  setBusy(true);
  try{
   const conversation=await messagesService.open(userId);
   navigate(`/${role}/messages/${conversation.id}`);
  }catch{navigate(`/${role}/messages`)}
  finally{setBusy(false)}
 };
 return <button type="button" className={className} onClick={open} disabled={busy}><MessageCircle size={15}/> {busy?'Opening…':label}</button>;
}
