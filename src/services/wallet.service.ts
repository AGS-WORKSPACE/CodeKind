import{api}from'./api';
import type{Bank,CurrencyCode,PaymentMethods,TopUp,Wallet,WalletEntry,Withdrawal,WithdrawalDestination}from'../types/payments';

/* Money has no offline fallback on purpose: a balance the backend did not send is not a balance.
   Every screen here shows the error instead. */
export const walletService={
 list:()=>api<{wallets:Wallet[]}>('/wallets').then(r=>r.wallets),

 entries:(currency?:CurrencyCode)=>api<{entries:WalletEntry[]}>(`/wallets/entries${currency?`?currency=${currency}`:''}`).then(r=>r.entries),

 addCurrency:(currency:CurrencyCode)=>api<{wallet:Wallet}>('/wallets',{method:'POST',body:JSON.stringify({currency})}).then(r=>r.wallet),

 /** Starts a top-up. The wallet is credited only once the provider confirms the payment. */
 topUp:(currency:CurrencyCode,amount:number)=>api<{topUp:TopUp;paymentUrl:string}>('/wallets/top-ups',{method:'POST',body:JSON.stringify({currency,amount})}),
 topUps:()=>api<{topUps:TopUp[]}>('/wallets/top-ups').then(r=>r.topUps),

 withdraw:(currency:CurrencyCode,amount:number,destination:WithdrawalDestination)=>
  api<{withdrawal:Withdrawal}>('/wallets/withdrawals',{method:'POST',body:JSON.stringify({currency,amount,destination})}).then(r=>r.withdrawal),
 withdrawals:()=>api<{withdrawals:Withdrawal[]}>('/wallets/withdrawals').then(r=>r.withdrawals),

 /** Which currencies money can actually move in, and who moves it. */
 methods:(currency?:CurrencyCode)=>api<PaymentMethods>(`/payments/methods${currency?`?currency=${currency}`:''}`),
 banks:(currency:CurrencyCode,country='NG')=>api<{banks:Bank[]}>(`/payments/banks?currency=${currency}&country=${country}`).then(r=>r.banks),
};
