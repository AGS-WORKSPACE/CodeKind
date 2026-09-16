import{useState}from'react';
import{RefreshCw}from'lucide-react';
import{useLoader}from'./hooks/use-payments';
import{errorLogService,type ErrorLogEntry,type ErrorSource}from'./services/error-log.service';
import{formatDateTime,relativeTime}from'./lib/money';

const SOURCES:[ErrorSource|'',string][]=[['','All'],['http','Requests'],['panic','Crashes'],['mail','Emails'],['search','Search'],['telemetry','Telemetry']];

/** Server failures saved by the backend, newest first, for debugging what users only saw as "something went wrong". */
export function AdminErrorLog(){
 const[source,setSource]=useState<ErrorSource|''>('');
 const[open,setOpen]=useState<string|null>(null);
 const logs=useLoader(()=>errorLogService.recent(source),[source]);
 const rows=logs.data??[];

 return <div className="admin-page">
  <header className="admin-page-head">
   <div><span>Platform</span><h1>Error log</h1><p>The real errors behind failed requests, crashes and emails that could not be sent. Users only saw a general message.</p></div>
   <div><button type="button" className="btn ghost small" onClick={()=>logs.reload()} disabled={logs.loading}><RefreshCw size={14}/> Refresh</button></div>
  </header>

  <div className="error-log-filters">{SOURCES.map(([value,name])=><button type="button" className={source===value?'active':''} onClick={()=>setSource(value)} key={name}>{name}</button>)}</div>

  {logs.error&&<p className="ledger-error">{logs.error}</p>}
  <div className="admin-table-wrap">
   <table className="admin-table error-log-table">
    <thead><tr><th>WHEN</th><th>SOURCE</th><th>REQUEST</th><th>ERROR</th></tr></thead>
    <tbody>
     {logs.loading&&!rows.length&&<tr><td colSpan={4}>Loading…</td></tr>}
     {!logs.loading&&!logs.error&&!rows.length&&<tr><td colSpan={4}>Nothing has gone wrong{source?' here':''}. 🎉</td></tr>}
     {rows.map(row=><ErrorRow row={row} open={open===row.id} onToggle={()=>setOpen(open===row.id?null:row.id)} key={row.id}/>)}
    </tbody>
   </table>
  </div>
 </div>;
}

function ErrorRow({row,open,onToggle}:{row:ErrorLogEntry;open:boolean;onToggle:()=>void}){
 return <>
  <tr className="error-log-row" onClick={onToggle}>
   <td title={formatDateTime(row.createdAt)}>{relativeTime(row.createdAt)}</td>
   <td><span className={`error-source ${row.source}`}>{row.source}</span></td>
   <td>{row.path?<code>{row.status} {row.method} {row.path}</code>:<small>—</small>}</td>
   <td className="error-message">{row.message}</td>
  </tr>
  {open&&<tr className="error-log-detail"><td colSpan={4}>
   <dl>
    <dt>Time</dt><dd>{formatDateTime(row.createdAt)}</dd>
    <dt>User</dt><dd>{row.userId??'Not signed in'}</dd>
    {row.detail&&<><dt>{row.source==='panic'?'Stack':'Detail'}</dt><dd><pre>{row.detail}</pre></dd></>}
    <dt>Message</dt><dd><pre>{row.message}</pre></dd>
   </dl>
  </td></tr>}
 </>;
}
