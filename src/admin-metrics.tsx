import{useState}from'react';
import{useLoader}from'./hooks/use-payments';
import{metricsService}from'./services/metrics.service';
import type{MetricsCohort,MetricsMonth,MetricsSupply}from'./services/metrics.service';
import{CURRENCIES,formatMoney,toMajor}from'./lib/money';
import type{CurrencyCode}from'./types/payments';

/* The colours the charts speak in: earnings, commission, and a third for a count series. They are
   checked for colour-blind separation, so they are not swapped for taste. */
const EARNINGS='#2e8763',FEE='#e08a2c',PEOPLE='#4a6ee0';
const INK='#17382e',MUTED='#71827b',GRID='#dce6e1';

const pct=(bps:number)=>`${(bps/100).toFixed(1)}%`;
/** Axis labels need the size, not the cents: $12.4k reads where $12,350.00 does not. */
const compactMoney=(minor:number,currency:CurrencyCode)=>
 `${CURRENCIES[currency].symbol}${toMajor(minor,currency).toLocaleString('en-US',{notation:'compact',maximumFractionDigits:1})}`;
const month=(value:string)=>new Date(`${value}-01T00:00:00Z`).toLocaleDateString('en-GB',{month:'short',timeZone:'UTC'});

/**
 * What a marketplace is asked to prove: money flowing through it, the share it keeps, whether
 * tutors reach a first lesson, and whether learners come back. Every number is from the live
 * tables, so a small platform shows small numbers rather than flattering ones.
 */
export function AdminMetrics(){
 const[months,setMonths]=useState(12);
 const metrics=useLoader(()=>metricsService.overview(months),[months]);
 const data=metrics.data;
 const currency=(data?.currency??'USD') as CurrencyCode;
 const totals=data?.totals;

 return <div className="admin-page metrics-page">
  <header className="admin-page-head">
   <div><h1>Business metrics</h1><p>What the platform earned, how tutors get to their first lesson, and whether learners return. Read from live data{data?.currencies&&data.currencies.length>1?`; money shown in ${currency}, the busiest currency`:''}.</p></div>
   <label className="inline-select">Period
    <select value={months} onChange={event=>setMonths(Number(event.target.value))}>
     {[6,12,24].map(value=><option key={value} value={value}>Last {value} months</option>)}
    </select>
   </label>
  </header>

  {metrics.error&&<p className="ledger-error">{metrics.error}</p>}

  <div className="admin-metrics">
   <article><p>Gross booked</p><h3>{formatMoney(totals?.gmv??0,currency)}</h3><span>all sessions ever booked</span></article>
   <article><p>Platform revenue</p><h3>{formatMoney(totals?.netRevenue??0,currency)}</h3><span>a {pct(totals?.takeRateBps??0)} take rate</span></article>
   <article><p>Sessions</p><h3>{totals?.sessions??0}</h3><span>{totals?.completed??0} taught · {pct(totals?.cancelRateBps??0)} cancelled</span></article>
   <article><p>Learners who returned</p><h3>{pct(totals?.repeatRateBps??0)}</h3><span>{totals?.repeatLearners??0} of {totals?.learners??0} booked twice</span></article>
  </div>

  <div className="metrics-grid">
   <section className="panel metrics-panel">
    <header><h2>Money each month</h2><p>The bar is everything learners paid for sessions that month; the top slice is the commission the platform keeps.</p></header>
    <MoneyChart series={data?.series??[]} currency={currency}/>
   </section>

   <section className="panel metrics-panel">
    <header><h2>Who was active</h2><p>A marketplace lives or dies on both sides showing up in the same month.</p></header>
    <ActivityChart series={data?.series??[]}/>
   </section>
  </div>

  <div className="metrics-grid">
   <section className="panel metrics-panel">
    <header><h2>Tutor supply</h2><p>From a started profile to a first lesson taught. The drop between two steps is where supply is lost.</p></header>
    {data&&<Funnel supply={data.supply}/>}
   </section>

   <section className="panel metrics-panel">
    <header><h2>Learners who came back</h2><p>Each row is the group whose first lesson fell in that month, and how many of them booked again later.</p></header>
    <Cohorts rows={data?.cohorts??[]}/>
   </section>
  </div>

  {metrics.loading&&!data&&<p className="org-empty">Working out the numbers…</p>}
 </div>;
}

