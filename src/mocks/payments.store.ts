import type{Appeal,AppealReason,CurrencyCode,SessionPayment,Settlement,TopUp,Wallet,WalletEntry,WalletEntryKind,WalletOwnerType,Withdrawal}from'../types/payments';
import type{LearningAd,TutorApplication}from'../types/learning-ads';
import{assertSameCurrency,billableMinutes,graceDeadline,prorate,splitFee}from'../lib/money';

/*
 * Offline stand-in for the payments backend. It is the single owner of the store because wallets
 * and the ledger must move together: an escrow that debits a wallet without writing its session
 * payment, or a maturity that pays a tutor twice, would be worse than no preview at all. The
 * repositories in the sibling files are thin views over the operations here.
 */
const KEY='codekind.payments';
const wait=<T>(value:T,ms=220)=>new Promise<T>(resolve=>setTimeout(()=>resolve(structuredClone(value)),ms));
const uid=(prefix:string)=>`${prefix}-${Math.random().toString(36).slice(2,10)}`;
const now=()=>new Date().toISOString();
const hoursFromNow=(hours:number)=>new Date(Date.now()+hours*3600_000).toISOString();

/** Escrow in flight lives here: captured from the payer, not yet owed to anybody in particular. */
export const CLEARING_ID='platform-clearing';
/** Where platform fees and unclaimed settlement remainders end up. */
export const REVENUE_ID='platform-revenue';
export const DEFAULT_FEE_BPS=1500;

export type PaymentsStore={
 wallets:Wallet[];
 entries:WalletEntry[];
 payments:SessionPayment[];
 appeals:Appeal[];
 topUps:TopUp[];
 withdrawals:Withdrawal[];
 ads:LearningAd[];
 applications:TutorApplication[];
 platformFeeBps:number;
};

const wallet=(ownerId:string,ownerType:WalletOwnerType,currency:CurrencyCode,available:number,isDefault:boolean):Wallet=>
 ({id:`wal-${ownerId}-${currency.toLowerCase()}`,ownerId,ownerType,currency,available,reserved:0,isDefault,createdAt:'2026-06-01T09:00:00.000Z'});

/* Seeded so every screen has something real to show: a paid session, one inside its grace period,
   one flagged by an appeal, one already settled by an admin, and an upcoming session in escrow. */
