import type{Tutor}from'../types';import{paths,skills as featuredSkills,tutors as mockTutors}from'../data/mock';import{countries}from'../data/locations';import{ApiError,api,offlineFallback}from'./api';
export type Skill={id:string;name:string;category?:string};
export type TutorStatus='draft'|'submitted'|'approved'|'rejected';
export type TutorProfileInput={headline:string;bio:string;yearsOfExperience:number;teachingExperience:string;languages:string[];hourlyRate:number;trialRate:number;githubUrl:string;portfolioUrl:string;linkedinUrl:string;skills:{code:string;yearsExperience:number;isPrimary:boolean}[]};
export type TutorProfile=Omit<TutorProfileInput,'githubUrl'|'portfolioUrl'|'linkedinUrl'|'skills'>&{id:string;firstName:string;lastName:string;country:string|null;timezone:string;currency:string;githubUrl:string|null;portfolioUrl:string|null;linkedinUrl:string|null;status?:TutorStatus;reviewNote?:string;rating:number;reviewCount:number;skills:{code:string;name:string;yearsExperience:number;isPrimary:boolean}[]};
// Offline, the catalogue is every skill the demo data already teaches, across all domains.
const offlineSkills=():Skill[]=>[...new Set([...featuredSkills.map(s=>s.name),...mockTutors.flatMap(t=>t.skills),...paths.flatMap(p=>p.skills)])].sort((a,b)=>a.localeCompare(b)).map(name=>({id:name.toLowerCase().replace(/[^a-z0-9+#]+/g,'-'),name}));
const PROFILE_KEY='pairlore.tutor-profile';
const countryName=(code:string|null)=>countries.find(c=>c.code===code)?.label??'Remote';
// A tutor's rating is the average of their reviews; lesson and student counts arrive with a later epic.
const adapt=(t:TutorProfile):Tutor=>({id:t.id,name:`${t.firstName} ${t.lastName}`,location:countryName(t.country),headline:t.headline,skills:t.skills.map(s=>s.name),skillCodes:t.skills.map(s=>s.code),rating:t.rating??0,reviews:t.reviewCount??0,students:0,lessons:0,price:t.hourlyRate,trialPrice:t.trialRate,bio:t.bio,available:true,image:`${t.firstName[0]??''}${t.lastName[0]??''}`,experience:t.yearsOfExperience,languages:t.languages,speciality:t.teachingExperience||t.skills[0]?.name||'Personalised lessons',
 links:[['GitHub',t.githubUrl],['Portfolio',t.portfolioUrl],['LinkedIn',t.linkedinUrl]].filter((link):link is [string,string]=>Boolean(link[1])).map(([label,url])=>({label,url}))});
export type TutorPage={items:Tutor[];pagination:{page:number;pages:number;total:number}};
// Offline, the demo tutors are filtered and sorted the way the backend would do it.
const offlineList=async(params:URLSearchParams):Promise<TutorPage>=>{
 const skill=params.get('skill'),q=(params.get('q')??'').toLowerCase(),language=params.get('language');
 const maxPrice=Number(params.get('maxPrice')||0),experience=Number(params.get('experience')||0),sort=params.get('sort');
 const items=mockTutors
  .filter(t=>!skill||t.skills.some(s=>s.toLowerCase().replaceAll(' ','-')===skill))
  .filter(t=>!q||`${t.name} ${t.headline}`.toLowerCase().includes(q))
  .filter(t=>!language||t.languages.includes(language))
  .filter(t=>!maxPrice||t.price<=maxPrice)
  .filter(t=>t.experience>=experience)
  .sort((a,b)=>sort==='price'?a.price-b.price:sort==='experience'?b.experience-a.experience:0);
 return{items,pagination:{page:1,pages:1,total:items.length}};
};
const readSaved=()=>{try{return JSON.parse(localStorage.getItem(PROFILE_KEY)??'null') as TutorProfile|null}catch{return null}};
export const tutorService={
 list:(params:URLSearchParams)=>offlineFallback(
  ()=>api<{items:TutorProfile[];pagination:TutorPage['pagination']}>(`/tutors?${params}`).then(data=>({...data,items:data.items.map(adapt)})),
  ()=>offlineList(params)),
 detail:(id:string)=>offlineFallback(
  ()=>api<{tutor:TutorProfile}>(`/tutors/${id}`).then(r=>adapt(r.tutor)),
  async()=>mockTutors.find(t=>t.id===id)??mockTutors[0]!),
 skills:()=>offlineFallback(()=>api<{code:string;label:string;category?:string}[]>('/reference/skills').then(items=>items.map(item=>({id:item.code,name:item.label,category:item.category}))),async()=>offlineSkills()),
 /** The signed-in tutor's own profile, or null before they have saved one. */
 myProfile:()=>offlineFallback(()=>api<{tutor:TutorProfile}>('/tutor/profile').then(r=>r.tutor).catch(e=>{if(e instanceof ApiError&&e.status===404)return null;throw e}),async()=>readSaved()),
 /** Saving a complete profile submits it for review, unless it is work in progress. */
 saveProfile:(input:TutorProfileInput,submit=true)=>offlineFallback(()=>api<{tutor:TutorProfile}>('/tutor/profile',{method:'PUT',body:JSON.stringify({...input,submit})}).then(r=>r.tutor),async()=>{const saved={...input,id:'offline',firstName:'',lastName:'',country:null,timezone:'UTC',currency:'USD',status:'submitted' as const,rating:0,reviewCount:0,githubUrl:input.githubUrl||null,portfolioUrl:input.portfolioUrl||null,linkedinUrl:input.linkedinUrl||null,skills:input.skills.map(s=>({...s,name:s.code}))};try{localStorage.setItem(PROFILE_KEY,JSON.stringify(saved))}catch{/* storage blocked: the demo flow still completes */}return saved})};
