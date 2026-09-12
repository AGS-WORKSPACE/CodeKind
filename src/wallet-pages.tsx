import{useMemo,useState}from'react';
import{ArrowDownLeft,ArrowUpRight,Banknote,Landmark,Lock,Plus,RefreshCw,Wallet as WalletIcon}from'lucide-react';
import{DashboardShell}from'./components';
import{useToast}from'./ui-feedback';
import{useLoader,useOwner,type Owner,type WorkspaceRole}from'./hooks/use-payments';
import{walletService}from'./services/wallet.service';
import{CURRENCIES,CURRENCY_CODES,formatMoney,formatDateTime,toMinor}from'./lib/money';
import type{CurrencyCode,Wallet,WalletEntry}from'./types/payments';

const entryLabel:Record<WalletEntry['kind'],string>={
 TOPUP:'Top-up',WITHDRAWAL:'Withdrawal',HOLD:'Escrow held',RELEASE:'Escrow returned',CAPTURE:'Session charge',
 SESSION_EARNING:'Session earning',PLATFORM_FEE:'Platform fee',APPEAL_SETTLEMENT:'Appeal settlement',REFUND:'Refund',ADJUSTMENT:'Adjustment',
};

export function WalletPage({role}:{role:WorkspaceRole}){
 const owner=useOwner(role);
 const toast=useToast();
 const[dialog,setDialog]=useState<'TOPUP'|'WITHDRAW'|'ADD_CURRENCY'|null>(null);
 const[filter,setFilter]=useState<CurrencyCode|'ALL'>('ALL');

 const wallets=useLoader(()=>walletService.list(owner.ownerId),[owner.ownerId]);
 const entries=useLoader(()=>walletService.entries(owner.ownerId),[owner.ownerId]);
 const withdrawals=useLoader(()=>walletService.withdrawals(owner.ownerId),[owner.ownerId]);
 const refresh=()=>Promise.all([wallets.reload(),entries.reload(),withdrawals.reload()]);

 const held=wallets.data??[];
 const visible=useMemo(()=>filter==='ALL'?(entries.data??[]):(entries.data??[]).filter(e=>e.currency===filter),[entries.data,filter]);
 const missing=CURRENCY_CODES.filter(code=>!held.some(w=>w.currency===code));

 return <DashboardShell role={role}>
  <div className="dash-welcome">
   <div><h1>Wallet</h1><p>Your balances across every supported currency. Sessions are paid from the wallet that matches the session currency.</p></div>
   <div className="wallet-head-actions">
    <button className="btn" onClick={()=>setDialog('TOPUP')}><Plus size={16}/> Add money</button>
    <button className="btn ghost" onClick={()=>setDialog('WITHDRAW')}><Landmark size={16}/> Withdraw</button>
   </div>
  </div>

  {wallets.error&&<p className="ledger-error">{wallets.error}</p>}
  {wallets.loading&&!held.length?<p className="org-empty">Loading your wallets…</p>:<div className="wallet-grid">
   {held.map(item=><WalletCard key={item.id} wallet={item}/>)}
   {Boolean(missing.length)&&<button type="button" className="wallet-card add" onClick={()=>setDialog('ADD_CURRENCY')}>
    <Plus/><strong>Add a currency</strong><span>{missing.length} supported currencies you don’t hold yet</span>
   </button>}
  </div>}

  <div className="panel wallet-panel">
   <div className="panel-head">
    <h3>Wallet activity</h3>
    <label className="inline-select">Currency
     <select value={filter} onChange={event=>setFilter(event.target.value as CurrencyCode|'ALL')}>
      <option value="ALL">All currencies</option>
      {held.map(w=><option key={w.id} value={w.currency}>{w.currency}</option>)}
     </select>
    </label>
   </div>
   {entries.loading&&!visible.length?<p className="org-empty">Loading activity…</p>
    :!visible.length?<p className="org-empty">No wallet activity yet. Top up to book your first session.</p>
    :<table className="org-table ledger-table"><thead><tr><th>Activity</th><th>Type</th><th>Amount</th><th>Balance after</th><th>When</th></tr></thead><tbody>
     {visible.map(item=><tr key={item.id}>
      <td><strong>{item.description}</strong><span>{item.reference?`${item.reference.type.replace('_',' ').toLowerCase()} · ${item.reference.id}`:'—'}</span></td>
      <td><span className="org-tag">{entryLabel[item.kind]}</span></td>
      <td className={item.direction==='CREDIT'?'amount positive':'amount'}>{item.direction==='CREDIT'?'+':'−'}{formatMoney(item.amount,item.currency)}</td>
      <td>{formatMoney(item.balanceAfter,item.currency)}</td>
      <td>{formatDateTime(item.createdAt)}</td>
     </tr>)}
    </tbody></table>}
  </div>

  <div className="panel wallet-panel">
   <h3>Withdrawals</h3>
   {!withdrawals.data?.length?<p className="org-empty">No withdrawals requested yet.</p>
    :<table className="org-table"><thead><tr><th>Destination</th><th>Amount</th><th>Status</th><th>Requested</th></tr></thead><tbody>
     {withdrawals.data.map(item=><tr key={item.id}>
      <td><strong>{item.destination}</strong><span>{item.id}</span></td>
      <td className="amount">{formatMoney(item.amount,item.currency)}</td>
      <td><span className={`ledger-status ${item.status.toLowerCase()}`}>{item.status.toLowerCase()}</span></td>
      <td>{formatDateTime(item.createdAt)}</td>
     </tr>)}
    </tbody></table>}
  </div>

  {dialog==='TOPUP'&&<MoneyDialog
   title="Add money" confirmLabel="Add money" owner={owner} wallets={held} allowNewCurrency
   fieldLabel="Payment method" fieldPlaceholder="Visa ending 4242" defaultField="Visa ending 4242"
   onClose={()=>setDialog(null)}
   onSubmit={async(currency,amount,method)=>{await walletService.topUp(owner.ownerId,owner.ownerType,currency,amount,method);await refresh();toast(`Added ${formatMoney(amount,currency)}`)}}/>}

  {dialog==='WITHDRAW'&&<MoneyDialog
   title="Withdraw funds" confirmLabel="Request withdrawal" owner={owner} wallets={held}
   fieldLabel="Destination" fieldPlaceholder="Bank account ending 4872" defaultField="Bank account ending 4872"
   note="Escrow held against booked sessions cannot be withdrawn until those sessions settle."
   onClose={()=>setDialog(null)}
   onSubmit={async(currency,amount,destination)=>{await walletService.withdraw(owner.ownerId,currency,amount,destination);await refresh();toast('Withdrawal requested')}}/>}

  {dialog==='ADD_CURRENCY'&&<AddCurrencyDialog
   options={missing} onClose={()=>setDialog(null)}
   onSubmit={async currency=>{await walletService.addCurrency(owner.ownerId,owner.ownerType,currency);await refresh();toast(`${currency} wallet added`)}}/>}
 </DashboardShell>;
}

