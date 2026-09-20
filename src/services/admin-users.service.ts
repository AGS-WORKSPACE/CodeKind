import{api}from'./api';
import type{Booking}from'./schedule.service';

export type AdminUser={id:string;name:string;email:string};

export const adminUsersService={
 /** Finds people by name or email, for pages that act on one person. */
 search:(term:string)=>api<{items:AdminUser[]}>(`/admin/users?q=${encodeURIComponent(term)}`).then(r=>r.items),
};

export type AdminPerson={
 id:string;name:string;email:string;workspaces:string[];verified:boolean;suspended:boolean;
 suspensionReason?:string;suspendedAt?:string;tutorState?:string;booked:number;taught:number;
 spent:number;earned:number;currency?:string;joinedAt:string;
};
export type PeopleQuery={q?:string;role?:string;state?:string;page?:number};
export type Page<T>={items:T[];total:number;pageSize:number};
export type AdminTeamMember={id:string;name:string;email:string;permissions:string[]};
export type AuditEntry={id:string;admin:string;action:string;subject:string;subjectId:string;detail:string;createdAt:string};

const query=(params:Record<string,string|number|undefined>)=>{
 const search=new URLSearchParams();
 for(const[key,value]of Object.entries(params))if(value)search.set(key,String(value));
 const text=search.toString();
 return text?`?${text}`:'';
};

/* The control centre: who is on the platform, every session, who administers it, and the trail of
   what administrators have done. */
export const adminControlService={
 people:(q:PeopleQuery)=>api<Page<AdminPerson>>(`/admin/people${query(q)}`),
 suspend:(id:string,reason:string)=>api<{person:AdminPerson}>(`/admin/people/${id}/suspend`,{method:'POST',body:JSON.stringify({reason})}).then(r=>r.person),
 restore:(id:string)=>api<{person:AdminPerson}>(`/admin/people/${id}/restore`,{method:'POST'}).then(r=>r.person),
 bookings:(q:{q?:string;view?:string;page?:number})=>api<Page<Booking>>(`/admin/bookings${query(q)}`),
 cancelBooking:(id:string,reason:string)=>api<{booking:Booking}>(`/admin/bookings/${id}/cancel`,{method:'POST',body:JSON.stringify({reason})}).then(r=>r.booking),
 team:()=>api<{items:AdminTeamMember[];keys:string[]}>('/admin/admins'),
 setPermission:(adminId:string,permission:string,granted:boolean)=>
  api<{permissions:string[]}>(`/admin/admins/${adminId}/permissions`,{method:'PUT',body:JSON.stringify({permission,granted})}).then(r=>r.permissions),
 audit:(page=1)=>api<Page<AuditEntry>>(`/admin/audit${query({page})}`),
};
