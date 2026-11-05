import type{ReactNode}from'react';
import{ShieldCheck}from'lucide-react';

/*
 * The three things a page says when it has no rows to show: nothing here yet, something broke, or
 * still loading. They were written out by hand on every page, which is how eight slightly
 * different versions of the same box appeared. The markup and classes are unchanged — only the
 * place they live has.
 */

/** Nothing to show, and that is normal: an empty list, a filter that matched nobody. */
export function EmptyState({icon,title,children,action}:{icon:ReactNode;title:string;children?:ReactNode;action?:ReactNode}){
 return <div className="api-state">{icon}<h3>{title}</h3>{children&&<p>{children}</p>}{action}</div>;
}

/** Something went wrong. A retry is offered when the page can simply ask again. */
export function ErrorState({title,message,onRetry,action,icon}:{title:string;message?:string;onRetry?:()=>void;action?:ReactNode;icon?:ReactNode}){
 return <div className="api-state error">
  {icon??<ShieldCheck/>}
  <h3>{title}</h3>
  {message&&<p>{message}</p>}
  {onRetry&&<button className="btn" onClick={onRetry}>Try again</button>}
  {action}
 </div>;
}
