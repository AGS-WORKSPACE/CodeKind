import{useMemo,useState}from'react';
import{useNavigate}from'react-router-dom';
import{Search}from'lucide-react';
import{useToast}from'./ui-feedback';
import{useLoader}from'./hooks/use-payments';
import{referenceService,type AdminReferenceItem,type ReferenceKind}from'./services/reference.service';

const KINDS:[ReferenceKind,string,string][]=[
 ['skills','Skills','What tutors can teach and learners can search for.'],
 ['countries','Countries','Offered wherever someone picks where they live.'],
 ['timezones','Timezones','Offered in profiles; lesson times are shown in them.'],
 ['currencies','Currencies','Only shown currencies can hold wallets and prices.'],
 ['languages','Languages','The languages tutors can say they teach in.'],
];
type Filter='all'|'shown'|'hidden';

/** Shows or hides entries in the lists the whole platform picks from, without a deploy.
    Hiding never deletes: anyone already using an entry keeps it. */
export function AdminReferenceLists({kind:routeKind}:{kind?:string}){
 const navigate=useNavigate();
 const kind=(KINDS.find(([value])=>value===routeKind)?.[0])??'skills';
 const[query,setQuery]=useState('');
 const[filter,setFilter]=useState<Filter>('all');
 const[category,setCategory]=useState('');
 const[saving,setSaving]=useState<string|null>(null);
 const[changes,setChanges]=useState<Record<string,boolean>>({});
 const toast=useToast();
 const list=useLoader(()=>{setChanges({});return referenceService.adminList(kind)},[kind]);

 const items=useMemo(()=>(list.data??[]).map(item=>({...item,enabled:changes[item.code]??item.enabled})),[list.data,changes]);
 const categories=useMemo(()=>[...new Set(items.map(item=>item.category).filter((c):c is string=>Boolean(c)))].sort(),[items]);
 const hidden=items.filter(item=>!item.enabled).length;
 const needle=query.trim().toLowerCase();
 const shown=items.filter(item=>
  (filter==='all'||(filter==='shown')===item.enabled)&&
  (!category||item.category===category)&&
  (!needle||item.label.toLowerCase().includes(needle)||item.code.toLowerCase().includes(needle)));

 const toggle=async(item:AdminReferenceItem)=>{
  const next=!item.enabled;
  setSaving(item.code);setChanges(current=>({...current,[item.code]:next}));
  try{await referenceService.setEnabled(kind,item.code,next);toast(`${item.label} is now ${next?'shown':'hidden'}`)}
  catch(problem){setChanges(current=>({...current,[item.code]:item.enabled}));toast(problem instanceof Error?problem.message:'That change was not saved')}
  finally{setSaving(null)}
 };
 const open=(value:ReferenceKind)=>{setQuery('');setFilter('all');setCategory('');navigate(`/admin/reference-lists/${value}`)};

 return <div className="admin-page">
  <header className="admin-page-head"><div><span>Platform</span><h1>Reference lists</h1><p>Choose what the platform offers in its pickers. Hidden entries stay on the profiles that already use them.</p></div></header>
  <div className="error-log-filters">{KINDS.map(([value,name])=><button type="button" className={kind===value?'active':''} onClick={()=>open(value)} key={value}>{name}</button>)}</div>
  <p className="reference-intro">{KINDS.find(([value])=>value===kind)![2]} {list.data&&<strong>{items.length-hidden} shown · {hidden} hidden</strong>}</p>

  <div className="admin-table-tools">
   <div><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={`Search ${kind} by name or code`}/></div>
   <select value={filter} onChange={e=>setFilter(e.target.value as Filter)} aria-label="Visibility"><option value="all">Shown and hidden</option><option value="shown">Shown only</option><option value="hidden">Hidden only</option></select>
   {categories.length>0&&<select value={category} onChange={e=>setCategory(e.target.value)} aria-label="Category"><option value="">Every category</option>{categories.map(c=><option key={c}>{c}</option>)}</select>}
  </div>

  {list.error&&<p className="ledger-error">{list.error}</p>}
  <div className="admin-table-wrap">
   <table className="admin-table reference-table">
    <thead><tr><th>NAME</th><th>CODE</th><th>DETAIL</th><th>SHOWN</th></tr></thead>
    <tbody>
     {list.loading&&!list.data&&<tr><td colSpan={4}>Loading…</td></tr>}
     {list.data&&!shown.length&&<tr><td colSpan={4}>Nothing matches.</td></tr>}
     {shown.map(item=><tr key={item.code} className={item.enabled?'':'is-hidden'}>
      <td><strong>{item.label}</strong></td>
      <td><code>{item.code}</code></td>
      <td>{detail(kind,item)}</td>
      <td><label className="admin-toggle reference-toggle"><span className="sr-only">{item.enabled?`Hide ${item.label}`:`Show ${item.label}`}</span>
       <input type="checkbox" checked={item.enabled} disabled={saving===item.code} onChange={()=>toggle(item)}/></label></td>
     </tr>)}
    </tbody>
   </table>
  </div>
 </div>;
}

function detail(kind:ReferenceKind,item:AdminReferenceItem){
 const meta=item.metadata??{};
 if(kind==='currencies')return `${String(meta.symbol??'')} · ${String(meta.decimals??2)} decimals`;
 if(kind==='skills')return [item.category,meta.source?`from ${String(meta.source).toUpperCase()}`:''].filter(Boolean).join(' · ');
 return item.category??'—';
}
