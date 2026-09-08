export type ConnectionQuality='EXCELLENT'|'GOOD'|'POOR'|'DISCONNECTED';export type ExecutionStatus='IDLE'|'RUNNING'|'SUCCESS'|'ERROR'|'TIMEOUT';
export interface ClassroomParticipant{id:string;name:string;role:'TUTOR'|'STUDENT';avatar:string;camera:boolean;muted:boolean;speaking:boolean;sharing:boolean;color:string}
export interface EditorFile{id:string;name:string;path:string;language:string;content:string;dirty:boolean}
export interface ConsoleMessage{id:string;kind:'INFO'|'OUTPUT'|'SUCCESS'|'WARNING'|'ERROR';text:string;timestamp:string}
export interface CodeExecution{status:ExecutionStatus;messages:ConsoleMessage[];durationMs?:number}
export interface TestCase{id:string;name:string;passed:boolean;expected?:string;received?:string}
export interface Exercise{id:string;title:string;difficulty:'Easy'|'Medium'|'Hard';instructions:string;expectedOutput:string;hint:string;tests:TestCase[]}
export interface LessonPlanItem{id:string;title:string;status:'COMPLETED'|'CURRENT'|'UPCOMING'}
export interface ClassroomMessage{id:string;author:string;avatar?:string;type:'TEXT'|'CODE'|'FILE'|'LINK'|'SYSTEM';body:string;timestamp:string;language?:string}
export interface CodeComment{id:string;line:number;author:string;body:string;resolved:boolean}
export interface LessonResource{id:string;type:'LINK'|'GITHUB'|'PDF'|'CODE'|'ARTICLE'|'VIDEO';title:string;url:string}
