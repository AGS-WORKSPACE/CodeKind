import{useEffect,useMemo,useState}from'react';
import{Link,useNavigate,useParams}from'react-router-dom';
import{ExternalLink,Search,ShieldCheck}from'lucide-react';
import{Filters,SkillBadge,Stars,TutorCard,type TutorFilterState}from'./components';
import{useLoader}from'./hooks/use-payments';
import{tutorService}from'./services/tutor.service';
import{useReference}from'./services/reference.service';
import{languages as offlineLanguages}from'./data/languages';
import{ReviewList}from'./reviews-pages';

const EMPTY_FILTERS:TutorFilterState={skill:'',maxPrice:'',experience:'',language:''};

/** Waits until typing pauses, so search does not ask the backend on every key. */
function useDebounced(value:string,ms=500){
 const[settled,setSettled]=useState(value);
 useEffect(()=>{const timer=setTimeout(()=>setSettled(value),ms);return()=>clearTimeout(timer)},[value,ms]);
 return settled;
}

export function Tutors(){
 const{skill:routeSkill}=useParams();
 const navigate=useNavigate();
 const[query,setQuery]=useState('');
 const[filters,setFilters]=useState<TutorFilterState>({...EMPTY_FILTERS,skill:routeSkill??''});
 const[sort,setSort]=useState('best');
 const[page,setPage]=useState(1);
 const search=useDebounced(query);
 const skills=useLoader(()=>tutorService.skills(),[]);
 // The same list tutors pick from, so every choice on offer here matches somebody.
 const spokenLanguages=useReference('languages',()=>offlineLanguages.map(name=>({code:name.toLowerCase(),label:name})));

 useEffect(()=>{setFilters(current=>({...current,skill:routeSkill??''}))},[routeSkill]);
 useEffect(()=>{setPage(1)},[search,filters,sort]);

 const params=useMemo(()=>{
  const next=new URLSearchParams({sort,page:String(page)});
  if(search.trim())next.set('q',search.trim());
  for(const[key,value]of Object.entries(filters))if(value)next.set(key,value);
  return next.toString();
 },[search,filters,sort,page]);
 const results=useLoader(()=>tutorService.list(new URLSearchParams(params)),[params]);

 const skillOptions=(skills.data??[]).map(s=>[s.id,s.name] as [string,string]);
 const skillName=skillOptions.find(([code])=>code===filters.skill)?.[1];
 const update=(key:keyof TutorFilterState,value:string)=>{
  // The subject lives in the URL, so a filtered page can be shared.
  if(key==='skill')navigate(value?`/tutors/${value}`:'/tutors',{replace:true});
  setFilters(current=>({...current,[key]:value}));
 };
 const reset=()=>{setQuery('');setFilters(EMPTY_FILTERS);navigate('/tutors',{replace:true})};
 const{items=[],pagination}=results.data??{};

 return <main className="market">
  <div className="market-head">
   <span className="eyebrow">FIND YOUR MENTOR</span>
   <h1>{skillName?`${skillName} tutors`:'Expert tutors'} who work in the field</h1>
   <p>Compare experience, rates and skills to find the right tutor.</p>
   <div className="market-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name, skill or what you want to learn"/></div>
  </div>
  <div className="market-layout">
   <Filters values={filters} onChange={update} onReset={reset} skills={skillOptions} languages={spokenLanguages.map(item=>item.label)}/>
   <div>
    <div className="results-head">
     <span><strong>{pagination?.total??0} tutors</strong> found</span>
     <label>Sort by <select value={sort} onChange={e=>setSort(e.target.value)}><option value="best">{search.trim()?'Best match':'Newest'}</option><option value="newest" hidden={!search.trim()}>Newest</option><option value="price">Lowest rate</option><option value="experience">Most experienced</option><option value="rating">Best reviewed</option></select></label>
    </div>
    {results.loading&&search.trim()&&<p className="search-status">Finding the best matches…</p>}
    {results.loading&&!results.data?<LoadingCards/>
     :results.error?<ErrorState message={results.error} onRetry={()=>results.reload()}/>
     :items.length?<div className="tutor-list">{items.map(t=><TutorCard key={t.id} tutor={t}/>)}</div>
     :<div className="api-state"><Search/><h3>No tutors match yet</h3><p>Try another skill, or remove some filters.</p></div>}
    {pagination&&pagination.pages>1&&<nav className="results-pages" aria-label="Pages">
     <button type="button" className="btn ghost small" disabled={page<=1} onClick={()=>setPage(page-1)}>Previous</button>
     <span>Page {pagination.page} of {pagination.pages}</span>
     <button type="button" className="btn ghost small" disabled={page>=pagination.pages} onClick={()=>setPage(page+1)}>Next</button>
    </nav>}
   </div>
  </div>
 </main>;
}

