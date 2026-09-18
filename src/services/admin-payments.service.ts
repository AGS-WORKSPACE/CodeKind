import{api}from'./api';
import type{Appeal,CurrencyCode,SessionPayment}from'../types/payments';

export type PlatformSettings=Record<string,number>;
export type Resolution={appellantAmount:number;respondentAmount:number;note:string};
export type CreditInput={ownerId:string;currency:CurrencyCode;amount:number;note:string};

/* The money side of the admin control centre. Each action needs its own permission; the API
   answers with a plain message when the signed-in admin does not hold it. */
export const adminPaymentsService={
 settings:()=>api<{settings:PlatformSettings}>('/admin/settings').then(r=>r.settings),
 saveSettings:(values:PlatformSettings)=>api<{settings:PlatformSettings}>('/admin/settings',{method:'PUT',body:JSON.stringify(values)}).then(r=>r.settings),

 payments:(status?:SessionPayment['status'])=>api<{items:SessionPayment[]}>(`/admin/session-payments${status?`?status=${status}`:''}`).then(r=>r.items),

 appeals:(status?:Appeal['status'])=>api<{items:Appeal[]}>(`/admin/appeals${status?`?status=${status}`:''}`).then(r=>r.items),
 resolveAppeal:(id:string,input:Resolution)=>api<{appeal:Appeal}>(`/admin/appeals/${id}/resolve`,{method:'POST',body:JSON.stringify(input)}).then(r=>r.appeal),

 /** Credits someone's wallet from platform funds: a refund, a goodwill gesture or a promotion. */
 credit:(input:CreditInput)=>api<{wallet:{id:string;available:number;currency:CurrencyCode}}>('/admin/wallets/credits',{method:'POST',body:JSON.stringify(input)}).then(r=>r.wallet),

 permissions:(userId:string)=>api<{permissions:string[];all:string[]}>(`/admin/admins/${userId}/permissions`),
 setPermission:(userId:string,permission:string,granted:boolean)=>
  api<{permissions:string[];all:string[]}>(`/admin/admins/${userId}/permissions`,{method:'PUT',body:JSON.stringify({permission,granted})}),
};
