import type{InvitePreview,OrgInvite,OrgMember,Organization}from'../types/org';
/* Offline stand-in for /organisations/*. Persisted so an invite link still resolves after the
   invited trainer opens it in a new tab, which is the whole point of the flow. */
const KEY='codekind.orgs';
const wait=<T>(value:T,ms=240)=>new Promise<T>(resolve=>setTimeout(()=>resolve(value),ms));
const uid=(prefix:string)=>`${prefix}-${Math.random().toString(36).slice(2,10)}`;

/* The token carries the invitation inside it. Without a backend there is no shared store, so a
   link pasted to a colleague would otherwise resolve to nothing in their browser. Encoding the
   details means the link works anywhere; the local store still wins when it knows the token, so
   revoking an invitation keeps working in the browser that issued it. */
type TokenPayload={o:string;g:string;n:string;e:string;s:string};
const encodeToken=(payload:TokenPayload)=>btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decodeToken=(token:string):TokenPayload|null=>{
 try{
  const binary=atob(token.replace(/-/g,'+').replace(/_/g,'/'));
  const payload=JSON.parse(new TextDecoder().decode(Uint8Array.from(binary,c=>c.charCodeAt(0)))) as TokenPayload;
  return payload&&payload.o&&payload.e?payload:null;
 }catch{return null}
};
export const slugify=(value:string)=>value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'organisation';

type Store={organisations:Organization[];members:OrgMember[];invites:OrgInvite[]};

/** Seeded so signing in as org@demo.com shows a populated roster rather than an empty state. */
const seed=():Store=>{
 const org:Organization={id:'org-northwind',name:'Northwind Training',slug:'northwind-training',contactEmail:'org@demo.com',country:'United Kingdom',createdAt:'2026-06-02'};
 return{
  organisations:[org],
  members:[
   {id:'mem-1',orgId:org.id,name:'Priya Raman',email:'priya@northwind.io',role:'OWNER',subject:'Programme lead',status:'ACTIVE',joinedAt:'2026-06-02'},
   {id:'mem-2',orgId:org.id,name:'Ravi Menon',email:'ravi@northwind.io',role:'TRAINER',subject:'Machine Learning',status:'ACTIVE',joinedAt:'2026-06-14'},
   {id:'mem-3',orgId:org.id,name:'Amara Diallo',email:'amara@northwind.io',role:'TRAINER',subject:'Data Analysis',status:'ACTIVE',joinedAt:'2026-07-01'}],
  invites:[
   {id:'inv-1',token:'demo-invite-token',orgId:org.id,email:'tomas@northwind.io',name:'Tomás Rivera',subject:'Cloud & DevOps',status:'PENDING',createdAt:'2026-09-08'}],
 };
};

const read=():Store=>{try{const raw=localStorage.getItem(KEY);if(raw)return JSON.parse(raw) as Store}catch{/* storage blocked */}return seed()};
const write=(store:Store)=>{try{localStorage.setItem(KEY,JSON.stringify(store))}catch{/* storage blocked — changes just won't survive a refresh */}return store};

export const orgRepository={
 organisation:async(orgId:string)=>wait(read().organisations.find(o=>o.id===orgId)??null),
 members:async(orgId:string)=>wait(read().members.filter(m=>m.orgId===orgId)),
 invites:async(orgId:string)=>wait(read().invites.filter(i=>i.orgId===orgId&&i.status!=='REVOKED')),

 create:async(input:{name:string;contactEmail:string;ownerName:string})=>{
  const store=read();
  const org:Organization={id:uid('org'),name:input.name,slug:slugify(input.name),contactEmail:input.contactEmail,country:null,createdAt:new Date().toISOString().slice(0,10)};
  store.organisations.push(org);
  store.members.push({id:uid('mem'),orgId:org.id,name:input.ownerName,email:input.contactEmail,role:'OWNER',subject:'Programme lead',status:'ACTIVE',joinedAt:org.createdAt});
  write(store);
  return wait(org);
 },

 invite:async(orgId:string,input:{email:string;name:string;subject:string})=>{
  const store=read();
  const org=store.organisations.find(o=>o.id===orgId);
  const subject=input.subject.trim()||'General';
  const token=encodeToken({o:orgId,g:org?.name??'the organisation',n:input.name.trim(),e:input.email.trim(),s:subject});
  const invite:OrgInvite={id:uid('inv'),token,orgId,email:input.email.trim(),name:input.name.trim(),subject,status:'PENDING',createdAt:new Date().toISOString().slice(0,10)};
  store.invites.push(invite);
  write(store);
  return wait(invite);
 },

 revoke:async(inviteId:string)=>{
  const store=read();
  const invite=store.invites.find(i=>i.id===inviteId);
  if(invite)invite.status='REVOKED';
  write(store);
  return wait(invite??null);
 },

 /** Used by the signup screen to turn ?invite=<token> into something it can show. */
 preview:async(token:string):Promise<InvitePreview|null>=>{
  const store=read();
  const known=store.invites.find(i=>i.token===token);
  // A revoked or already-accepted invitation must not resolve, even though the token still decodes.
  if(known)return wait(known.status!=='PENDING'?null:{token:known.token,email:known.email,name:known.name,subject:known.subject,organisation:store.organisations.find(o=>o.id===known.orgId)?.name??'the organisation'});
  const payload=decodeToken(token);
  return wait(payload?{token,email:payload.e,name:payload.n,subject:payload.s,organisation:payload.g}:null);
 },

 accept:async(token:string,person:{name:string;email:string}):Promise<{orgId:string;orgName:string}|null>=>{
  const store=read();
  const known=store.invites.find(i=>i.token===token);
  if(known&&known.status!=='PENDING')return wait(null);
  const payload=known?null:decodeToken(token);
  if(!known&&!payload)return wait(null);
  const orgId=known?known.orgId:payload!.o;
  const subject=known?known.subject:payload!.s;
  const joinedAt=new Date().toISOString().slice(0,10);
  if(known){known.status='ACCEPTED';known.acceptedAt=joinedAt}
  store.members.push({id:uid('mem'),orgId,name:person.name||(known?known.name:payload!.n),email:person.email||(known?known.email:payload!.e),role:'TRAINER',subject,status:'ACTIVE',joinedAt});
  write(store);
  return wait({orgId,orgName:known?(store.organisations.find(o=>o.id===orgId)?.name??'the organisation'):payload!.g});
 },
};
