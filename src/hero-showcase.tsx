import {useEffect,useRef,useState} from 'react';
import {BarChart3,Brain,Building2,Cloud,Code2,Languages,Pause,PenTool,Play,ShieldCheck,Sparkles,Zap} from 'lucide-react';
import {SearchBar,Stars} from './components';
import {useLoader} from './hooks/use-payments';
import {statsService} from './services/reviews.service';
import {domains} from './data/domains';
import type {DomainIcon,PanelBlock} from './data/domains';

const ROTATE_MS=7000;
const icons:Record<DomainIcon,typeof Code2>={code:Code2,brain:Brain,chart:BarChart3,cloud:Cloud,shield:ShieldCheck,pen:PenTool,languages:Languages};

/** Auto-rotation is suppressed for visitors who ask for reduced motion; the rail still switches domains on click. */
function usePrefersReducedMotion(){
 const [reduced,setReduced]=useState(false);
 useEffect(()=>{
  const query=matchMedia('(prefers-reduced-motion: reduce)');
  const sync=()=>setReduced(query.matches);
  sync();
  query.addEventListener('change',sync);
  return()=>query.removeEventListener('change',sync);
 },[]);
 return reduced;
}

const TOKEN=/@(\w+)\{([^}]*)\}/g;
function CodeLine({line}:{line:string}){
 const parts:React.ReactNode[]=[];
 let cursor=0;
 for(const match of line.matchAll(TOKEN)){
  if(match.index>cursor)parts.push(line.slice(cursor,match.index));
  parts.push(<em key={match.index} className={`tok tok-${match[1]}`}>{match[2]}</em>);
  cursor=match.index+match[0].length;
 }
 if(cursor<line.length)parts.push(line.slice(cursor));
 return <span className="code-line">{parts.length?parts:' '}</span>;
}

function pct(value:number){return {'--pct':`${value}%`} as React.CSSProperties}

function Block({block}:{block:PanelBlock}){
 switch(block.type){
  case 'code':
   return <pre className="showcase-code"><code>{block.lines.map((line,i)=><CodeLine key={i} line={line}/>)}</code></pre>;
  case 'meters':
   return <div className="showcase-meters">{block.items.map(([label,value,value2])=>
    <div className="meter" key={label}><span>{label}</span><b>{value}</b><i style={pct(value2)}/></div>)}</div>;
  case 'bars':
   return <figure className="showcase-bars"><div className="bar-row">{block.items.map(([label,height])=>
    <span key={label} style={pct(height)}><i/><small>{label}</small></span>)}</div><figcaption>{block.caption}</figcaption></figure>;
  case 'list':
   return <ul className="showcase-list">{block.items.map(([label,tag,tone])=>
    <li key={label} className={`row-${tone}`}><span>{label}</span><b className={`tone tone-${tone}`}>{tag}</b></li>)}</ul>;
  case 'swatches':
   return <div className="showcase-swatches">{block.items.map(([label,color])=>
    <span key={label}><i style={{background:color}}/>{label}</span>)}</div>;
 }
}

export function HeroShowcase(){
 const [index,setIndex]=useState(0);
 const [playing,setPlaying]=useState(true);
 const [held,setHeld]=useState(false);
 const reduced=usePrefersReducedMotion();
 const domain=domains[index]!;
 const rotating=playing&&!held&&!reduced;

 const railRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const rail=railRef.current;
  if(!rail||rail.scrollWidth<=rail.clientWidth)return;
  const chip=rail.children[index] as HTMLElement|undefined;
  if(chip)rail.scrollTo({left:chip.offsetLeft-(rail.clientWidth-chip.offsetWidth)/2,behavior:reduced?'auto':'smooth'});
 },[index,reduced]);

 useEffect(()=>{
  if(!rotating)return;
  const timer=setTimeout(()=>setIndex(current=>(current+1)%domains.length),ROTATE_MS);
  return()=>clearTimeout(timer);
 },[index,rotating]);

 const {accent,shell,bar,glow}=domain.theme;
 const theme={'--accent':accent,'--shell':shell,'--bar':bar,'--glow':glow} as React.CSSProperties;
 const faces=[0,1,2].map(offset=>domains[(index+offset)%domains.length]!.mentor.initials);

 return <section className="hero domain-hero" style={theme} onFocusCapture={()=>setHeld(true)} onBlurCapture={()=>setHeld(false)}>
  <div className="hero-copy">
   <div className="hero-lede" key={domain.id}>
    <span className="pill"><Sparkles size={15}/> {domain.pill}</span>
    <h1>{domain.headline[0]}<br/><em>{domain.headline[1]}</em></h1>
    <p>{domain.blurb}</p>
   </div>
   <SearchBar placeholder={domain.search}/>
   <div className="domain-rail" onMouseEnter={()=>setHeld(true)} onMouseLeave={()=>setHeld(false)}>
    <div className="domain-chips" role="group" aria-label="Training domains" ref={railRef}>
     {domains.map((entry,position)=>{
      const Icon=icons[entry.icon];
      const active=position===index;
      return <button
       key={entry.id}
       type="button"
       aria-pressed={active}
       aria-label={entry.label}
       className={active?'domain-chip active':'domain-chip'}
       style={{'--accent':entry.theme.accent} as React.CSSProperties}
       onClick={()=>setIndex(position)}>
       <Icon size={15}/>{entry.chip}
       {active&&rotating&&<i className="chip-timer" key={domain.id}/>}
      </button>;
     })}
    </div>
    {!reduced&&<button
     type="button"
     className="domain-toggle"
     aria-label={playing?'Pause domain rotation':'Resume domain rotation'}
     onClick={()=>setPlaying(state=>!state)}>
     {playing?<Pause size={14}/>:<Play size={14}/>}
    </button>}
   </div>
   <TrustRow faces={faces}/>
  </div>
  <div className="hero-panel">
   <div className="showcase-window" key={domain.id}>
    <div className="window-bar"><i className="live-dot"/><small>{domain.panel.file}</small></div>
    <div className="showcase-body">{domain.panel.blocks.map((block,i)=><Block key={i} block={block}/>)}</div>
    <div className="mentor-bubble">
     <div className="avatar sm">{domain.mentor.initials}</div>
     <div><strong>{domain.mentor.name}, {domain.mentor.role}</strong><span>“{domain.mentor.quote}”</span></div>
    </div>
   </div>
   <div className="float-card" key={`${domain.id}-next`}><Zap size={18}/><strong>{domain.next.label}</strong><span>{domain.next.when}</span></div>
  </div>
 </section>;
}

/* Only what the platform can actually count. A new platform shows its promises, not numbers it
   does not have. */
function TrustRow({faces}:{faces:string[]}){
 const stats=useLoader(()=>statsService.read(),[]);
 const{tutors=0,sessions=0,reviews=0,rating=0}=stats.data??{};
 return <div className="trust-row">
  <span><div className="faces">{faces.map(initials=><i key={initials}>{initials}</i>)}</div></span>
  {reviews>0&&<span><Stars rating={rating}/><small>from {reviews} review{reviews===1?'':'s'}</small></span>}
  {sessions>0&&<span><Sparkles size={18}/> {sessions} session{sessions===1?'':'s'} taught</span>}
  {tutors>0&&<span><ShieldCheck size={19}/> {tutors} vetted tutor{tutors===1?'':'s'}</span>}
  {tutors===0&&<span><ShieldCheck size={19}/> Vetted tutors</span>}
  <span><Building2 size={18}/> Individuals &amp; organisations</span>
 </div>;
}
