import{api,offlineFallback}from'./api';
import{walletRepository}from'../mocks/wallet.repository';
import type{CurrencyCode,TopUp,Wallet,WalletEntry,WalletOwnerType,Withdrawal}from'../types/payments';

export const walletService={
 list:(ownerId:string)=>offlineFallback(
  ()=>api<{wallets:Wallet[]}>(`/wallets?ownerId=${ownerId}`).then(r=>r.wallets),
  ()=>walletRepository.list(ownerId)),

 entries:(ownerId:string,currency?:CurrencyCode)=>offlineFallback(
  ()=>api<{entries:WalletEntry[]}>(`/wallets/entries?ownerId=${ownerId}${currency?`&currency=${currency}`:''}`).then(r=>r.entries),
  ()=>walletRepository.entries(ownerId,currency)),

 withdrawals:(ownerId:string)=>offlineFallback(
  ()=>api<{withdrawals:Withdrawal[]}>(`/wallets/withdrawals?ownerId=${ownerId}`).then(r=>r.withdrawals),
  ()=>walletRepository.withdrawals(ownerId)),

 addCurrency:(ownerId:string,ownerType:WalletOwnerType,currency:CurrencyCode)=>offlineFallback(
  ()=>api<{wallet:Wallet}>('/wallets',{method:'POST',body:JSON.stringify({ownerId,ownerType,currency})}).then(r=>r.wallet),
  ()=>walletRepository.addCurrency(ownerId,ownerType,currency)),

 topUp:(ownerId:string,ownerType:WalletOwnerType,currency:CurrencyCode,amount:number,method:string)=>offlineFallback(
  ()=>api<{topUp:TopUp}>('/wallets/top-ups',{method:'POST',body:JSON.stringify({ownerId,currency,amount,method})}).then(r=>r.topUp),
  ()=>walletRepository.topUp(ownerId,ownerType,currency,amount,method)),

 withdraw:(ownerId:string,currency:CurrencyCode,amount:number,destination:string)=>offlineFallback(
  ()=>api<{withdrawal:Withdrawal}>('/wallets/withdrawals',{method:'POST',body:JSON.stringify({ownerId,currency,amount,destination})}).then(r=>r.withdrawal),
  ()=>walletRepository.withdraw(ownerId,currency,amount,destination)),
};