const seed=():PaymentsStore=>{
 const store:PaymentsStore={
  wallets:[
   wallet('demo-student','USER','USD',48_000,true),
   wallet('demo-student','USER','NGN',250_000,false),
   wallet('demo-tutor','USER','USD',31_500,true),
   wallet('demo-tutor','USER','NGN',1_450_000,false),
   wallet('org-northwind','ORG','GBP',820_000,true),
   wallet('org-northwind','ORG','USD',140_000,false),
   wallet(CLEARING_ID,'PLATFORM','USD',0,true),
   wallet(REVENUE_ID,'PLATFORM','USD',0,true),
  ],
  entries:[],
  payments:[],
  appeals:[],
  topUps:[],
  withdrawals:[],
  ads:[
   {id:'ad-1',learnerId:'demo-student',learnerName:'Alex Lee',title:'Weekly React and TypeScript coaching',description:'I am building a dashboard and want a reviewer who can pair with me on component design and typing.',skill:'React',level:'Intermediate',currency:'USD',hourlyRate:3_600,sessionMinutes:60,preferredTimes:'Weekday evenings, Europe/London',status:'OPEN',createdAt:hoursFromNow(-72),closesAt:hoursFromNow(168),applicationCount:2},
   {id:'ad-2',learnerId:'demo-student',learnerName:'Alex Lee',title:'Python data cleaning crash session',description:'One focused session on pandas joins and reshaping a messy CSV export.',skill:'Python',level:'Beginner',currency:'USD',hourlyRate:2_800,sessionMinutes:30,preferredTimes:'Saturday mornings',status:'OPEN',createdAt:hoursFromNow(-20),closesAt:hoursFromNow(96),applicationCount:1},
  ],
  applications:[
   {id:'app-1',adId:'ad-1',tutorId:'maya-chen',tutorName:'Maya Chen',headline:'Senior React engineer, design systems',rating:4.98,message:'I have led three dashboard rebuilds and review typing patterns daily. Happy to start with your current components.',status:'APPLIED',createdAt:hoursFromNow(-60)},
   {id:'app-2',adId:'ad-1',tutorId:'demo-tutor',tutorName:'David Okafor',headline:'Full-stack engineer, React and Python',rating:4.96,message:'I can pair on component design and cover the TypeScript generics you will need for the data layer.',status:'SHORTLISTED',createdAt:hoursFromNow(-48)},
   {id:'app-3',adId:'ad-2',tutorId:'demo-tutor',tutorName:'David Okafor',headline:'Full-stack engineer, React and Python',rating:4.96,message:'Pandas reshaping is most of my day job. We can clean your export live in one session.',status:'APPLIED',createdAt:hoursFromNow(-12)},
  ],
  platformFeeBps:DEFAULT_FEE_BPS,
 };

 // Build the seeded ledger through the real operations so balances and entries always agree.
 const paid=escrow(store,{sessionId:'les-992',source:'DIRECT_BOOKING',payerId:'demo-student',payerType:'USER',payerName:'Alex Lee',payeeId:'demo-tutor',payeeName:'David Okafor',topic:'State management patterns',currency:'USD',hourlyRate:4_200,scheduledMinutes:60});
 settle(store,paid.id,60*60,hoursFromNow(-40));
 mature(store,paid.id,hoursFromNow(-16));

 const pending=escrow(store,{sessionId:'les-1031',source:'DIRECT_BOOKING',payerId:'demo-student',payerType:'USER',payerName:'Alex Lee',payeeId:'demo-tutor',payeeName:'David Okafor',topic:'Async patterns and error handling',currency:'USD',hourlyRate:4_200,scheduledMinutes:60});
 settle(store,pending.id,52*60,hoursFromNow(-10));

 const flagged=escrow(store,{sessionId:'les-1035',source:'DIRECT_BOOKING',payerId:'demo-student',payerType:'USER',payerName:'Alex Lee',payeeId:'maya-chen',payeeName:'Maya Chen',topic:'Testing React components',currency:'USD',hourlyRate:3_800,scheduledMinutes:60});
 settle(store,flagged.id,58*60,hoursFromNow(-6));
 openAppeal(store,{sessionPaymentId:flagged.id,appellantId:'demo-student',reason:'LEFT_EARLY',details:'The tutor left after roughly 20 minutes and the remaining time was not taught.'});

 const settled=escrow(store,{sessionId:'les-1012',source:'LEARNING_AD',adId:'ad-1',payerId:'demo-student',payerType:'USER',payerName:'Alex Lee',payeeId:'aisha-khan',payeeName:'Aisha Khan',topic:'React Native navigation',currency:'USD',hourlyRate:3_400,scheduledMinutes:30});
 settle(store,settled.id,30*60,hoursFromNow(-20));
 const settledAppeal=openAppeal(store,{sessionPaymentId:settled.id,appellantId:'demo-student',reason:'QUALITY',details:'Most of the session was spent on setup problems rather than the agreed topic.'});
 resolveAppeal(store,settledAppeal.id,{appellantAmount:850,respondentAmount:600,note:'Session was partly delivered. Split between both parties, platform fee waived.',resolvedBy:'Sam Adeyemi'});

 escrow(store,{sessionId:'les-1042',source:'DIRECT_BOOKING',payerId:'demo-student',payerType:'USER',payerName:'Alex Lee',payeeId:'demo-tutor',payeeName:'David Okafor',topic:'Building reusable React hooks',currency:'USD',hourlyRate:4_200,scheduledMinutes:60});

 /* A trainer teaching under an organisation: the earning party is the organisation, so the money
    lands in the org wallet rather than the trainer's own. */
 const orgTaught=escrow(store,{sessionId:'les-1044',source:'DIRECT_BOOKING',payerId:'demo-student',payerType:'USER',payerName:'Alex Lee',payeeId:'ravi-menon',payeeName:'Ravi Menon',payeeOrgId:'org-northwind',topic:'Model evaluation and metrics',currency:'USD',hourlyRate:5_000,scheduledMinutes:60});
 settle(store,orgTaught.id,45*60,hoursFromNow(-30));
 mature(store,orgTaught.id,hoursFromNow(-6));

 return store;
};

