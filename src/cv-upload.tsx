import{useRef,useState}from'react';
import{FileText,Loader2}from'lucide-react';
import{tutorService,type CvDraft}from'./services/tutor.service';
import{ApiError}from'./services/api';

const ACCEPT='.pdf,.docx,.txt,.md';

/**
 * The shortcut into the application: a CV goes up, a draft comes back, and every field stays
 * editable. Nothing is saved from here — the applicant still reads it and submits it themselves.
 */
export function CvUpload({onDraft}:{onDraft:(draft:CvDraft)=>void}){
 const input=useRef<HTMLInputElement>(null);
 const[busy,setBusy]=useState(false);
 const[note,setNote]=useState('');
 const[error,setError]=useState('');

 const read=async(file:File|undefined)=>{
  if(!file)return;
  setBusy(true);setError('');setNote('');
  try{
   const draft=await tutorService.readCv(file);
   onDraft(draft);
   setNote(summarise(draft));
  }catch(problem){
   setError(problem instanceof ApiError?problem.message:'Could not read that file');
  }finally{
   setBusy(false);
   if(input.current)input.current.value='';   // so the same file can be tried again
  }
 };

 return <div className="cv-upload">
  <FileText/>
  <div>
   <strong>Start from your CV</strong>
   <span>{busy?'Reading your CV. This takes a few seconds.':'Upload it and we will fill this in. You can change every word afterwards.'}</span>
   {note&&<small className="cv-upload-note">{note}</small>}
   {error&&<small className="cv-upload-error">{error}</small>}
  </div>
  <input ref={input} type="file" accept={ACCEPT} hidden onChange={event=>read(event.target.files?.[0])}/>
  <button type="button" className="btn ghost" disabled={busy} onClick={()=>input.current?.click()}>
   {busy?<><Loader2 className="spin"/> Reading…</>:'Choose file'}
  </button>
 </div>;
}

/** Says what was filled in, and names anything the platform has no subject for. */
function summarise(draft:CvDraft){
 const filled=[
  draft.skills.length&&`${draft.skills.length} subject${draft.skills.length===1?'':'s'}`,
  draft.languages.length&&`${draft.languages.length} language${draft.languages.length===1?'':'s'}`,
  draft.yearsOfExperience&&`${draft.yearsOfExperience} years of experience`,
 ].filter(Boolean).join(', ');
 const missing=draft.unmatched.length?` We have no subject for ${draft.unmatched.slice(0,4).join(', ')}, so add the closest match yourself.`:'';
 return `${filled?`Filled in ${filled}. `:''}Check everything before you continue.${missing}`;
}
