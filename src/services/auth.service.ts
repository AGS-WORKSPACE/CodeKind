import{ApiError,api}from'./api';
import{authRepository}from'../mocks/auth.repository';
export type Role='STUDENT'|'TUTOR'|'ADMIN'|'ORGANIZATION';
/** role is the workspace you are in. It is null when an account holds several and has not chosen. */
export type SessionUser={id:string;firstName:string;lastName:string;email:string;role:Role|null;emailVerified?:boolean;avatar?:string|null;country?:string|null;timezone:string;orgId?:string|null;orgName?:string|null};
export type Session={user:SessionUser;workspaces:Role[]};
export type AccountType='STUDENT'|'TUTOR'|'ORGANIZATION';
/** organisationName is set when accountType is ORGANIZATION; inviteToken when joining an existing one. */
type RegisterInput={firstName:string;lastName:string;email:string;password:string;accountType:AccountType;organisationName?:string;inviteToken?:string};

/* The backend names workspaces in its own words, so translate at the edge and keep one vocabulary
   inside the app. */
const ROLES:Record<string,Role>={learner:'STUDENT',tutor:'TUTOR',organisation:'ORGANIZATION',admin:'ADMIN'};
type ApiIdentity={user:Omit<SessionUser,'role'>&{role:string|null};workspaces:string[]};
const toRole=(value:string|null|undefined)=>value?ROLES[value]??null:null;
const toSession=(identity:ApiIdentity):Session=>({
 user:{...identity.user,role:toRole(identity.user.role)},
 workspaces:identity.workspaces.map(toRole).filter((role):role is Role=>role!==null),
});
const offline=(user:SessionUser):Session=>({user,workspaces:user.role?[user.role]:[]});

/* An ApiError means a real backend answered (401, 422…), so it must surface. Anything else is a
   failed connection — fall back to the offline demo session instead of showing a dead login form. */
const unreachable=(error:unknown)=>!(error instanceof ApiError);
export const authService={
 me:async():Promise<Session>=>{
  try{return toSession(await api<ApiIdentity>('/auth/me'))}
  catch(error){if(!unreachable(error))throw error;const user=authRepository.session();if(!user)throw error;return offline(user)}},
 login:async(email:string,password:string):Promise<Session>=>{
  try{return toSession(await api<ApiIdentity>('/auth/login',{method:'POST',body:JSON.stringify({email,password})}))}
  catch(error){if(!unreachable(error))throw error;return offline(await authRepository.login(email))}},
 register:async(input:RegisterInput):Promise<Session>=>{
  try{return toSession(await api<ApiIdentity>('/auth/register',{method:'POST',body:JSON.stringify(input)}))}
  catch(error){if(!unreachable(error))throw error;return offline(await authRepository.register(input))}},
 /** Moves the session into another workspace the account holds. */
 chooseWorkspace:async(role:Role):Promise<Session>=>{
  const name=Object.keys(ROLES).find(key=>ROLES[key]===role)??role.toLowerCase();
  return toSession(await api<ApiIdentity>('/auth/workspace',{method:'POST',body:JSON.stringify({role:name})}));},
 logout:async()=>{
  try{return await api<Record<string,never>>('/auth/logout',{method:'POST'})}
  catch(error){if(!unreachable(error))throw error;return{} as Record<string,never>}
  finally{authRepository.clear()}},
};
