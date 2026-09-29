export const CONVERSION_EVENTS=["pricing_viewed","offer_selected","contact_started","contact_submitted","registration_started","registration_completed"] as const;
export type ConversionEvent=typeof CONVERSION_EVENTS[number];
export type FunnelCounts=Record<ConversionEvent,number>;
const KEY="bimlog.conversion-baseline.v1";
export const FUNNEL_DEFINITIONS={pricing_viewed:"Pricing page loaded",offer_selected:"A plan action was selected",contact_started:"Sales-assisted form loaded with valid plan intent",contact_submitted:"Contact API accepted the inquiry",registration_started:"Self-service registration loaded with valid plan intent",registration_completed:"Account API created the account"} as const;
export function emptyFunnel():FunnelCounts{return Object.fromEntries(CONVERSION_EVENTS.map(key=>[key,0])) as FunnelCounts;}
export function readFunnel(storage:Pick<Storage,"getItem">=localStorage):FunnelCounts{try{const value=JSON.parse(storage.getItem(KEY)??"{}");return Object.fromEntries(CONVERSION_EVENTS.map(key=>[key,Number.isSafeInteger(value[key])&&value[key]>=0?value[key]:0])) as FunnelCounts;}catch{return emptyFunnel();}}
export function recordConversionEvent(event:ConversionEvent,storage:Pick<Storage,"getItem"|"setItem">=localStorage){const next=readFunnel(storage);next[event]+=1;storage.setItem(KEY,JSON.stringify(next));if(typeof window!=="undefined")window.dispatchEvent(new Event("bimlog:conversion-baseline"));return next;}
export const FUNNEL_PRIVACY="This browser-local baseline stores event-name counts only. It sends no names, email addresses, company identities, free text, document contents, project data, credentials, tokens, URLs or device identifiers.";
