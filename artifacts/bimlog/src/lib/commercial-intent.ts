import { COMMERCIAL_OFFERS, type BillingCycle } from "./commercial-offers";
export type CommercialIntent={plan:string;billing:BillingCycle;useCase:string};
const ids=new Set([...COMMERCIAL_OFFERS.map(x=>x.id),"founding"]);
export function parseCommercialIntent(search:string):CommercialIntent|null{const p=new URLSearchParams(search.startsWith("?")?search.slice(1):search);const plan=p.get("plan")??"";const billing=p.get("billing");if(!ids.has(plan)||(billing!=="monthly"&&billing!=="annual"))return null;return{plan,billing,useCase:(p.get("useCase")??"").trim().slice(0,120)};}
export function intentLabel(value:CommercialIntent){const offer=COMMERCIAL_OFFERS.find(x=>x.id===value.plan);return value.plan==="founding"?"Founding Partner program":`${offer?.name??value.plan} plan (${value.billing})`;}
export function rememberCommercialIntent(value:CommercialIntent|null,storage:Pick<Storage,"setItem">=sessionStorage){if(value)storage.setItem("bimlog.commercial-intent.v1",JSON.stringify(value));}