function WalletCard({wallet}:{wallet:Wallet}){
 const meta=CURRENCIES[wallet.currency];
 return <article className={wallet.isDefault?'wallet-card native':'wallet-card'}>
  <header><div className="wallet-symbol">{meta.symbol}</div><div><strong>{wallet.currency}</strong><span>{meta.name}</span></div>{wallet.isDefault&&<span className="org-tag owner">native</span>}</header>
  <h2>{formatMoney(wallet.available,wallet.currency)}</h2>
  <p className="wallet-reserved"><Lock size={13}/> {formatMoney(wallet.reserved,wallet.currency)} held in escrow</p>
  <footer>
   <span><ArrowDownLeft size={14}/> Receive</span>
   <span><ArrowUpRight size={14}/> Send</span>
   {/* Swap is a planned update; showing it disabled keeps the wallet honest about what it can do. */}
   <span className="disabled" title="Currency swap is coming in a later update"><RefreshCw size={14}/> Swap soon</span>
  </footer>
 </article>;
}

function MoneyDialog({title,confirmLabel,owner,wallets,fieldLabel,fieldPlaceholder,defaultField,note,allowNewCurrency=false,onClose,onSubmit}:{
 title:string;confirmLabel:string;owner:Owner;wallets:Wallet[];fieldLabel:string;fieldPlaceholder:string;defaultField:string;note?:string;allowNewCurrency?:boolean;
 onClose:()=>void;onSubmit:(currency:CurrencyCode,amount:number,field:string)=>Promise<void>;
}){
 const options=allowNewCurrency?CURRENCY_CODES:wallets.map(w=>w.currency);
 const[currency,setCurrency]=useState<CurrencyCode>(wallets.find(w=>w.isDefault)?.currency??options[0]??'USD');
 const[amount,setAmount]=useState('');
 const[field,setField]=useState(defaultField);
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);
 const selected=wallets.find(w=>w.currency===currency);

 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();
  const minor=toMinor(amount,currency);
  if(minor<=0){setError('Enter an amount greater than zero.');return}
  setBusy(true);
  try{await onSubmit(currency,minor,field.trim()||fieldPlaceholder);onClose()}
  catch(problem){setError(problem instanceof Error?problem.message:'That did not go through.')}
  finally{setBusy(false)}
 };

 return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
  <form className="modal wallet-modal" onMouseDown={event=>event.stopPropagation()} onSubmit={submit}>
   <h2>{title}</h2>
   <p>{owner.name} · {owner.ownerType==='ORG'?'organisation wallet':'personal wallet'}</p>
   <label>Currency
    <select value={currency} onChange={event=>setCurrency(event.target.value as CurrencyCode)}>
     {options.map(code=><option key={code} value={code}>{code} · {CURRENCIES[code].name}</option>)}
    </select>
   </label>
   <label>Amount
    <input inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value)} placeholder={`0${CURRENCIES[currency].exponent?'.00':''}`} autoFocus/>
   </label>
   {selected&&<small className="modal-hint">Available: {formatMoney(selected.available,currency)}{selected.reserved>0&&` · ${formatMoney(selected.reserved,currency)} in escrow`}</small>}
   <label>{fieldLabel}
    <input value={field} onChange={event=>setField(event.target.value)} placeholder={fieldPlaceholder}/>
   </label>
   {note&&<small className="modal-hint">{note}</small>}
   {error&&<p className="ledger-error">{error}</p>}
   <div><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy?'Working…':confirmLabel}</button></div>
  </form>
 </div>;
}