/* The live store is held in memory and mirrored to localStorage. Reading straight from storage
   would mean that when storage is blocked — a private window, or storage turned off — every
   operation re-seeded, and a booking would vanish the moment the next one was read. In memory the
   session still behaves correctly; only surviving a refresh depends on storage. */
let cache:PaymentsStore|null=null;
const read=():PaymentsStore=>{
 if(cache)return cache;
 try{const raw=localStorage.getItem(KEY);if(raw){cache=JSON.parse(raw) as PaymentsStore;return cache}}catch{/* storage blocked */}
 return write(seed());
};
const write=(store:PaymentsStore)=>{
 cache=store;
 try{localStorage.setItem(KEY,JSON.stringify(store))}catch{/* storage blocked — changes just won't survive a refresh */}
 return store;
};

/** Read, mutate, persist. Every operation goes through here so nothing writes a half-applied change. */
export const mutate=<T>(operation:(store:PaymentsStore)=>T):T=>{
 const store=read();
 const result=operation(store);
 write(store);
 return result;
};

/** Matured rows are swept on read, standing in for the server-side job that would do it hourly. */
export const snapshot=():PaymentsStore=>mutate(store=>{sweep(store);return store});

// ---------------------------------------------------------------------------
// Wallet primitives
// ---------------------------------------------------------------------------

export const findWallet=(store:PaymentsStore,ownerId:string,currency:CurrencyCode)=>
 store.wallets.find(w=>w.ownerId===ownerId&&w.currency===currency);

/**
 * Wallets are created on demand: a tutor paid in a currency they have never held simply gains a
 * wallet for it, which is what "every organisation/individual has wallets for supported
 * currencies" means in practice.
 */
export const ensureWallet=(store:PaymentsStore,ownerId:string,ownerType:WalletOwnerType,currency:CurrencyCode)=>{
 const existing=findWallet(store,ownerId,currency);
 if(existing)return existing;
 const created:Wallet={id:uid('wal'),ownerId,ownerType,currency,available:0,reserved:0,isDefault:!store.wallets.some(w=>w.ownerId===ownerId),createdAt:now()};
 store.wallets.push(created);
 return created;
};

type EntryInput={kind:WalletEntryKind;amount:number;description:string;reference?:WalletEntry['reference'];counterpartyWalletId?:string;createdAt?:string};

const entry=(store:PaymentsStore,target:Wallet,direction:'CREDIT'|'DEBIT',input:EntryInput)=>{
 store.entries.push({id:uid('ent'),walletId:target.id,ownerId:target.ownerId,currency:target.currency,direction,kind:input.kind,amount:input.amount,balanceAfter:target.available,counterpartyWalletId:input.counterpartyWalletId,reference:input.reference,description:input.description,createdAt:input.createdAt??now()});
};

export const credit=(store:PaymentsStore,target:Wallet,input:EntryInput)=>{
 target.available+=input.amount;
 entry(store,target,'CREDIT',input);
 return target;
};

export const debit=(store:PaymentsStore,target:Wallet,input:EntryInput)=>{
 if(target.available<input.amount)throw new Error(`Insufficient ${target.currency} balance.`);
 target.available-=input.amount;
 entry(store,target,'DEBIT',input);
 return target;
};

