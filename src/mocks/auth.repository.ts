import type{AccountType,Role,SessionUser}from'../services/auth.service';
/* Offline stand-in for /auth/*. Used only when the API is unreachable, so it disappears
   on its own once a backend is running. The session survives a refresh via localStorage. */
const KEY='pairlore.session';
const wait=<T>(value:T,ms=260)=>new Promise<T>(resolve=>setTimeout(()=>resolve(value),ms));

/** Signing in with one of these picks that workspace. Any password is accepted. */
export const demoAccounts:SessionUser[]=[
{id:'demo-student',firstName:'Alex',lastName:'Lee',email:'student@demo.com',role:'STUDENT',country:'United Kingdom',timezone:'Europe/London'},
{id:'demo-tutor',firstName:'David',lastName:'Okafor',email:'tutor@demo.com',role:'TUTOR',country:'Nigeria',timezone:'Africa/Lagos'},
{id:'demo-admin',firstName:'Sam',lastName:'Adeyemi',email:'admin@demo.com',role:'ADMIN',country:'Nigeria',timezone:'Africa/Lagos'},
{id:'demo-org',firstName:'Priya',lastName:'Raman',email:'org@demo.com',role:'ORGANIZATION',country:'United Kingdom',timezone:'Europe/London',orgId:'org-northwind',orgName:'Northwind Training'}];

const words=(value:string)=>value.replace(/[^a-z]+/gi,' ').trim().split(' ').filter(Boolean).map(w=>w[0]!.toUpperCase()+w.slice(1).toLowerCase());
const roleFor=(email:string):Role=>{const at=email.toLowerCase();return at.includes('admin')?'ADMIN':at.includes('org')?'ORGANIZATION':at.includes('tutor')||at.includes('trainer')?'TUTOR':'STUDENT'};
/* Any other address still signs in, so a demo never dead-ends on an unknown email. */
const guestFor=(email:string):SessionUser=>{const[first,last]=words(email.split('@')[0]??'');return{id:`demo-${email.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,firstName:first??'Guest',lastName:last??'Learner',email,role:roleFor(email),country:null,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}};

const read=():SessionUser|null=>{try{const raw=localStorage.getItem(KEY);return raw?JSON.parse(raw) as SessionUser:null}catch{return null}};
const write=(user:SessionUser|null)=>{try{if(user)localStorage.setItem(KEY,JSON.stringify(user));else localStorage.removeItem(KEY)}catch{/* storage blocked (private window) — session just won't survive a refresh */}};

export const authRepository={
 accounts:demoAccounts,
 session:read,
 login:async(email:string)=>{const match=demoAccounts.find(a=>a.email.toLowerCase()===email.trim().toLowerCase());const user=match??guestFor(email.trim());write(user);return wait(user)},
 register:async(input:{firstName:string;lastName:string;email:string;accountType:AccountType;organisationName?:string})=>{
  const firstName=input.firstName||'New';
  const lastName=input.lastName||'Member';
  const base:SessionUser={id:`demo-${Date.now()}`,firstName,lastName,email:input.email,role:'STUDENT',country:null,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone};
  // Without the API there is no organisation to join, so an organisation signup only names itself.
  const user:SessionUser=input.accountType==='ORGANIZATION'
   ?{...base,role:'ORGANIZATION',orgName:input.organisationName||`${firstName}'s training`}
   :{...base,role:input.accountType};
  write(user);
  return wait(user);
 },
 clear:()=>write(null),
 logout:async()=>{write(null);return wait(null)},
};
