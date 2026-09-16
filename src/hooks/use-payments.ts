import{useCallback,useEffect,useRef,useState}from'react';
import{useAuth}from'../auth';
import type{WalletOwnerType}from'../types/payments';

export type WorkspaceRole='student'|'tutor'|'org';
export type Owner={ownerId:string;ownerType:WalletOwnerType;name:string;role:WorkspaceRole};

/*
 * Who the wallet and the ledger belong to. An organisation's money belongs to the organisation, not
 * to the person signed in; everyone else owns their own. The demo identities match the seeded store
 * so the preview still shows a populated workspace when nobody has signed in.
 */
const demo:Record<WorkspaceRole,{id:string;name:string}>={
 student:{id:'demo-student',name:'Alex Lee'},
 tutor:{id:'demo-tutor',name:'David Okafor'},
 org:{id:'org-northwind',name:'Northwind Training'},
};

export function useOwner(role:WorkspaceRole):Owner{
 const{user}=useAuth();
 if(role==='org')return{ownerId:user?.orgId??demo.org.id,ownerType:'ORG',name:user?.orgName??demo.org.name,role};
 return{ownerId:user?.id??demo[role].id,ownerType:'USER',name:user?`${user.firstName} ${user.lastName}`:demo[role].name,role};
}

/** Load-and-reload for a screen backed by the payments services, with the last error kept for display. */
export function useLoader<T>(load:()=>Promise<T>,deps:React.DependencyList){
 const[data,setData]=useState<T|null>(null);
 const[loading,setLoading]=useState(true);
 const[error,setError]=useState<string|null>(null);
 const live=useRef(true);
 const latest=useRef(0);
 useEffect(()=>{live.current=true;return()=>{live.current=false}},[]);
 // The caller passes a fresh closure each render; deps decide when it actually re-runs.
 // Only the newest request may update the screen, so a slow older one cannot overwrite it.
 const run=useCallback(()=>{
  const request=++latest.current;
  const current=()=>live.current&&request===latest.current;
  setLoading(true);
  return load().then(value=>{if(current()){setData(value);setError(null)}})
   .catch(problem=>{if(current())setError(problem instanceof Error?problem.message:'Something went wrong.')})
   .finally(()=>{if(current())setLoading(false)});
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },deps);
 useEffect(()=>{void run()},[run]);
 return{data,loading,error,reload:run};
}
