import{useEffect,useId,useMemo,useRef,useState}from'react';
import{Check,ChevronDown}from'lucide-react';
import{countries,timezoneLabel,timezones}from'./data/locations';

export type SearchOption={value:string;label:string};

// Case- and accent-insensitive, so "cote" finds "Côte d’Ivoire" and "new york" finds "America/New_York".
const normalise=(text:string)=>text.normalize('NFD').replace(/\p{Diacritic}/gu,'').replaceAll('_',' ').toLowerCase();
const words=(text:string)=>text.split(/[\s/()-]+/).filter(Boolean);

/** Every query word must appear; labels that start with the query rank first, then word starts. */
function search(options:SearchOption[],query:string){
 const q=normalise(query.trim());if(!q)return options;
 const terms=words(q);
 return options.map(option=>{const label=normalise(option.label);if(!terms.every(t=>label.includes(t)))return null;return{option,rank:label.startsWith(q)?0:words(label).some(w=>w.startsWith(terms[0]!))?1:2}})
  .filter(x=>x!==null).sort((a,b)=>a.rank-b.rank).map(x=>x.option);
}

export type SearchSelectProps={label:string;options:SearchOption[];placeholder?:string;
 /** Controlled like a native select: pass value + onChange, or just defaultValue. */
 value?:string;defaultValue?:string;onChange?:(value:string)=>void;
 /** Submits the chosen value with a surrounding <form>, as a native select would. */
 name?:string};

/* A select you can type into (ARIA combobox pattern). Arrow keys move, Enter picks, Escape closes. */
export function SearchSelect({label,options,placeholder='Select…',value:controlled,defaultValue='',onChange,name}:SearchSelectProps){
 const id=useId();const listId=`${id}-list`;
 const[uncontrolled,setUncontrolled]=useState(defaultValue);const value=controlled??uncontrolled;
 const[open,setOpen]=useState(false);const[query,setQuery]=useState('');const[active,setActive]=useState(0);
 const listRef=useRef<HTMLUListElement>(null);
 const selected=options.find(o=>o.value===value);
 const matches=useMemo(()=>search(options,query),[options,query]);
 const show=()=>{setOpen(true);setQuery('');setActive(Math.max(0,options.findIndex(o=>o.value===value)))};
 const close=()=>{setOpen(false);setQuery('')};
 const pick=(option:SearchOption|undefined)=>{if(option){setUncontrolled(option.value);onChange?.(option.value)}close()};
 // Scroll the list only (scrollIntoView would move the page too): centre the choice on open, then keep the active row visible.
 const justOpened=useRef(true);
 useEffect(()=>{const list=listRef.current;if(!open||!list){justOpened.current=true;return}const row=list.children[active] as HTMLElement|undefined;if(!row)return;
  if(justOpened.current){justOpened.current=false;list.scrollTop=row.offsetTop-(list.clientHeight-row.offsetHeight)/2}
  else if(row.offsetTop<list.scrollTop)list.scrollTop=row.offsetTop;
  else if(row.offsetTop+row.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=row.offsetTop+row.offsetHeight-list.clientHeight},[open,active]);
 const onKeyDown=(e:React.KeyboardEvent)=>{
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!open){show();return}const step=e.key==='ArrowDown'?1:-1;setActive(i=>Math.min(Math.max(i+step,0),matches.length-1))}
  else if(e.key==='Enter'&&open){e.preventDefault();pick(matches[active])}
  else if(e.key==='Escape'&&open){e.preventDefault();close()}
 };
 /* The outer <label> picks up each form's own label styling, like the native selects this replaces;
    aria-labelledby keeps the option list out of the input's accessible name. */
 return <label className="search-field"><span id={`${id}-label`}>{label}</span><div className="search-select">
  <input id={id} aria-labelledby={`${id}-label`} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={open&&matches[active]?`${id}-${active}`:undefined} autoComplete="off"
   value={open?query:selected?.label??''} placeholder={open?selected?.label??placeholder:placeholder}
   onFocus={show} onClick={()=>{if(!open)show()}} onBlur={close} onKeyDown={onKeyDown} onChange={e=>{setQuery(e.target.value);setActive(0);setOpen(true)}}/>
  <ChevronDown aria-hidden className="search-select-chevron"/>{name&&<input type="hidden" name={name} value={value}/>}
  {/* mousedown is cancelled so the input keeps focus; click is cancelled so the label doesn't re-open the list. */}
  {open&&<ul id={listId} role="listbox" aria-label={label} ref={listRef} onMouseDown={e=>e.preventDefault()}>{matches.length?matches.map((option,i)=>
   <li id={`${id}-${i}`} key={option.value} role="option" aria-selected={option.value===value} className={i===active?'active':undefined}
    onMouseEnter={()=>setActive(i)} onClick={e=>{e.preventDefault();pick(option)}}>{option.label}{option.value===value&&<Check aria-hidden/>}</li>):
   <li className="search-select-empty" role="presentation">No matches for “{query}”</li>}</ul>}
 </div></label>;
}

type PresetProps=Omit<SearchSelectProps,'label'|'options'>&{label?:string};
// A saved value stays selectable even when this browser's list lacks it (an old zone alias, a legacy country name).
const withCurrent=(options:SearchOption[],value:string|undefined,label=value)=>!value||options.some(o=>o.value===value)?options:[{value,label:label??value},...options];
const countryOptions=countries.map(c=>({value:c,label:c}));

export function CountrySelect({label='Country',placeholder='Search countries',...props}:PresetProps){const current=props.value??props.defaultValue;return <SearchSelect label={label} placeholder={placeholder} options={withCurrent(countryOptions,current)} {...props}/>}
export function TimezoneSelect({label='Timezone',placeholder='Search timezones',...props}:PresetProps){const current=props.value??props.defaultValue;return <SearchSelect label={label} placeholder={placeholder} options={withCurrent(timezones(),current,current&&timezoneLabel(current))} {...props}/>}
