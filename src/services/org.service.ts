import{api}from'./api';
import type{CurrencyCode}from'../types/payments';

export type OrgRole='owner'|'trainer';
export type Organisation={id:string;name:string;role:OrgRole;members:number;trainers:number;openInvites:number};
export type OrgMember={
 id:string;name:string;email:string;role:OrgRole;headline:string;rating:number;reviewCount:number;
 approved:boolean;taught:number;upcoming:number;earned:number;currency:CurrencyCode|'';joinedAt:string;
};
export type OrgInvite={id:string;email:string;name:string;token?:string;status:'open'|'accepted'|'revoked';organisation?:string;expiresAt:string;acceptedAt:string|null;createdAt:string};

/* An organisation and the trainers who teach under it. Sessions a trainer teaches are paid into the
   organisation's wallet, so the roster and the money are two views of the same thing. */
export const orgService={
 mine:()=>api<{organisation:Organisation|null}>('/organisations/me').then(r=>r.organisation),
 members:()=>api<{items:OrgMember[]}>('/organisations/members').then(r=>r.items),
 invites:()=>api<{items:OrgInvite[]}>('/organisations/invites').then(r=>r.items),
 invite:(email:string,name:string)=>api<{invite:OrgInvite}>('/organisations/invites',{method:'POST',body:JSON.stringify({email,name})}).then(r=>r.invite),
 revoke:(id:string)=>api<{invite:OrgInvite}>(`/organisations/invites/${id}`,{method:'DELETE'}).then(r=>r.invite),
 remove:(trainerId:string)=>api<{removed:boolean}>(`/organisations/members/${trainerId}`,{method:'DELETE'}),
 leave:()=>api<{left:boolean}>('/organisations/membership',{method:'DELETE'}),
 preview:(token:string)=>api<{invite:OrgInvite}>(`/invites/${token}`).then(r=>r.invite),
 accept:(token:string)=>api<{organisation:Organisation}>(`/invites/${token}/accept`,{method:'POST'}).then(r=>r.organisation),
};

/** The link a trainer opens to accept. It is also the signup link for someone without an account. */
export const inviteLink=(token:string)=>`${location.origin}/invite/${token}`;