function AddCurrencyDialog({options,onClose,onSubmit}:{options:CurrencyCode[];onClose:()=>void;onSubmit:(currency:CurrencyCode)=>Promise<void>}){
 const[currency,setCurrency]=useState<CurrencyCode>(options[0]??'USD');
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);
 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();
  setBusy(true);
  try{await onSubmit(currency);onClose()}
  catch(problem){setError(problem instanceof Error?problem.message:'That did not go through.')}
  finally{setBusy(false)}
 };
 return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
  <form className="modal wallet-modal" onMouseDown={event=>event.stopPropagation()} onSubmit={submit}>
   <h2>Add a currency</h2>
   <p>An empty wallet is created. Top it up to pay for sessions priced in that currency.</p>
   <label>Currency
    <select value={currency} onChange={event=>setCurrency(event.target.value as CurrencyCode)}>
     {options.map(code=><option key={code} value={code}>{code} · {CURRENCIES[code].name}</option>)}
    </select>
   </label>
   {error&&<p className="ledger-error">{error}</p>}
   <div><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy?'Adding…':'Add wallet'}</button></div>
  </form>
 </div>;
}

/** Small balance strip reused on the dashboards and the booking checkout. */
export function WalletSummaryStrip({ownerId}:{ownerId:string}){
 const wallets=useLoader(()=>walletService.list(ownerId),[ownerId]);
 if(!wallets.data?.length)return null;
 return <div className="wallet-strip">
  <WalletIcon size={16}/>
  {wallets.data.map(item=><span key={item.id}><strong>{formatMoney(item.available,item.currency)}</strong> {item.currency}{item.reserved>0&&<i> · {formatMoney(item.reserved,item.currency)} held</i>}</span>)}
  <Banknote size={16} className="strip-end"/>
 </div>;
}
