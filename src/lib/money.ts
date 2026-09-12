import type{CurrencyCode,Money}from'../types/payments';

/**
 * Every amount in the payment system is an integer in minor units. Floats are never used for money:
 * 0.1 + 0.2 is not 0.3, and a ledger that drifts by a cent per session is worse than useless.
 */
type CurrencyMeta={code:CurrencyCode;symbol:string;name:string;exponent:number};

export const CURRENCIES:Record<CurrencyCode,CurrencyMeta>={
 USD:{code:'USD',symbol:'$',name:'US Dollar',exponent:2},
 NGN:{code:'NGN',symbol:'₦',name:'Nigerian Naira',exponent:2},
 GBP:{code:'GBP',symbol:'£',name:'Pound Sterling',exponent:2},
 EUR:{code:'EUR',symbol:'€',name:'Euro',exponent:2},
 KES:{code:'KES',symbol:'KSh',name:'Kenyan Shilling',exponent:2},
 GHS:{code:'GHS',symbol:'₵',name:'Ghanaian Cedi',exponent:2},
 ZAR:{code:'ZAR',symbol:'R',name:'South African Rand',exponent:2},
 INR:{code:'INR',symbol:'₹',name:'Indian Rupee',exponent:2},
 CAD:{code:'CAD',symbol:'CA$',name:'Canadian Dollar',exponent:2},
 JPY:{code:'JPY',symbol:'¥',name:'Japanese Yen',exponent:0},
};

export const CURRENCY_CODES=Object.keys(CURRENCIES) as CurrencyCode[];
export const isCurrency=(value:string):value is CurrencyCode=>value in CURRENCIES;
const factor=(currency:CurrencyCode)=>10**CURRENCIES[currency].exponent;

/** "12.50" or 12.5 in a form field → 1250 minor units. */
export const toMinor=(major:number|string,currency:CurrencyCode)=>{
 const value=typeof major==='string'?Number(major.replace(/[^0-9.-]/g,'')):major;
 if(!Number.isFinite(value))return 0;
 return Math.round(value*factor(currency));
};

export const toMajor=(minor:number,currency:CurrencyCode)=>minor/factor(currency);

export const formatMoney=(minor:number,currency:CurrencyCode)=>{
 const{exponent,symbol}=CURRENCIES[currency];
 const sign=minor<0?'-':'';
 const body=Math.abs(toMajor(minor,currency)).toLocaleString('en-US',{minimumFractionDigits:exponent,maximumFractionDigits:exponent});
 return `${sign}${symbol}${body}`;
};

/** With the code appended, for screens that mix currencies in one list. */
export const formatMoneyFull=(minor:number,currency:CurrencyCode)=>`${formatMoney(minor,currency)} ${currency}`;

export const money=(amount:number,currency:CurrencyCode):Money=>({amount,currency});

/** The per-minute figure the pricing UI shows, e.g. $10/h → $0.17/min displayed from 16.67 minor. */
export const perMinuteRate=(hourlyRate:number)=>hourlyRate/60;

/**
 * What `minutes` of teaching costs at `hourlyRate` per hour, rounded up to the minor unit so the
 * platform never under-charges by a fraction it cannot represent.
 */
export const prorate=(hourlyRate:number,minutes:number)=>Math.ceil(hourlyRate*minutes/60);

/**
 * Attended time converted to billable minutes: rounded up to the whole minute, then capped at the
 * scheduled duration. The cap is what guarantees a capture never exceeds the escrow held at booking.
 */
export const billableMinutes=(attendedSeconds:number,scheduledMinutes:number)=>
 Math.max(0,Math.min(Math.ceil(Math.max(0,attendedSeconds)/60),scheduledMinutes));

/** Commission is stored in basis points so a 12.5% rate needs no float in the ledger. */
export const percentToBps=(percent:number)=>Math.round(percent*100);
export const bpsToPercent=(bps:number)=>bps/100;

export const splitFee=(gross:number,platformFeeBps:number)=>{
 const platformFee=Math.round(gross*platformFeeBps/10000);
 return{gross,platformFee,net:gross-platformFee};
};

export const assertSameCurrency=(a:CurrencyCode,b:CurrencyCode)=>{
 if(a!==b)throw new Error(`Currency mismatch: ${a} cannot move against ${b}. Swap is not available yet.`);
};

const HOUR=60*60*1000;
export const GRACE_PERIOD_HOURS=24;

export const graceDeadline=(from:string|Date)=>new Date(new Date(from).getTime()+GRACE_PERIOD_HOURS*HOUR).toISOString();

/** "in 14 hours" / "3 hours ago" — used on every ledger row to show where the grace period stands. */
export const relativeTime=(iso:string,now=Date.now())=>{
 const diff=new Date(iso).getTime()-now;
 const minutes=Math.round(Math.abs(diff)/60000);
 const text=minutes<1?'less than a minute':minutes<60?`${minutes} minute${minutes===1?'':'s'}`
  :minutes<60*24?`${Math.round(minutes/60)} hour${Math.round(minutes/60)===1?'':'s'}`
  :`${Math.round(minutes/(60*24))} day${Math.round(minutes/(60*24))===1?'':'s'}`;
 return diff>=0?`in ${text}`:`${text} ago`;
};

export const formatDateTime=(iso:string)=>new Date(iso).toLocaleString('en',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
