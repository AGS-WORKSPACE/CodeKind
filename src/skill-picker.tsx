import{useMemo,useState}from'react';
import{Check,Search,X}from'lucide-react';
import{useLoader}from'./hooks/use-payments';
import{tutorService,type Skill}from'./services/tutor.service';

const OTHER='More subjects';

/** Shelves are named by trade and set out alphabetically, with anything uncategorised last. */
function shelves(skills:Skill[],query:string){
 const groups=new Map<string,Skill[]>();
 for(const skill of skills){
  if(query&&!skill.name.toLowerCase().includes(query))continue;
  const shelf=groups.get(skill.category??OTHER);
  if(shelf)shelf.push(skill);else groups.set(skill.category??OTHER,[skill]);
 }
 return[...groups].sort(([a],[b])=>a===OTHER?1:b===OTHER?-1:a.localeCompare(b));
}

/* Subjects run into the hundreds, so they are searched and shelved by trade rather than listed.
   The order they are picked in matters: the first one is shown to learners as the speciality. */
export function SkillPicker({chosen,onToggle}:{chosen:string[];onToggle:(code:string)=>void}){
 const{data,loading,error}=useLoader(()=>tutorService.skills(),[]);
 const[query,setQuery]=useState('');
 const skills=useMemo(()=>data??[],[data]);
 const groups=useMemo(()=>shelves(skills,query.trim().toLowerCase()),[skills,query]);
 const names=useMemo(()=>new Map(skills.map(skill=>[skill.id,skill.name])),[skills]);
 const picked=new Set(chosen);
 if(loading)return <p className="skill-picker-status">Loading subjects…</p>;
 if(error)return <p className="skill-picker-status">{error}</p>;
 return <div className="subject-shelf">
  <div className="shelf-head">
   <span className="shelf-search"><Search size={15}/>
    <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search subjects" aria-label="Search subjects"/>
   </span>
   <small>{chosen.length?`${chosen.length} chosen`:`${skills.length} to choose from`}</small>
  </div>
  {chosen.length>0&&<ul className="shelf-tray">{chosen.map((code,index)=>
   <li key={code} className={index===0?'main':undefined}>
    {index===0&&<em>speciality</em>}{names.get(code)??code}
    <button type="button" aria-label={`Remove ${names.get(code)??code}`} onClick={()=>onToggle(code)}><X size={13}/></button>
   </li>)}</ul>}
  <div className="shelf-stacks">{groups.length?groups.map(([category,items])=>
   <section key={category}>
    <h4>{category}<span>{items.length}</span></h4>
    <ul>{items.map(skill=>{
     const on=picked.has(skill.id);
     return <li key={skill.id}><button type="button" className={on?'on':undefined} aria-pressed={on} onClick={()=>onToggle(skill.id)}>
      {on&&<Check size={13}/>}{skill.name}</button></li>;
    })}</ul>
   </section>):<p className="shelf-empty">Nothing matches “{query}”.</p>}
  </div>
 </div>;
}