/** Stacked bars: what tutors earned and what the platform kept add up to what learners paid. */
function MoneyChart({series,currency}:{series:MetricsMonth[];currency:CurrencyCode}){
 const[hover,setHover]=useState<number|null>(null);
 if(!series.length)return <p className="org-empty">No sessions yet.</p>;
 const width=720,height=240,pad={top:16,right:16,bottom:28,left:64};
 const peak=Math.max(...series.map(m=>m.gmv),1);
 const plot={w:width-pad.left-pad.right,h:height-pad.top-pad.bottom};
 const step=plot.w/series.length,bar=Math.min(38,step*0.6);
 const y=(value:number)=>pad.top+plot.h-(value/peak)*plot.h;
 const point=series[hover??-1];

 return <figure className="chart">
  <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gross booked value each month, with the platform commission on top">
   <Axis peak={peak} pad={pad} plot={plot} width={width} format={value=>compactMoney(value,currency)}/>
   {series.map((m,index)=>{
    const x=pad.left+index*step+(step-bar)/2;
    const fee=(m.netRevenue/peak)*plot.h,all=(m.gmv/peak)*plot.h,earned=Math.max(all-fee,0);
    return <g key={m.month} onMouseEnter={()=>setHover(index)} onMouseLeave={()=>setHover(null)}>
     <rect x={x-4} y={pad.top} width={bar+8} height={plot.h} fill="transparent"/>
     {earned>0&&<rect x={x} y={y(m.gmv)+fee+2} width={bar} height={Math.max(earned-2,0)} rx="4" fill={EARNINGS}/>}
     {fee>0&&<rect x={x} y={y(m.gmv)} width={bar} height={fee} rx="4" fill={FEE}/>}
    </g>;
   })}
   {series.map((m,index)=><text key={m.month} className="chart-tick" x={pad.left+index*step+step/2} y={height-8} textAnchor="middle" fill={MUTED}>{month(m.month)}</text>)}
  </svg>
  <Legend items={[['Earned by tutors',EARNINGS],['Platform commission',FEE]]}/>
  <figcaption className="chart-readout">{point
   ?<><strong>{month(point.month)}</strong> {formatMoney(point.gmv,currency)} booked · {formatMoney(point.netRevenue,currency)} commission · {point.sessions} sessions</>
   :<>Point at a month to read its numbers.</>}</figcaption>
 </figure>;
}

/** Counts, so sessions and people share one scale honestly. */
function ActivityChart({series}:{series:MetricsMonth[]}){
 const[hover,setHover]=useState<number|null>(null);
 if(!series.length)return <p className="org-empty">No activity yet.</p>;
 const width=720,height=240,pad={top:16,right:16,bottom:28,left:44};
 const lines=[{key:'sessions',label:'Sessions',colour:EARNINGS},{key:'activeLearners',label:'Learners who booked',colour:PEOPLE},{key:'activeTutors',label:'Tutors who taught',colour:FEE}] as const;
 const peak=Math.max(...series.flatMap(m=>lines.map(l=>m[l.key])),1);
 const plot={w:width-pad.left-pad.right,h:height-pad.top-pad.bottom};
 const step=series.length>1?plot.w/(series.length-1):0;
 const x=(index:number)=>pad.left+index*step;
 const y=(value:number)=>pad.top+plot.h-(value/peak)*plot.h;
 const point=series[hover??-1];

 return <figure className="chart">
  <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sessions, active learners and active tutors each month"
    onMouseLeave={()=>setHover(null)}>
   <Axis peak={peak} pad={pad} plot={plot} width={width} format={value=>String(Math.round(value))}/>
   {hover!==null&&<line className="chart-crosshair" x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top+plot.h} stroke={GRID}/>}
   {lines.map(line=><polyline key={line.key} fill="none" stroke={line.colour} strokeWidth="2" strokeLinejoin="round"
     points={series.map((m,index)=>`${x(index)},${y(m[line.key])}`).join(' ')}/>)}
   {hover!==null&&lines.map(line=><circle key={line.key} cx={x(hover)} cy={y(series[hover]![line.key])} r="4.5" fill={line.colour} stroke="#fff" strokeWidth="2"/>)}
   {series.map((m,index)=><rect key={m.month} x={x(index)-step/2} y={pad.top} width={Math.max(step,24)} height={plot.h} fill="transparent" onMouseEnter={()=>setHover(index)}/>)}
   {series.map((m,index)=><text key={m.month} className="chart-tick" x={x(index)} y={height-8} textAnchor="middle" fill={MUTED}>{month(m.month)}</text>)}
  </svg>
  <Legend items={lines.map(l=>[l.label,l.colour] as [string,string])}/>
  <figcaption className="chart-readout">{point
   ?<><strong>{month(point.month)}</strong> {point.sessions} sessions · {point.activeLearners} learners · {point.activeTutors} tutors</>
   :<>Point at a month to read its numbers.</>}</figcaption>
 </figure>;
}