export const transfer=(store:PaymentsStore,from:Wallet,to:Wallet,input:EntryInput)=>{
 assertSameCurrency(from.currency,to.currency);
 debit(store,from,{...input,counterpartyWalletId:to.id});
 credit(store,to,{...input,counterpartyWalletId:from.id});
};

/** Escrow: the money stays the payer's but leaves `available`, so it cannot be spent twice. */
const hold=(store:PaymentsStore,target:Wallet,input:EntryInput)=>{
 if(target.available<input.amount)throw new Error(`Insufficient ${target.currency} balance to hold ${input.amount}.`);
 target.available-=input.amount;
 target.reserved+=input.amount;
 entry(store,target,'DEBIT',{...input,kind:'HOLD'});
};

const release=(store:PaymentsStore,target:Wallet,input:EntryInput)=>{
 const amount=Math.min(input.amount,target.reserved);
 target.reserved-=amount;
 target.available+=amount;
 entry(store,target,'CREDIT',{...input,amount,kind:'RELEASE'});
};

const capture=(store:PaymentsStore,target:Wallet,clearing:Wallet,input:EntryInput)=>{
 const amount=Math.min(input.amount,target.reserved);
 target.reserved-=amount;
 entry(store,target,'DEBIT',{...input,amount,kind:'CAPTURE',counterpartyWalletId:clearing.id});
 credit(store,clearing,{...input,amount,kind:'CAPTURE',counterpartyWalletId:target.id});
};

const platformWallet=(store:PaymentsStore,id:string,currency:CurrencyCode)=>ensureWallet(store,id,'PLATFORM',currency);

// ---------------------------------------------------------------------------
// Session payment lifecycle
// ---------------------------------------------------------------------------

export type EscrowInput={
 sessionId:string;
 source:SessionPayment['source'];
 adId?:string;
 payerId:string;
 payerType:'USER'|'ORG';
 payerName:string;
 payeeId:string;
 payeeName:string;
 payeeOrgId?:string;
 topic:string;
 currency:CurrencyCode;
 hourlyRate:number;
 scheduledMinutes:number;
};

/**
 * Booking. The full scheduled duration is held up front; because billing is capped at that
 * duration, the hold is always enough and the surplus goes back when the session settles.
 */
export function escrow(store:PaymentsStore,input:EscrowInput):SessionPayment{
 if(input.hourlyRate<=0)throw new Error('An hourly rate is required before a session can be booked.');
 if(input.payerId===input.payeeId)throw new Error('A session cannot be paid to its own payer.');
 const payerWallet=findWallet(store,input.payerId,input.currency);
 if(!payerWallet)throw new Error(`No ${input.currency} wallet. Top up or choose a currency you hold.`);
 const held=prorate(input.hourlyRate,input.scheduledMinutes);
 if(payerWallet.available<held)throw new Error(`Not enough ${input.currency} to cover this session.`);

 const payment:SessionPayment={
  id:uid('pay'),
  sessionId:input.sessionId,
  source:input.source,
  adId:input.adId,
  payerId:input.payerId,
  payerType:input.payerType,
  payerName:input.payerName,
  payeeId:input.payeeId,
  payeeName:input.payeeName,
  payeeOrgId:input.payeeOrgId,
  topic:input.topic,
  currency:input.currency,
  hourlyRate:input.hourlyRate,
  scheduledMinutes:input.scheduledMinutes,
  billedMinutes:null,
  heldAmount:held,
  grossAmount:0,
  platformFeeBps:store.platformFeeBps,
  platformFee:0,
  netAmount:0,
  status:'HELD',
  createdAt:now(),
 };
 hold(store,payerWallet,{kind:'HOLD',amount:held,description:`Escrow for ${input.topic}`,reference:{type:'SESSION_PAYMENT',id:payment.id}});
 store.payments.push(payment);
 return payment;
}

