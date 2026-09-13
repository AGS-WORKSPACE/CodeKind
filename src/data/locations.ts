/* Country and timezone choices for profile forms. Names and offsets come from the browser's Intl data,
   so only the ISO region codes live here. Values are English country names and IANA zone ids, the
   same shape SessionUser.country and SessionUser.timezone already use. */

const REGIONS='AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' ');

const regionNames=new Intl.DisplayNames(['en'],{type:'region'});
export const countries=REGIONS.map(code=>regionNames.of(code)??code).sort((a,b)=>a.localeCompare(b));

export const localTimezone=Intl.DateTimeFormat().resolvedOptions().timeZone;

/** "Africa/Lagos (GMT+1)". Falls back to the bare id for a zone this browser doesn't recognise. */
export const timezoneLabel=(zone:string)=>{
 try{const offset=new Intl.DateTimeFormat('en',{timeZone:zone,timeZoneName:'shortOffset'}).formatToParts().find(p=>p.type==='timeZoneName')?.value;return `${zone.replaceAll('_',' ')}${offset?` (${offset})`:''}`}
 catch{return zone}
};

// Built on first use: labelling every zone takes a few hundred formatters.
let zones:{value:string;label:string}[]|undefined;
export const timezones=()=>zones??=[...new Set(['UTC',...Intl.supportedValuesOf('timeZone')])].map(value=>({value,label:timezoneLabel(value)}));
