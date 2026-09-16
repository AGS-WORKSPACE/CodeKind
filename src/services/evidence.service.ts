import{api}from'./api';
import type{Booking}from'./schedule.service';

export type EvidenceInterval={from:string;to:string};
export type EvidenceSide={present:EvidenceInterval[];presentSeconds:number;samples:number;audioFlowing:number;videoFlowing:number;reconnects:number;degraded:number};
export type EvidenceEvent={eventId:string;occurredAt:string;source:'server'|'client'|'turn';actorSide:'learner'|'tutor'|null;type:string;payload:Record<string,unknown>};
export type Evidence={sessionId:string;scheduledFrom:string;scheduledTo:string;learner:EvidenceSide;tutor:EvidenceSide;togetherSeconds:number;serverEvents:number;clientEvents:number;timeline:EvidenceEvent[]};

// No offline fallback: evidence only means something when it comes from the server.
export const evidenceService={
 forAdmin:(sessionId:string)=>api<{evidence:Evidence;booking:Booking}>(`/admin/sessions/${sessionId}/evidence`),
};
