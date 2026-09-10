import{ApiError,api}from'./api';
import{authRepository}from'../mocks/auth.repository';
export type Role='STUDENT'|'TUTOR'|'ADMIN'|'ORGANIZATION';
export type SessionUser={id:string;firstName:string;lastName:string;email:string;role:Role;avatar?:string|null;country?:string|null;timezone:string;orgId?:string|null;orgName?:string|null};
export type AccountType='STUDENT'|'TUTOR'|'ORGANIZATION';
/** organisationName is set when accountType is ORGANIZATION; inviteToken when joining an existing one. */
type RegisterInput={firstName:string;lastName:string;email:string;password:string;accountType:AccountType;organisationName?:string;inviteToken?:string};
/* An ApiError means a real backend answered (401, 422…), so it must surface. Anything else is a
   failed connection — fall back to the offline demo session instead of showing a dead login form. */
const unreachable=(error:unknown)=>!(error instanceof ApiError);
export const authService={
 me:async()=>{
  try{return await api<{user:SessionUser}>('/auth/me')}
  catch(error){if(!unreachable(error))throw error;const user=authRepository.session();if(!user)throw error;return{user}}},
 login:async(email:string,password:string)=>{
  try{return await api<{user:SessionUser}>('/auth/login',{method:'POST',body:JSON.stringify({email,password})})}
  catch(error){if(!unreachable(error))throw error;return{user:await authRepository.login(email)}}},
 register:async(input:RegisterInput)=>{
  try{return await api<{user:SessionUser}>('/auth/register',{method:'POST',body:JSON.stringify(input)})}
  catch(error){if(!unreachable(error))throw error;return{user:await authRepository.register(input)}}},
 logout:async()=>{
  try{return await api<Record<string,never>>('/auth/logout',{method:'POST'})}
  catch(error){if(!unreachable(error))throw error;return{} as Record<string,never>}
  finally{authRepository.clear()}},
};
