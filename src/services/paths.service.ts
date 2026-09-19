import{api,offlineFallback}from'./api';

export type PathLevel='beginner'|'intermediate'|'advanced';
export type PathModule={id:string;position:number;title:string;description:string};
export type LearningPath={id:string;slug:string;title:string;summary:string;level:PathLevel;skillCode:string|null;published:boolean;modules?:PathModule[];moduleCount:number;learners:number};
export type PathProgress={enrolled:boolean;startedAt:string|null;completedAt:string|null;done:string[]};
export type MyPath={path:LearningPath;progress:PathProgress};
export type PathInput={title:string;summary:string;level:PathLevel;skillCode:string;published:boolean;modules:{id?:string;title:string;description:string}[]};

/* Paths are written by the platform; learners enrol and tick modules off as they go. */
export const pathsService={
 list:()=>offlineFallback(()=>api<{items:LearningPath[]}>('/paths').then(r=>r.items),async()=>[] as LearningPath[]),
 get:(slug:string)=>api<{path:LearningPath}>(`/paths/${slug}`).then(r=>r.path),

 mine:()=>api<{items:MyPath[]}>('/paths/mine').then(r=>r.items),
 progress:(slug:string)=>api<{progress:PathProgress}>(`/paths/${slug}/progress`).then(r=>r.progress),
 enrol:(slug:string)=>api<{progress:PathProgress}>(`/paths/${slug}/enrol`,{method:'POST'}).then(r=>r.progress),
 leave:(slug:string)=>api<unknown>(`/paths/${slug}/enrol`,{method:'DELETE'}),
 mark:(slug:string,moduleId:string,done:boolean)=>
  api<{progress:PathProgress}>(`/paths/${slug}/modules/${moduleId}`,{method:'POST',body:JSON.stringify({done})}).then(r=>r.progress),

 /** Admin: every path, drafts included. Writing needs the paths.write permission. */
 all:()=>api<{items:LearningPath[]}>('/admin/paths').then(r=>r.items),
 draft:(slug:string)=>api<{path:LearningPath}>(`/admin/paths/${slug}`).then(r=>r.path),
 save:(input:PathInput,id?:string)=>
  api<{path:LearningPath}>(id?`/admin/paths/${id}`:'/admin/paths',{method:id?'PUT':'POST',body:JSON.stringify(input)}).then(r=>r.path),
};

/** The module a learner is on: the first one they have not finished. */
export const nextModule=(modules:PathModule[],done:string[])=>modules.find(module=>!done.includes(module.id));
