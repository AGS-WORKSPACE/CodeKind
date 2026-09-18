import{useEffect,useState}from'react';
import{Check,Coins,Search}from'lucide-react';
import{useToast}from'./ui-feedback';
import{useLoader}from'./hooks/use-payments';
import{adminPaymentsService,type PlatformSettings}from'./services/admin-payments.service';
import{adminUsersService,type AdminUser}from'./services/admin-users.service';
import{CURRENCIES,CURRENCY_CODES,bpsToPercent,formatMoney,percentToBps,toMinor}from'./lib/money';
import type{CurrencyCode}from'./types/payments';

/** The money settings every payment reads: the commission, how long money waits, and the limits. */
export function AdminMoneySettings(){
 const toast=useToast();
 const settings=useLoader(()=>adminPaymentsService.settings(),[]);
 const[draft,setDraft]=useState<PlatformSettings|null>(null);
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);
 useEffect(()=>{if(settings.data)setDraft(settings.data)},[settings.data]);

 const set=(key:string,value:number)=>setDraft(current=>current&&{...current,[key]:value});
 const save=async()=>{
  if(!draft)return;
  setBusy(true);setError(null);
  try{await adminPaymentsService.saveSettings(draft);await settings.reload();toast('Settings saved')}
  catch(problem){setError(problem instanceof Error?problem.message:'Those settings could not be saved.')}
  finally{setBusy(false)}
 };

 if(!draft)return <div className="admin-page"><p className="org-empty">{settings.error??'Loading settings…'}</p></div>;
 return <div className="admin-page">
  <header className="admin-page-head">
   <div><h1>Money settings</h1><p>These apply to every new session. A session keeps the commission it was booked at, so changing it never alters a deal already struck.</p></div>
  </header>

  <div className="admin-settings">
   <label>Platform commission (%)
    <input inputMode="decimal" value={bpsToPercent(draft.platform_fee_bps??0)}
     onChange={event=>set('platform_fee_bps',percentToBps(Number(event.target.value)||0))}/>
   </label>
   <label>Grace period before a tutor is paid (hours)
    <input inputMode="numeric" value={draft.grace_hours??24} onChange={event=>set('grace_hours',Number(event.target.value)||0)}/>
   </label>
   <label>Smallest top-up (minor units)
    <input inputMode="numeric" value={draft.min_topup_minor??0} onChange={event=>set('min_topup_minor',Number(event.target.value)||0)}/>
   </label>
   <label>Smallest withdrawal (minor units)
    <input inputMode="numeric" value={draft.min_withdrawal_minor??0} onChange={event=>set('min_withdrawal_minor',Number(event.target.value)||0)}/>
   </label>
   <p className="settings-warning">Amounts are in minor units: 100000 is ₦1,000.00 or $1,000.00. A learner has this long to appeal before the tutor is paid.</p>
   {error&&<p className="ledger-error">{error}</p>}
   <button className="btn" onClick={save} disabled={busy}>{busy?'Saving…':'Save settings'}</button>
  </div>
 </div>;
}

/** Credit someone's wallet from platform funds: a refund, a goodwill gesture or a promotion. */
export function AdminCredits(){
 const toast=useToast();
 const[query,setQuery]=useState('');
 const[chosen,setChosen]=useState<AdminUser|null>(null);
 const[currency,setCurrency]=useState<CurrencyCode>('NGN');
 const[amount,setAmount]=useState('');
 const[note,setNote]=useState('');
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);
 const people=useLoader(()=>query.trim().length<2?Promise.resolve([]):adminUsersService.search(query.trim()),[query]);

 const give=async(event:React.FormEvent)=>{
  event.preventDefault();
  if(!chosen){setError('Choose who the credit is for.');return}
  const minor=toMinor(amount,currency);
  if(minor<=0){setError('Enter an amount greater than zero.');return}
  if(!note.trim()){setError('Say what this credit is for — the person sees it on their statement.');return}
  setBusy(true);setError(null);
  try{
   const wallet=await adminPaymentsService.credit({ownerId:chosen.id,currency,amount:minor,note:note.trim()});
   toast(`${formatMoney(minor,currency)} credited · their balance is now ${formatMoney(wallet.available,currency)}`);
   setAmount('');setNote('');
  }catch(problem){setError(problem instanceof Error?problem.message:'That credit did not go through.')}
  finally{setBusy(false)}
 };

 return <div className="admin-page">
  <header className="admin-page-head">
   <div><h1>Wallet credits</h1><p>Money you add here comes from platform funds and lands in the person's wallet straight away. It needs the wallets.adjust permission.</p></div>
  </header>

  <form className="admin-settings" onSubmit={give}>
   <label className="credit-search">Who is it for?
    <span className="admin-table-tools"><Search size={15}/>
     <input value={query} onChange={event=>{setQuery(event.target.value);setChosen(null)}} placeholder="Search by name or email"/>
    </span>
   </label>
   <div className="credit-results">
    {chosen?<button type="button" className="credit-chosen" onClick={()=>setChosen(null)}><Check size={14}/> {chosen.name} · {chosen.email}</button>
     :people.loading?<span className="org-empty">Searching…</span>
     :(people.data??[]).map(person=><button type="button" key={person.id} onClick={()=>setChosen(person)}>{person.name}<small>{person.email}</small></button>)}
   </div>
   <label>Currency
    <select value={currency} onChange={event=>setCurrency(event.target.value as CurrencyCode)}>
     {CURRENCY_CODES.map(code=><option key={code} value={code}>{code} · {CURRENCIES[code].name}</option>)}
    </select>
   </label>
   <label>Amount
    <input inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value)} placeholder="0.00"/>
   </label>
   <label>What is it for?
    <input value={note} onChange={event=>setNote(event.target.value)} placeholder="Refund for the session on 12 May"/>
   </label>
   {error&&<p className="ledger-error">{error}</p>}
   <button className="btn" disabled={busy}><Coins size={15}/> {busy?'Crediting…':'Credit this wallet'}</button>
  </form>
 </div>;
}