/**
 * End of session. Attended time becomes the bill, the bill is captured into clearing, the rest goes
 * back to the payer, and the tutor's share becomes a pending balance — a ledger figure, not money
 * in their wallet, which is what makes the grace period meaningful.
 */
export function settle(store:PaymentsStore,paymentId:string,attendedSeconds:number,endedAt=now()):SessionPayment{
 const payment=store.payments.find(p=>p.id===paymentId);
 if(!payment)throw new Error('Unknown session payment.');
 if(payment.status!=='HELD')throw new Error(`This session was already settled (${payment.status}).`);

 const minutes=billableMinutes(attendedSeconds,payment.scheduledMinutes);
 const{gross,platformFee,net}=splitFee(prorate(payment.hourlyRate,minutes),payment.platformFeeBps);
 const payerWallet=findWallet(store,payment.payerId,payment.currency)!;
 const clearing=platformWallet(store,CLEARING_ID,payment.currency);
 const reference={type:'SESSION_PAYMENT' as const,id:payment.id};

 if(gross>0)capture(store,payerWallet,clearing,{kind:'CAPTURE',amount:gross,description:`${payment.topic} · ${minutes} min`,reference,createdAt:endedAt});
 const remainder=payment.heldAmount-gross;
 if(remainder>0)release(store,payerWallet,{kind:'RELEASE',amount:remainder,description:`Unused time returned · ${payment.topic}`,reference,createdAt:endedAt});

 payment.billedMinutes=minutes;
 payment.grossAmount=gross;
 payment.platformFee=platformFee;
 payment.netAmount=net;
 payment.endedAt=endedAt;
 payment.pendingSince=endedAt;
 payment.maturesAt=graceDeadline(endedAt);
 payment.status='PENDING';
 return payment;
}

/** Maturity: the pending balance becomes the tutor's money and the fee becomes platform revenue. */
export function mature(store:PaymentsStore,paymentId:string,paidAt=now()):SessionPayment{
 const payment=store.payments.find(p=>p.id===paymentId);
 if(!payment)throw new Error('Unknown session payment.');
 if(payment.status!=='PENDING')throw new Error(`Only a pending payment can be paid out (${payment.status}).`);

 const clearing=platformWallet(store,CLEARING_ID,payment.currency);
 const revenue=platformWallet(store,REVENUE_ID,payment.currency);
 const payee=ensureWallet(store,payment.payeeOrgId??payment.payeeId,payment.payeeOrgId?'ORG':'USER',payment.currency);
 const reference={type:'SESSION_PAYMENT' as const,id:payment.id};

 if(payment.netAmount>0)transfer(store,clearing,payee,{kind:'SESSION_EARNING',amount:payment.netAmount,description:`Session earning · ${payment.topic}`,reference,createdAt:paidAt});
 if(payment.platformFee>0)transfer(store,clearing,revenue,{kind:'PLATFORM_FEE',amount:payment.platformFee,description:`Platform fee · ${payment.topic}`,reference,createdAt:paidAt});

 payment.status='PAID';
 payment.paidAt=paidAt;
 return payment;
}

/** Cancelling before the session gives the whole escrow back. */
export function cancel(store:PaymentsStore,paymentId:string,reason:string):SessionPayment{
 const payment=store.payments.find(p=>p.id===paymentId);
 if(!payment)throw new Error('Unknown session payment.');
 if(payment.status!=='HELD')throw new Error('Only a session still in escrow can be cancelled.');
 const payerWallet=findWallet(store,payment.payerId,payment.currency)!;
 release(store,payerWallet,{kind:'RELEASE',amount:payment.heldAmount,description:`Booking cancelled · ${reason||payment.topic}`,reference:{type:'SESSION_PAYMENT',id:payment.id}});
 payment.status='CANCELLED';
 payment.billedMinutes=0;
 return payment;
}