/** The tutor funnel as plain bars, with the share that survives each step written beside it. */
function Funnel({supply}:{supply:MetricsSupply}){
 const steps:[string,number,string][]=[
  ['Profiles started',supply.profiles,'signed up as a tutor'],
  ['Sent for review',supply.profiles-supply.draft,'finished the application'],
  ['Approved',supply.approved,'listed and bookable'],
  ['Taught a lesson',supply.activated,'the only step that earns'],
 ];
 const peak=Math.max(steps[0]![1],1);

 return <div className="funnel">
  {steps.map(([label,value,note],index)=><div className="funnel-step" key={label}>
   <div className="funnel-label"><strong>{label}</strong><span>{note}</span></div>
   <div className="funnel-track"><div className="funnel-bar" style={{width:`${(value/peak)*100}%`,background:index===steps.length-1?FEE:EARNINGS}}/></div>
   <div className="funnel-value"><strong>{value}</strong><span>{index===0?'start':`${Math.round((value/Math.max(steps[index-1]![1],1))*100)}% of step above`}</span></div>
  </div>)}
  <p className="funnel-note">
   {supply.daysToApproval>0?<>Review takes <strong>{supply.daysToApproval.toFixed(1)} days</strong> for the middle tutor. </>:null}
   {supply.daysToFirstLesson>0?<>From approval to a first lesson is <strong>{supply.daysToFirstLesson.toFixed(0)} days</strong>.</>:<>No approved tutor has taught a first lesson yet.</>}
   {supply.submitted>0&&<> {supply.submitted} {supply.submitted===1?'profile is':'profiles are'} waiting for a decision.</>}
  </p>
 </div>;
}

/** Retention by the month of a learner's first lesson; the shade carries the same number as the text. */
function Cohorts({rows}:{rows:MetricsCohort[]}){
 if(!rows.length)return <p className="org-empty">No lessons have been taught yet.</p>;
 const cell=(kept:number,size:number)=>{
  const share=size?kept/size:0;
  return <td style={{background:share?`color-mix(in oklab, ${EARNINGS} ${Math.round(20+share*65)}%, #ffffff)`:'transparent',color:share>0.55?'#fff':INK}}>
   {size?`${Math.round(share*100)}%`:'—'}<span>{kept}</span>
  </td>;
 };
 return <table className="org-table cohort-table">
  <thead><tr><th>First lesson</th><th>Learners</th><th>Month +1</th><th>Month +2</th><th>Month +3</th></tr></thead>
  <tbody>{rows.map(row=><tr key={row.month}>
   <td><strong>{row.month}</strong></td><td>{row.learners}</td>
   {cell(row.m1,row.learners)}{cell(row.m2,row.learners)}{cell(row.m3,row.learners)}
  </tr>)}</tbody>
 </table>;
}

/** A recessive grid with three labelled lines: enough to read a value, quiet enough to ignore. */
function Axis({peak,pad,plot,width,format}:{peak:number;pad:{top:number;right:number;left:number};plot:{w:number;h:number};width:number;format:(value:number)=>string}){
 return <g>{[0,0.5,1].map(share=>{
  const value=peak*share,y=pad.top+plot.h-share*plot.h;
  return <g key={share}>
   <line x1={pad.left} x2={width-pad.right} y1={y} y2={y} stroke={GRID} strokeWidth="1"/>
   <text className="chart-tick" x={pad.left-8} y={y+4} textAnchor="end" fill={MUTED}>{format(value)}</text>
  </g>;
 })}</g>;
}

function Legend({items}:{items:[string,string][]}){
 return <ul className="chart-legend">{items.map(([label,colour])=><li key={label}><i style={{background:colour}}/>{label}</li>)}</ul>;
}
