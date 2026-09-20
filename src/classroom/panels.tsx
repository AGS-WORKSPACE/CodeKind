import{useEffect,useRef,useState}from'react';
import{Save,Send}from'lucide-react';
import{firstName,initials,usePeople}from'./call';
import{messagesService,type Message}from'../services/messages.service';

/* The lesson chat is the same thread as the messages page, so anything said here is still there
   afterwards. It is polled while the room is open, which is enough for a two-person lesson. */
export function ClassroomChat({otherId,myId}:{otherId:string|null;myId:string|null}){
 const{them}=usePeople();
 const[conversationId,setConversationId]=useState<string|null>(null);
 const[messages,setMessages]=useState<Message[]>([]);
 const[draft,setDraft]=useState('');
 const[error,setError]=useState('');
 const foot=useRef<HTMLDivElement>(null);

 useEffect(()=>{
  if(!otherId)return;
  let live=true;
  messagesService.open(otherId)
   .then(conversation=>{if(live)setConversationId(conversation.id)})
   .catch(problem=>{if(live)setError(problem instanceof Error?problem.message:'Chat is not available in this session.')});
  return()=>{live=false};
 },[otherId]);

 useEffect(()=>{
  if(!conversationId)return;
  let live=true;
  const read=()=>messagesService.messages(conversationId).then(page=>{if(live)setMessages(page.items)}).catch(()=>{/* the last page stays */});
  void read();
  const timer=setInterval(read,4000);
  return()=>{live=false;clearInterval(timer)};
 },[conversationId]);

 useEffect(()=>{foot.current?.scrollIntoView({block:'end'})},[messages.length]);

 const send=async(event:React.FormEvent)=>{
  event.preventDefault();
  const body=draft.trim();
  if(!body||!conversationId)return;
  setDraft('');
  try{const sent=await messagesService.send(conversationId,body);setMessages(current=>[...current,sent])}
  catch(problem){setError(problem instanceof Error?problem.message:'That message did not send.');setDraft(body)}
 };

 return <div className="class-chat">
  {error&&<p className="chat-error">{error}</p>}
  <div className="chat-log">
   {!messages.length&&<p className="chat-empty">No messages yet. Anything you write here stays in your thread with {firstName(them.name)}.</p>}
   {messages.map(message=>{
    const mine=message.senderId===myId;
    return <article className={mine?'mine':undefined} key={message.id}>
     {!mine&&<span className="chat-avatar">{initials(them.name)}</span>}
     <p>{message.body}</p>
    </article>;
   })}
   <div ref={foot}/>
  </div>
  <form className="chat-compose" onSubmit={send}>
   <input value={draft} onChange={event=>setDraft(event.target.value)} placeholder={`Message ${firstName(them.name)}…`} aria-label="Message"/>
   <button className="btn" disabled={!draft.trim()||!conversationId}><Send size={15}/> Send</button>
  </form>
 </div>;
}

/* Notes are yours alone and stay on this device, so nothing is promised that the backend does not
   keep. They are kept per lesson. */
export function LessonNotes({bookingId}:{bookingId:string}){
 const key=`pairlore.lesson-notes.${bookingId}`;
 const[notes,setNotes]=useState(()=>{try{return localStorage.getItem(key)??''}catch{return''}});
 const[saved,setSaved]=useState(true);
 useEffect(()=>{
  setSaved(false);
  const timer=setTimeout(()=>{try{localStorage.setItem(key,notes)}catch{/* storage blocked */}setSaved(true)},500);
  return()=>clearTimeout(timer);
 },[notes,key]);
 return <div className="lesson-notes">
  <div className="autosave"><Save/>{saved?'Saved on this device':'Saving…'}</div>
  <textarea value={notes} onChange={event=>setNotes(event.target.value)} placeholder="What you want to remember from this lesson."/>
  <small>Only you can see these.</small>
 </div>;
}

/** Who is in the room: you, and the other person once they have joined the call. */
function ParticipantList(){const{me,them,connected}=usePeople();return <div className="left-section participants"><div className="panel-label"><span>PARTICIPANTS · {connected?2:1}</span></div><p><i className="presence green"/><span>{me.name}<small>You · {me.role}</small></span></p><p><i className={connected?'presence purple':'presence away'}/><span>{them.name}<small>{them.role} · {connected?'in the call':'not joined yet'}</small></span></p></div>}