/** Anything pending whose grace period has run out, and which no appeal has flagged, pays out. */
export function sweep(store:PaymentsStore){
 const due=store.payments.filter(p=>p.status==='PENDING'&&p.maturesAt&&new Date(p.maturesAt).getTime()<=Date.now());
 for(const payment of due)mature(store,payment.id);
 return due.length;
}

// ---------------------------------------------------------------------------
// Appeals
// ---------------------------------------------------------------------------

export type AppealInput={sessionPaymentId:string;appellantId:string;reason:AppealReason;details:string};

/** Only the payer, only while the money is still pending and still inside the 24-hour window. */
export function openAppeal(store:PaymentsStore,input:AppealInput):Appeal{
 const payment=store.payments.find(p=>p.id===input.sessionPaymentId);
 if(!payment)throw new Error('Unknown session payment.');
 if(payment.payerId!==input.appellantId)throw new Error('Only the payer of a session can appeal it.');
 if(payment.status!=='PENDING')throw new Error(payment.status==='PAID'?'This session has already been paid out and can no longer be appealed.':`A ${payment.status.toLowerCase()} payment cannot be appealed.`);
 if(payment.maturesAt&&new Date(payment.maturesAt).getTime()<=Date.now())throw new Error('The 24-hour appeal window has closed.');

 const appeal:Appeal={
  id:uid('apl'),
  sessionPaymentId:payment.id,
  sessionId:payment.sessionId,
  appellantId:payment.payerId,
  appellantName:payment.payerName,
  respondentId:payment.payeeId,
  respondentName:payment.payeeName,
  reason:input.reason,
  details:input.details,
  status:'OPEN',
  createdAt:now(),
 };
 store.appeals.push(appeal);
 // Flagging is what stops maturity: the sweep only ever looks at PENDING rows.
 payment.status='FLAGGED';
 payment.appealId=appeal.id;
 return appeal;
}

export type ResolutionInput={appellantAmount:number;respondentAmount:number;note:string;resolvedBy:string};

/**
 * Manual resolution by an admin. The captured gross is still sitting in clearing, so paying either
 * side is a transfer rather than a clawback; whatever is not awarded is kept as platform revenue.
 */
export function resolveAppeal(store:PaymentsStore,appealId:string,input:ResolutionInput):Appeal{
 const appeal=store.appeals.find(a=>a.id===appealId);
 if(!appeal)throw new Error('Unknown appeal.');
 if(appeal.status==='RESOLVED')throw new Error('This appeal has already been resolved.');
 const payment=store.payments.find(p=>p.id===appeal.sessionPaymentId);
 if(!payment)throw new Error('Unknown session payment.');
 const awarded=input.appellantAmount+input.respondentAmount;
 if(input.appellantAmount<0||input.respondentAmount<0)throw new Error('Settlement amounts cannot be negative.');
 if(awarded>payment.grossAmount)throw new Error('A settlement cannot award more than the session collected.');

 const clearing=platformWallet(store,CLEARING_ID,payment.currency);
 const revenue=platformWallet(store,REVENUE_ID,payment.currency);
 const reference={type:'APPEAL' as const,id:appeal.id};
 const resolvedAt=now();

 if(input.appellantAmount>0){
  const appellant=ensureWallet(store,payment.payerId,payment.payerType,payment.currency);
  transfer(store,clearing,appellant,{kind:'APPEAL_SETTLEMENT',amount:input.appellantAmount,description:`Appeal settlement · ${payment.topic}`,reference,createdAt:resolvedAt});
 }
 if(input.respondentAmount>0){
  const respondent=ensureWallet(store,payment.payeeOrgId??payment.payeeId,payment.payeeOrgId?'ORG':'USER',payment.currency);
  transfer(store,clearing,respondent,{kind:'APPEAL_SETTLEMENT',amount:input.respondentAmount,description:`Appeal settlement · ${payment.topic}`,reference,createdAt:resolvedAt});
 }
 const retained=payment.grossAmount-awarded;
 if(retained>0)transfer(store,clearing,revenue,{kind:'PLATFORM_FEE',amount:retained,description:`Retained after appeal · ${payment.topic}`,reference,createdAt:resolvedAt});

 const settlement:Settlement={appellantAmount:input.appellantAmount,respondentAmount:input.respondentAmount,platformRetained:retained,currency:payment.currency,note:input.note,resolvedBy:input.resolvedBy,resolvedAt};
 appeal.status='RESOLVED';
 appeal.reviewedBy=input.resolvedBy;
 appeal.resolvedAt=resolvedAt;
 appeal.resolutionNote=input.note;
 payment.status='APPEAL_SETTLEMENT';
 payment.settlement=settlement;
 return appeal;
}

