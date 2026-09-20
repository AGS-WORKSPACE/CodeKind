import{useCallback,useEffect,useId,useLayoutEffect,useMemo,useRef,useState}from'react';
import{createPortal}from'react-dom';
import{Check,ChevronDown}from'lucide-react';
import{countries,timezoneLabel,timezones}from'./data/locations';
import{useReference}from'./services/reference.service';

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
 name?:string;
 /** Lets a panel style the field as its own, in place of the default form styling. */
 className?:string};

/* A select you can type into (ARIA combobox pattern). Arrow keys move, Enter picks, Escape closes. */
export function SearchSelect({label,options,placeholder='Select…',value:controlled,defaultValue='',onChange,name,className='search-field'}:SearchSelectProps){
 const id=useId();const listId=`${id}-list`;
 const[uncontrolled,setUncontrolled]=useState(defaultValue);const value=controlled??uncontrolled;
 const[open,setOpen]=useState(false);const[query,setQuery]=useState('');const[active,setActive]=useState(0);
 const listRef=useRef<HTMLUListElement>(null);
 const fieldRef=useRef<HTMLDivElement>(null);
 const[box,setBox]=useState({left:0,top:0,width:0,maxHeight:264});
 const selected=options.find(o=>o.value===value);
 const matches=useMemo(()=>search(options,query),[options,query]);
 const show=()=>{setOpen(true);setQuery('');setActive(Math.max(0,options.findIndex(o=>o.value===value)))};
 const close=()=>{setOpen(false);setQuery('')};
 const pick=(option:SearchOption|undefined)=>{if(option){setUncontrolled(option.value);onChange?.(option.value)}close()};
 /* The list is drawn over the page rather than inside the field, because a filter panel or a
    dialog that scrolls would otherwise clip it. Its place is measured from the field. */
 const place=useCallback(()=>{
  const field=fieldRef.current;
  if(!field)return;
  const rect=field.getBoundingClientRect();
  const below=window.innerHeight-rect.bottom-12;
  const above=rect.top-12;
  const height=Math.min(264,Math.max(below,above));
  const top=below>=height?rect.bottom+4:rect.top-height-4;
  setBox({left:rect.left,top,width:rect.width,maxHeight:height});
 },[]);
 useLayoutEffect(()=>{
  if(!open)return;
  place();
  window.addEventListener('scroll',place,true);
  window.addEventListener('resize',place);
  return()=>{window.removeEventListener('scroll',place,true);window.removeEventListener('resize',place)};
 },[open,place]);
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
 return <label className={className}><span id={`${id}-label`}>{label}</span><div className="search-select" ref={fieldRef}>
  <input id={id} aria-labelledby={`${id}-label`} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={open&&matches[active]?`${id}-${active}`:undefined} autoComplete="off"
   value={open?query:selected?.label??''} placeholder={open?selected?.label??placeholder:placeholder}
   onFocus={show} onClick={()=>{if(!open)show()}} onBlur={close} onKeyDown={onKeyDown} onChange={e=>{setQuery(e.target.value);setActive(0);setOpen(true)}}/>
  <ChevronDown aria-hidden className="search-select-chevron"/>{name&&<input type="hidden" name={name} value={value}/>}
  {/* mousedown is cancelled so the input keeps focus; click is cancelled so the label doesn't re-open the list. */}
  {open&&createPortal(<ul id={listId} className="search-select-list" role="listbox" aria-label={label} ref={listRef} onMouseDown={e=>e.preventDefault()}
   style={{left:box.left,top:box.top,width:box.width,maxHeight:box.maxHeight}}>{matches.length?matches.map((option,i)=>
   <li id={`${id}-${i}`} key={option.value} role="option" aria-selected={option.value===value} className={i===active?'active':undefined}
    onMouseEnter={()=>setActive(i)} onClick={e=>{e.preventDefault();pick(option)}}>{option.label}{option.value===value&&<Check aria-hidden/>}</li>):
   <li className="search-select-empty" role="presentation">No matches for “{query}”</li>}</ul>,document.body)}
 </div></label>;
}

type PresetProps=Omit<SearchSelectProps,'label'|'options'>&{label?:string};
// A saved value stays selectable even when this browser's list lacks it (an old zone alias, a legacy country name).
const withCurrent=(options:SearchOption[],value:string|undefined,label=value)=>!value||options.some(o=>o.value===value)?options:[{value,label:label??value},...options];
/* Both lists come from the backend, which decides what is on offer. Until it answers — or when it
   cannot be reached — the browser's own Intl data stands in. */
const offlineCountries=()=>countries.map(country=>({code:country.code,label:country.label}));
const offlineTimezones=()=>timezones().map(zone=>({code:zone.value,label:zone.label}));

export function CountrySelect({label='Country',placeholder='Search countries',...props}:PresetProps){
 const items=useReference('countries',offlineCountries);
 const current=props.value??props.defaultValue;
 const options=items.map(item=>({value:item.code,label:item.label}));
 return <SearchSelect label={label} placeholder={placeholder} options={withCurrent(options,current)} {...props}/>;
}

export function TimezoneSelect({label='Timezone',placeholder='Search timezones',...props}:PresetProps){
 const items=useReference('timezones',offlineTimezones);
 const current=props.value??props.defaultValue;
 // Offsets move with the seasons, so they are added here rather than stored.
 const options=items.map(item=>({value:item.code,label:timezoneLabel(item.code)}));
 return <SearchSelect label={label} placeholder={placeholder} options={withCurrent(options,current,current&&timezoneLabel(current))} {...props}/>;
}
