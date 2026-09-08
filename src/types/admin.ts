export type AdminStatus='Active'|'Pending'|'Approved'|'Suspended'|'Completed'|'Open'|'Published'|'Draft'|'Processing'|'Rejected';
export interface AdminDashboardMetrics{label:string;value:string;change:string;note:string;tone?:'good'|'warn'|'risk'}
export interface AdminActivity{id:string;actor:string;event:string;time:string;href:string;kind:string}
export interface AdminRecord{id:string;primary:string;secondary:string;meta:string[];status:AdminStatus;amount?:string}
export interface AdminSection{title:string;description:string;columns:string[];records:AdminRecord[];actions:string[]}
export interface PlatformSettings{platformName:string;supportEmail:string;currency:string;timezone:string;tutorApproval:boolean;trialLessons:boolean;minDuration:number;maxDuration:number;commission:number}
export interface FeatureFlag{key:string;label:string;enabled:boolean}
export interface AdminUser{id:string;name:string;email:string;role:'Super Admin'|'Operations Admin'|'Tutor Manager'|'Finance Admin'|'Support Admin'|'Content Admin';status:'Active'|'Invited'}
export interface AuditLogEntry{id:string;admin:string;action:string;resource:string;timestamp:string;ip:string}