/** Withdrawing an appeal hands the row back to the normal grace-period path. */
export function withdrawAppeal(store:PaymentsStore,appealId:string):Appeal{
 const appeal=store.appeals.find(a=>a.id===appealId);
 if(!appeal)throw new Error('Unknown appeal.');
 if(appeal.status!=='OPEN'&&appeal.status!=='UNDER_REVIEW')throw new Error('Only an open appeal can be withdrawn.');
 const payment=store.payments.find(p=>p.id===appeal.sessionPaymentId);
 appeal.status='WITHDRAWN';
 if(payment&&payment.status==='FLAGGED'){
  payment.status='PENDING';
  payment.appealId=undefined;
 }
 return appeal;
}

// ---------------------------------------------------------------------------
// Wallet funding
// ---------------------------------------------------------------------------

export function topUp(store:PaymentsStore,ownerId:string,ownerType:WalletOwnerType,currency:CurrencyCode,amount:number,method:string):TopUp{
 if(amount<=0)throw new Error('Enter an amount to add.');
 const target=ensureWallet(store,ownerId,ownerType,currency);
 const record:TopUp={id:uid('top'),walletId:target.id,ownerId,currency,amount,method,status:'COMPLETED',createdAt:now()};
 credit(store,target,{kind:'TOPUP',amount,description:`Wallet top-up · ${method}`,reference:{type:'TOPUP',id:record.id}});
 store.topUps.push(record);
 return record;
}

/** Reserved money is escrow, so only `available` can leave the platform. */
export function withdraw(store:PaymentsStore,ownerId:string,currency:CurrencyCode,amount:number,destination:string):Withdrawal{
 if(amount<=0)throw new Error('Enter an amount to withdraw.');
 const target=findWallet(store,ownerId,currency);
 if(!target)throw new Error(`No ${currency} wallet to withdraw from.`);
 if(target.available<amount)throw new Error(`Only ${target.available} minor units are available in ${currency}.`);
 const record:Withdrawal={id:uid('wdr'),walletId:target.id,ownerId,currency,amount,destination,status:'PENDING',createdAt:now()};
 debit(store,target,{kind:'WITHDRAWAL',amount,description:`Withdrawal to ${destination}`,reference:{type:'WITHDRAWAL',id:record.id}});
 store.withdrawals.push(record);
 return record;
}

// ---------------------------------------------------------------------------
// Preview helpers
// ---------------------------------------------------------------------------

/**
 * Demo affordance only. Backdates a pending row so the 24-hour transition can be watched without
 * waiting a day; the real backend has a scheduled job instead.
 */
export function fastForwardGrace(store:PaymentsStore,paymentId:string){
 const payment=store.payments.find(p=>p.id===paymentId);
 if(!payment)throw new Error('Unknown session payment.');
 if(payment.status==='FLAGGED')throw new Error('This payment is flagged by an appeal and cannot mature.');
 if(payment.status!=='PENDING')throw new Error('Only a pending payment has a grace period to skip.');
 payment.pendingSince=hoursFromNow(-25);
 payment.maturesAt=hoursFromNow(-1);
 return mature(store,payment.id);
}

export const resetPayments=()=>write(seed());
export const delay=wait;
export const newId=uid;
export const timestamp=now;
