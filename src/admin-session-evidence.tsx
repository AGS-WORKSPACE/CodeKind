import{useState}from'react';
import{Search}from'lucide-react';
import{evidenceService,type Evidence,type EvidenceEvent,type EvidenceSide}from'./services/evidence.service';
import type{Booking}from'./services/schedule.service';

const minutes=(seconds:number)=>`${Math.floor(seconds/60)} min ${seconds%60} s`;
const share=(part:number,whole:number)=>whole?`${Math.round(part/whole*100)}%`:'—';
const time=(iso:string)=>new Date(iso).toLocaleTimeString('en',{hour:'numeric',minute:'2-digit',second:'2-digit'});

/** What a session's telemetry shows, for deciding appeals. Presence is what the server saw;
    media flow is what the browsers reported. */
export function AdminSessionEvidence(){
 const[id,setId]=useState('');
 const[result,setResult]=useState<{evidence:Evidence;booking:Booking}|null>(null);
 const[error,setError]=useState('');
 const[busy,setBusy]=useState(false);
 const load=async(event:React.FormEvent)=>{
  event.preventDefault();setBusy(true);setError('');setResult(null);
  try{setResult(await evidenceService.forAdmin(id.trim()))}
  catch(problem){setError(problem instanceof Error?problem.message:'Could not load the evidence')}
  finally{setBusy(false)}
 };

 return <div className="admin-page">
  <header className="admin-page-head"><div><span>Trust & quality</span><h1>Session evidence</h1><p>Who joined, how long both people were there, and whether audio and video were flowing. Use it to decide appeals.</p></div></header>
  <form className="admin-table-tools" onSubmit={load}>
   <div><Search/><input value={id} onChange={e=>setId(e.target.value)} placeholder="Session id, from the lesson link"/></div>
   <button className="btn" disabled={busy||!id.trim()}>{busy?'Loading…':'Show evidence'}</button>
  </form>
  {error&&<p className="ledger-error">{error}</p>}
  {result&&<EvidenceView {...result}/>}
 </div>;
}

function EvidenceView({evidence,booking}:{evidence:Evidence;booking:Booking}){
 const scheduled=(new Date(evidence.scheduledTo).getTime()-new Date(evidence.scheduledFrom).getTime())/1000;
 return <>
  <section className="evidence-head">
   <h2>{booking.topic}</h2>
   <p>{booking.learner.name} with {booking.tutor.name} · scheduled {new Date(evidence.scheduledFrom).toLocaleString('en',{dateStyle:'medium',timeStyle:'short'})} for {booking.durationMinutes} minutes · {booking.status}</p>
  </section>
  <div className="admin-metrics">
   <article><p>Together</p><h3>{minutes(evidence.togetherSeconds)}</h3><span>{share(evidence.togetherSeconds,scheduled)} of the scheduled time</span></article>
   <SideCard title={`Learner · ${booking.learner.name}`} side={evidence.learner}/>
   <SideCard title={`Tutor · ${booking.tutor.name}`} side={evidence.tutor}/>
   <article><p>Events</p><h3>{evidence.serverEvents+evidence.clientEvents}</h3><span>{evidence.serverEvents} seen by the server · {evidence.clientEvents} reported by browsers</span></article>
  </div>
  <div className="admin-table-wrap">
   <table className="admin-table evidence-table">
    <thead><tr><th>TIME</th><th>WHO</th><th>EVENT</th><th>SOURCE</th><th>DETAIL</th></tr></thead>
    <tbody>
     {!evidence.timeline.length&&<tr><td colSpan={5}>No events recorded for this session.</td></tr>}
     {evidence.timeline.map(event=><TimelineRow event={event} key={event.eventId}/>)}
    </tbody>
   </table>
  </div>
 </>;
}

function SideCard({title,side}:{title:string;side:EvidenceSide}){
 return <article>
  <p>{title}</p>
  <h3>{minutes(side.presentSeconds)}</h3>
  <span>Audio flowing {share(side.audioFlowing,side.samples)} · video {share(side.videoFlowing,side.samples)}{side.reconnects?` · ${side.reconnects} reconnects`:''}</span>
 </article>;
}

function TimelineRow({event}:{event:EvidenceEvent}){
 const detail=Object.entries(event.payload).map(([key,value])=>`${key}: ${String(value)}`).join(', ');
 return <tr>
  <td>{time(event.occurredAt)}</td>
  <td>{event.actorSide??'—'}</td>
  <td><code>{event.type}</code></td>
  <td><span className={`evidence-source ${event.source}`}>{event.source==='server'?'seen by server':'reported by browser'}</span></td>
  <td>{detail||'—'}</td>
 </tr>;
}
