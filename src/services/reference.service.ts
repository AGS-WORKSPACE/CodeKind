import{useEffect,useState}from'react';
import{api,offlineFallback}from'./api';

export type ReferenceKind='skills'|'countries'|'timezones'|'currencies';
export type ReferenceItem={code:string;label:string;category?:string;metadata?:Record<string,unknown>};

/* Reference lists change rarely and the backend decides what is visible, so each list is fetched
   once per page load and shared by every component that asks for it. */
const loaded=new Map<ReferenceKind,Promise<ReferenceItem[]>>();

export const referenceService={
 list:(kind:ReferenceKind,offline:()=>ReferenceItem[])=>{
  const pending=loaded.get(kind)??offlineFallback(()=>api<ReferenceItem[]>(`/reference/${kind}`),async()=>offline());
  loaded.set(kind,pending);
  return pending;
 },
};

/** Reads one list, showing the offline set until the backend answers. */
export function useReference(kind:ReferenceKind,offline:()=>ReferenceItem[]){
 const[items,setItems]=useState<ReferenceItem[]>(offline);
 useEffect(()=>{let live=true;referenceService.list(kind,offline).then(list=>{if(live)setItems(list)}).catch(()=>{/* the offline set stays */});return()=>{live=false}},[kind]);// eslint-disable-line react-hooks/exhaustive-deps
 return items;
}
