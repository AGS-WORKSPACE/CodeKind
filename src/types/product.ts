export type ID=string;export type Status='UPCOMING'|'COMPLETED'|'CANCELLED'|'PENDING'|'SUBMITTED'|'REVIEWED';
export interface Lesson{ id:ID;tutorId:ID;tutorName:string;tutorAvatar:string;studentName:string;topic:string;skill:string;startTime:string;durationMinutes:30|60;lessonType:'TRIAL'|'REGULAR';status:Status;notes?:string;price:number }
export interface Assignment{ id:ID;title:string;tutorName:string;studentName:string;lessonTitle:string;dueDate:string;status:'PENDING'|'SUBMITTED'|'REVIEWED';description:string;instructions:string;score?:number }
export interface Notification{ id:ID;type:'LESSON'|'MESSAGE'|'ASSIGNMENT'|'PAYMENT'|'REVIEW'|'APPROVAL';title:string;body:string;createdAt:string;read:boolean }
export interface Transaction{ id:ID;description:string;date:string;amount:number;status:'PAID'|'PENDING'|'REFUNDED';kind:'LESSON'|'WITHDRAWAL'|'FEE' }
export interface ManagedUser{ id:ID;name:string;email:string;role:'STUDENT'|'TUTOR';status:'ACTIVE'|'PENDING'|'SUSPENDED';joined:string;metric:string }
export interface AvailabilityPeriod{ id:ID;day:string;start:string;end:string;enabled:boolean }
