import{ApiError,api}from'./api';
import{orgRepository}from'../mocks/org.repository';
import type{InvitePreview,OrgInvite,OrgMember,Organization}from'../types/org';
/* Same rule as authService: a real ApiError surfaces, an unreachable API falls back to mocks. */
const unreachable=(error:unknown)=>!(error instanceof ApiError);
const fallback=async<T>(call:()=>Promise<T>,offline:()=>Promise<T>)=>{
 try{return await call()}catch(error){if(!unreachable(error))throw error;return offline()}
};

export const orgService={
 organisation:(orgId:string)=>fallback(()=>api<{organisation:Organization|null}>(`/organisations/${orgId}`).then(r=>r.organisation),()=>orgRepository.organisation(orgId)),
 members:(orgId:string)=>fallback(()=>api<{members:OrgMember[]}>(`/organisations/${orgId}/members`).then(r=>r.members),()=>orgRepository.members(orgId)),
 invites:(orgId:string)=>fallback(()=>api<{invites:OrgInvite[]}>(`/organisations/${orgId}/invites`).then(r=>r.invites),()=>orgRepository.invites(orgId)),
 invite:(orgId:string,input:{email:string;name:string;subject:string})=>fallback(()=>api<{invite:OrgInvite}>(`/organisations/${orgId}/invites`,{method:'POST',body:JSON.stringify(input)}).then(r=>r.invite),()=>orgRepository.invite(orgId,input)),
 revoke:(orgId:string,inviteId:string)=>fallback(()=>api<{invite:OrgInvite|null}>(`/organisations/${orgId}/invites/${inviteId}`,{method:'DELETE'}).then(r=>r.invite),()=>orgRepository.revoke(inviteId)),
 preview:(token:string)=>fallback(()=>api<{invite:InvitePreview|null}>(`/invites/${token}`).then(r=>r.invite),()=>orgRepository.preview(token)),
};
