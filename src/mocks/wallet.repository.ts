import type{CurrencyCode,Wallet,WalletEntry,WalletOwnerType}from'../types/payments';
import{delay,ensureWallet,mutate,snapshot,topUp,withdraw}from'./payments.store';

/** Platform wallets are internal accounting, never part of anybody's wallet list. */
const ownWallets=(wallets:Wallet[],ownerId:string)=>wallets.filter(w=>w.ownerId===ownerId&&w.ownerType!=='PLATFORM');
const newestFirst=(a:WalletEntry,b:WalletEntry)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime();

export const walletRepository={
 list:async(ownerId:string)=>delay(ownWallets(snapshot().wallets,ownerId)),

 entries:async(ownerId:string,currency?:CurrencyCode)=>{
  const store=snapshot();
  const rows=store.entries.filter(e=>e.ownerId===ownerId&&(!currency||e.currency===currency));
  return delay(rows.sort(newestFirst));
 },

 withdrawals:async(ownerId:string)=>delay(snapshot().withdrawals.filter(w=>w.ownerId===ownerId).reverse()),

 /** Adding a currency the owner does not hold yet — the "other supported currencies" case. */
 addCurrency:async(ownerId:string,ownerType:WalletOwnerType,currency:CurrencyCode)=>
  delay(mutate(store=>ensureWallet(store,ownerId,ownerType,currency))),

 topUp:async(ownerId:string,ownerType:WalletOwnerType,currency:CurrencyCode,amount:number,method:string)=>
  delay(mutate(store=>topUp(store,ownerId,ownerType,currency,amount,method))),

 withdraw:async(ownerId:string,currency:CurrencyCode,amount:number,destination:string)=>
  delay(mutate(store=>withdraw(store,ownerId,currency,amount,destination))),
};
