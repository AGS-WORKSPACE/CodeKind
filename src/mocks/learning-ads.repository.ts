import type{LearningAd,TutorApplication}from'../types/learning-ads';
import type{CurrencyCode}from'../types/payments';
import{delay,escrow,mutate,newId,snapshot,timestamp}from'./payments.store';

export type AdInput={
 learnerId:string;
 learnerName:string;
 title:string;
 description:string;
 skill:string;
 level:LearningAd['level'];
 currency:CurrencyCode;
 hourlyRate:number;
 sessionMinutes:number;
 preferredTimes:string;
 /** Days the ad stays open for applications. */
 openForDays?:number;
};

export type ApplyInput={adId:string;tutorId:string;tutorName:string;headline:string;rating:number;message:string};

const newestFirst=<T extends{createdAt:string}>(a:T,b:T)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime();

export const learningAdsRepository={
 /** The tutor-facing board: open ads only, optionally narrowed to one skill. */
 board:async(skill?:string)=>{
  const rows=snapshot().ads.filter(ad=>ad.status==='OPEN'&&(!skill||ad.skill.toLowerCase()===skill.toLowerCase()));
  return delay(rows.sort(newestFirst));
 },

 byLearner:async(learnerId:string)=>delay(snapshot().ads.filter(ad=>ad.learnerId===learnerId).sort(newestFirst)),

 ad:async(adId:string)=>delay(snapshot().ads.find(ad=>ad.id===adId)??null),

 applications:async(adId:string)=>delay(snapshot().applications.filter(a=>a.adId===adId).sort(newestFirst)),

 byTutor:async(tutorId:string)=>delay(snapshot().applications.filter(a=>a.tutorId===tutorId).sort(newestFirst)),

 create:async(input:AdInput)=>delay(mutate(store=>{
  if(input.hourlyRate<=0)throw new Error('Set the hourly rate you are willing to pay.');
  const days=input.openForDays??14;
  const ad:LearningAd={
   id:newId('ad'),
   learnerId:input.learnerId,
   learnerName:input.learnerName,
   title:input.title.trim(),
   description:input.description.trim(),
   skill:input.skill,
   level:input.level,
   currency:input.currency,
   hourlyRate:input.hourlyRate,
   sessionMinutes:input.sessionMinutes,
   preferredTimes:input.preferredTimes.trim(),
   status:'OPEN',
   createdAt:timestamp(),
   closesAt:new Date(Date.now()+days*86_400_000).toISOString(),
   applicationCount:0,
  };
  store.ads.push(ad);
  return ad;
 })),

 close:async(adId:string)=>delay(mutate(store=>{
  const ad=store.ads.find(a=>a.id===adId);
  if(!ad)throw new Error('Unknown ad.');
  if(ad.status==='FILLED')throw new Error('This ad has already been filled.');
  ad.status='CLOSED';
  return ad;
 })),

 apply:async(input:ApplyInput)=>delay(mutate(store=>{
  const ad=store.ads.find(a=>a.id===input.adId);
  if(!ad)throw new Error('Unknown ad.');
  if(ad.status!=='OPEN')throw new Error('This ad is no longer taking applications.');
  if(store.applications.some(a=>a.adId===ad.id&&a.tutorId===input.tutorId&&a.status!=='WITHDRAWN'))throw new Error('You have already applied to this ad.');
  const application:TutorApplication={id:newId('app'),adId:ad.id,tutorId:input.tutorId,tutorName:input.tutorName,headline:input.headline,rating:input.rating,message:input.message.trim(),status:'APPLIED',createdAt:timestamp()};
  store.applications.push(application);
  ad.applicationCount+=1;
  return application;
 })),

 setApplicationStatus:async(applicationId:string,status:TutorApplication['status'])=>delay(mutate(store=>{
  const application=store.applications.find(a=>a.id===applicationId);
  if(!application)throw new Error('Unknown application.');
  if(status==='ACCEPTED')throw new Error('Use accept() so the session and its escrow are created together.');
  application.status=status;
  return application;
 })),

 /**
  * Accepting an application books the session there and then. The rate is the learner's advertised
  * one, not the tutor's listed rate, and the escrow is taken immediately — an accepted ad and an
  * unfunded session must never exist separately.
  */
 accept:async(applicationId:string)=>delay(mutate(store=>{
  const application=store.applications.find(a=>a.id===applicationId);
  if(!application)throw new Error('Unknown application.');
  const ad=store.ads.find(a=>a.id===application.adId);
  if(!ad)throw new Error('Unknown ad.');
  if(ad.status!=='OPEN')throw new Error('This ad is no longer open.');

  const payment=escrow(store,{
   sessionId:newId('les'),
   source:'LEARNING_AD',
   adId:ad.id,
   payerId:ad.learnerId,
   payerType:'USER',
   payerName:ad.learnerName,
   payeeId:application.tutorId,
   payeeName:application.tutorName,
   topic:ad.title,
   skill:ad.skill,
   /* The ad carries preferred times as free text, so accepting schedules a day out and both sides
      confirm the exact slot in messages. A real calendar picker replaces this. */
   startsAt:new Date(Date.now()+86_400_000).toISOString(),
   currency:ad.currency,
   hourlyRate:ad.hourlyRate,
   scheduledMinutes:ad.sessionMinutes,
  });

  application.status='ACCEPTED';
  for(const other of store.applications)if(other.adId===ad.id&&other.id!==application.id&&other.status!=='WITHDRAWN')other.status='DECLINED';
  ad.status='FILLED';
  return{ad,application,payment};
 })),
};
