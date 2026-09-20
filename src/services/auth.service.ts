import{ApiError,api,offlineFallback}from'./api';
import{authRepository}from'../mocks/auth.repository';
export type Role='STUDENT'|'TUTOR'|'ADMIN'|'ORGANIZATION';
/** role is the workspace you are in. It is null when an account holds several and has not chosen. */
export type SessionUser={id:string;firstName:string;lastName:string;email:string;role:Role|null;emailVerified?:boolean;avatar?:string|null;country?:string|null;timezone:string;phone?:string|null;learningGoals?:string|null;orgId?:string|null;orgName?:string|null};
export type Session={user:SessionUser;workspaces:Role[]};
export type AccountType='STUDENT'|'TUTOR'|'ORGANIZATION';
/** organisationName is set when accountType is ORGANIZATION. */
export type AccountInput={firstName:string;lastName:string;country:string;timezone:string;phone?:string;learningGoals?:string};
export type NotificationPreferences={lessons:boolean;messages:boolean;assignments:boolean;recommendations:boolean};
type RegisterInput={firstName:string;lastName:string;email:string;password:string;accountType:AccountType;organisationName?:string};

/* The backend names workspaces in its own words, so translate at the edge and keep one vocabulary
   inside the app. */
const ROLES:Record<string,Role>={learner:'STUDENT',tutor:'TUTOR',organisation:'ORGANIZATION',admin:'ADMIN'};
type ApiIdentity={user:Omit<SessionUser,'role'>&{role:string|null};workspaces:string[]};
const roleName=(role:Role)=>Object.keys(ROLES).find(key=>ROLES[key]===role)??role.toLowerCase();
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
 chooseWorkspace:async(role:Role):Promise<Session>=>toSession(await api<ApiIdentity>('/auth/workspace',{method:'POST',body:JSON.stringify({role:roleName(role)})})),
 /** Adds learning or teaching to this account and moves the session into it. */
 addWorkspace:async(role:Role):Promise<Session>=>toSession(await api<ApiIdentity>('/account/workspaces',{method:'POST',body:JSON.stringify({role:roleName(role)})})),
 updateAccount:async(input:AccountInput,current:SessionUser):Promise<Session>=>{
  try{return toSession(await api<ApiIdentity>('/account/profile',{method:'PUT',body:JSON.stringify(input)}))}
  catch(error){if(!unreachable(error))throw error;return offline({...current,...input})}},
 changePassword:(currentPassword:string,newPassword:string)=>offlineFallback(
  ()=>api<unknown>('/account/password',{method:'POST',body:JSON.stringify({currentPassword,newPassword})}).then(()=>undefined),
  async()=>undefined),
 notificationPreferences:()=>offlineFallback(
  ()=>api<NotificationPreferences>('/account/notification-preferences'),
  async()=>({lessons:true,messages:true,assignments:true,recommendations:false})),
 saveNotificationPreferences:(prefs:NotificationPreferences)=>offlineFallback(
  ()=>api<NotificationPreferences>('/account/notification-preferences',{method:'PUT',body:JSON.stringify(prefs)}),
  async()=>prefs),
 verifyEmail:(token:string)=>api<unknown>('/auth/verify-email',{method:'POST',body:JSON.stringify({token})}).then(()=>undefined),
 requestPasswordReset:(email:string)=>api<unknown>('/auth/forgot-password',{method:'POST',body:JSON.stringify({email})}).then(()=>undefined),
 resetPassword:(token:string,password:string)=>api<unknown>('/auth/reset-password',{method:'POST',body:JSON.stringify({token,password})}).then(()=>undefined),
 resendVerification:()=>api<unknown>('/auth/verification-email',{method:'POST'}).then(()=>undefined),
 logout:async()=>{
  try{return await api<Record<string,never>>('/auth/logout',{method:'POST'})}
  catch(error){if(!unreachable(error))throw error;return{} as Record<string,never>}
  finally{authRepository.clear()}},
};
