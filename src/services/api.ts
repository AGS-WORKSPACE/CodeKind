export type ApiEnvelope<T>={success:boolean;data:T;message?:string;errors?:unknown};const API_URL=import.meta.env.VITE_API_URL??'/api/v1';/* A dev proxy answers with its own error page when the API is down, so these are a failed
   connection rather than the backend speaking, and the offline repositories should take over. */
const GATEWAY=new Set([502,503,504]);
export class ApiError extends Error{constructor(message:string,public status:number,public details?:unknown){super(message)}}export async function api<T>(path:string,options:RequestInit={}){const response=await fetch(`${API_URL}${path}`,{...options,credentials:'include',headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});let body:ApiEnvelope<T>;try{body=await response.json() as ApiEnvelope<T>}catch{throw new Error(`The API did not answer with JSON (${response.status})`)}if(!response.ok){if(GATEWAY.has(response.status))throw new Error('The API is unreachable');throw new ApiError(body.message??'Request failed',response.status,body.errors)}return body.data}

/* Same rule the auth and org services follow: a real ApiError (401, 422…) means a backend answered
   and must surface, while a failed connection falls back to the offline repositories. Shared here
   because the payments services all need it. */
export const unreachable=(error:unknown)=>!(error instanceof ApiError);
export const offlineFallback=async<T>(call:()=>Promise<T>,offline:()=>Promise<T>)=>{
 try{return await call()}catch(error){if(!unreachable(error))throw error;return offline()}
};
