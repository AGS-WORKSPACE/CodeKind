import type{CurrencyCode}from'./payments';

export type AdStatus='OPEN'|'CLOSED'|'FILLED'|'CANCELLED';
export type ApplicationStatus='APPLIED'|'SHORTLISTED'|'ACCEPTED'|'DECLINED'|'WITHDRAWN';

/**
 * A learner's request for teaching. The rate on the ad is the learner's own — whichever tutor is
 * accepted is paid at this rate, not at their listed one.
 */
export type LearningAd={
 id:string;
 learnerId:string;
 learnerName:string;
 title:string;
 description:string;
 skill:string;
 level:'Beginner'|'Intermediate'|'Advanced';
 currency:CurrencyCode;
 hourlyRate:number;
 sessionMinutes:number;
 preferredTimes:string;
 status:AdStatus;
 createdAt:string;
 closesAt:string;
 applicationCount:number;
};

export type TutorApplication={
 id:string;
 adId:string;
 tutorId:string;
 tutorName:string;
 headline:string;
 rating:number;
 message:string;
 status:ApplicationStatus;
 createdAt:string;
};
