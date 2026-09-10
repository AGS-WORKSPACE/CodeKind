export type OrgMemberRole='OWNER'|'TRAINER';
export type InviteStatus='PENDING'|'ACCEPTED'|'REVOKED';

export type Organization={id:string;name:string;slug:string;contactEmail:string;country?:string|null;createdAt:string};
export type OrgMember={id:string;orgId:string;name:string;email:string;role:OrgMemberRole;subject:string;status:'ACTIVE'|'INVITED';joinedAt:string};
/** An invitation is also the trainer's signup link: /signup?invite=<token>. */
export type OrgInvite={id:string;token:string;orgId:string;email:string;name:string;subject:string;status:InviteStatus;createdAt:string;acceptedAt?:string};
export type InvitePreview={token:string;email:string;name:string;subject:string;organisation:string};
