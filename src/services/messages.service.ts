import{api}from'./api';

export type Conversation={id:string;otherId:string;otherName:string;preview:string;unread:number;lastMessageAt?:string};
export type Message={id:string;senderId:string;body:string;createdAt:string};

/* Messaging is only between two people who share a session, so there is nobody to search for:
   your conversations are the people you already teach or learn from. */
export const messagesService={
 conversations:()=>api<{items:Conversation[]}>('/conversations').then(r=>r.items),

 /** Finds the thread with someone, or starts it. */
 open:(userId:string)=>api<{conversation:Conversation}>('/conversations',{method:'POST',body:JSON.stringify({userId})}).then(r=>r.conversation),

 /** A page of the thread, oldest first. Reading it marks it read. */
 messages:(conversationId:string,before?:string)=>
  api<{items:Message[];more:boolean}>(`/conversations/${conversationId}/messages${before?`?before=${encodeURIComponent(before)}`:''}`),

 send:(conversationId:string,body:string)=>
  api<{message:Message}>(`/conversations/${conversationId}/messages`,{method:'POST',body:JSON.stringify({body})}).then(r=>r.message),
};