function LoadingCards(){return <div className="tutor-list">{[1,2,3].map(i=><div className="api-skeleton" key={i}><i/><div><b/><span/><span/></div></div>)}</div>}
function ErrorState({message,onRetry}:{message:string;onRetry:()=>void}){return <div className="api-state error"><ShieldCheck/><h3>We couldn’t load tutors</h3><p>{message}</p><button className="btn" onClick={onRetry}>Try again</button></div>}

export function TutorProfile(){
 const{id}=useParams();
 const tutor=useLoader(()=>tutorService.detail(id??''),[id]);
 if(tutor.error)return <main className="profile-page"><div className="api-state error"><ShieldCheck/><h3>This tutor is not available</h3><p>{tutor.error}</p><Link className="btn" to="/tutors">Find another tutor</Link></div></main>;
 if(!tutor.data)return <main className="profile-page"><LoadingCards/></main>;
 const t=tutor.data;
 const trial=t.trialPrice??Math.round(t.price*.55);

 return <main className="profile-page">
  <div className="breadcrumbs"><Link to="/tutors">Tutors</Link> / {t.name}</div>
  <div className="profile-grid">
   <div>
    <section className="profile-hero">
     <div className="avatar xl">{t.image}</div>
     <div>
      <span className="available">● Approved tutor</span>
      <h1>{t.name}</h1>
      <h2>{t.headline}</h2>
      <p>{t.location}{t.languages.length>0&&` · Speaks ${t.languages.join(', ')}`}</p>
      <div className="profile-stats">{t.reviews
       ?<><Stars rating={t.rating}/><span><strong>{t.reviews}</strong> review{t.reviews===1?'':'s'}</span></>
       :<span className="new-tutor">New to Pairlore · {t.experience} years’ experience</span>}</div>
     </div>
    </section>
    {t.bio&&<section className="profile-section"><h2>About me</h2><p>{t.bio}</p></section>}
    {t.skills.length>0&&<section className="profile-section"><h2>Skills</h2><div className="badges big">{t.skills.map(s=><SkillBadge key={s}>{s}</SkillBadge>)}</div></section>}
    <section className="profile-section"><h2>Experience</h2><p>{t.experience} years of professional experience.</p>{t.speciality&&!t.skills.includes(t.speciality)&&<p>{t.speciality}</p>}</section>
    <section className="profile-section"><h2>Reviews</h2><ReviewList tutorId={t.id} empty={`No reviews yet. ${t.name.split(' ')[0]} has not been reviewed by a learner here.`}/></section>
    {t.links&&t.links.length>0&&<section className="profile-section"><h2>Work</h2><div className="profile-links">{t.links.map(link=><a href={link.url} target="_blank" rel="noreferrer" key={link.label}>{link.label} <ExternalLink size={13}/></a>)}</div></section>}
   </div>
   <aside className="booking-card">
    <div className="price"><strong>${t.price}</strong><span>/ hour</span></div>
    <div className="trial"><span>Trial lesson rate</span><strong>${trial} / hour</strong></div>
    <Link className="btn wide" to={`/booking/${t.id}`}>Book a lesson</Link>
   </aside>
  </div>
 </main>;
}
