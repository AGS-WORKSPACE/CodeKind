import{api,offlineFallback}from'./api';
import{learningAdsRepository,type AdInput,type ApplyInput}from'../mocks/learning-ads.repository';
import type{LearningAd,TutorApplication}from'../types/learning-ads';
import type{SessionPayment}from'../types/payments';

export const learningAdsService={
 board:(skill?:string)=>offlineFallback(
  ()=>api<{items:LearningAd[]}>(`/learning-ads${skill?`?skill=${encodeURIComponent(skill)}`:''}`).then(r=>r.items),
  ()=>learningAdsRepository.board(skill)),

 byLearner:(learnerId:string)=>offlineFallback(
  ()=>api<{items:LearningAd[]}>(`/learning-ads?learnerId=${learnerId}`).then(r=>r.items),
  ()=>learningAdsRepository.byLearner(learnerId)),

 ad:(adId:string)=>offlineFallback(
  ()=>api<{ad:LearningAd}>(`/learning-ads/${adId}`).then(r=>r.ad),
  ()=>learningAdsRepository.ad(adId)),

 applications:(adId:string)=>offlineFallback(
  ()=>api<{items:TutorApplication[]}>(`/learning-ads/${adId}/applications`).then(r=>r.items),
  ()=>learningAdsRepository.applications(adId)),

 byTutor:(tutorId:string)=>offlineFallback(
  ()=>api<{items:TutorApplication[]}>(`/learning-ads/applications?tutorId=${tutorId}`).then(r=>r.items),
  ()=>learningAdsRepository.byTutor(tutorId)),

 create:(input:AdInput)=>offlineFallback(
  ()=>api<{ad:LearningAd}>('/learning-ads',{method:'POST',body:JSON.stringify(input)}).then(r=>r.ad),
  ()=>learningAdsRepository.create(input)),

 close:(adId:string)=>offlineFallback(
  ()=>api<{ad:LearningAd}>(`/learning-ads/${adId}/close`,{method:'POST'}).then(r=>r.ad),
  ()=>learningAdsRepository.close(adId)),

 apply:(input:ApplyInput)=>offlineFallback(
  ()=>api<{application:TutorApplication}>(`/learning-ads/${input.adId}/applications`,{method:'POST',body:JSON.stringify(input)}).then(r=>r.application),
  ()=>learningAdsRepository.apply(input)),

 shortlist:(applicationId:string)=>offlineFallback(
  ()=>api<{application:TutorApplication}>(`/learning-ads/applications/${applicationId}`,{method:'PATCH',body:JSON.stringify({status:'SHORTLISTED'})}).then(r=>r.application),
  ()=>learningAdsRepository.setApplicationStatus(applicationId,'SHORTLISTED')),

 decline:(applicationId:string)=>offlineFallback(
  ()=>api<{application:TutorApplication}>(`/learning-ads/applications/${applicationId}`,{method:'PATCH',body:JSON.stringify({status:'DECLINED'})}).then(r=>r.application),
  ()=>learningAdsRepository.setApplicationStatus(applicationId,'DECLINED')),

 /** Books the session at the ad's rate and escrows it in one step. */
 accept:(applicationId:string)=>offlineFallback(
  ()=>api<{ad:LearningAd;application:TutorApplication;payment:SessionPayment}>(`/learning-ads/applications/${applicationId}/accept`,{method:'POST'}),
  ()=>learningAdsRepository.accept(applicationId)),
};
