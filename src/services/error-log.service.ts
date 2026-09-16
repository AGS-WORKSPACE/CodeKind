import{api}from'./api';

export type ErrorSource='http'|'panic'|'mail'|'search'|'telemetry';
export type ErrorLogEntry={id:string;source:ErrorSource;message:string;detail:string|null;method:string|null;path:string|null;status:number|null;userId:string|null;createdAt:string};

// No offline fallback: an error log only means something when it comes from the real server.
export const errorLogService={
 recent:(source:ErrorSource|'',limit=100)=>api<{items:ErrorLogEntry[]}>(`/admin/error-logs?source=${source}&limit=${limit}`).then(r=>r.items),
};
