export type ID=string;export type Status='UPCOMING'|'COMPLETED'|'CANCELLED'|'PENDING'|'SUBMITTED'|'REVIEWED';
export interface Assignment{ id:ID;title:string;tutorName:string;studentName:string;lessonTitle:string;dueDate:string;status:'PENDING'|'SUBMITTED'|'REVIEWED';description:string;instructions:string;score?:number }
export interface Transaction{ id:ID;description:string;date:string;amount:number;status:'PAID'|'PENDING'|'REFUNDED';kind:'LESSON'|'WITHDRAWAL'|'FEE' }
export interface ManagedUser{ id:ID;name:string;email:string;role:'STUDENT'|'TUTOR';status:'ACTIVE'|'PENDING'|'SUSPENDED';joined:string;metric:string }
