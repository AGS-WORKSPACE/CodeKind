import{api}from'./api';

export type AdminUser={id:string;name:string;email:string};

export const adminUsersService={
 /** Finds people by name or email, for pages that act on one person. */
 search:(term:string)=>api<{items:AdminUser[]}>(`/admin/users?q=${encodeURIComponent(term)}`).then(r=>r.items),
};
