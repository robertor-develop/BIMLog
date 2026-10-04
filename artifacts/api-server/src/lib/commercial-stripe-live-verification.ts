import type {CommercialVerificationTransport} from "./commercial-launch-verification-transport";
import {commercialBillingCycles,commercialPaidOffers,type CommercialCatalogSlot} from "./commercial-platform-readiness";

export type CommercialLiveCheck=Readonly<{id:string;status:"verified"|"failed";code:string}>;
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==="object"?value as Record<string,unknown>:{};
const catalog=(value:string|undefined)=>new Map((value??"").split(",").map(item=>item.trim()).filter(Boolean).map(item=>item.split("=",2).map(part=>part.trim()) as [string,string]));

export async function verifyStripeAccountAndCatalog(environment:NodeJS.ProcessEnv,transport:CommercialVerificationTransport):Promise<readonly CommercialLiveCheck[]>{
  const key=(environment.STRIPE_SECRET_KEY??"").trim(),mode=environment.BIMLOG_COMMERCIAL_MODE?.trim(),checks:CommercialLiveCheck[]=[];
  if(!/^sk_(test|live)_[A-Za-z0-9_]{12,}$/.test(key)||!(["test","live"] as const).includes(mode as "test"|"live"))return Object.freeze([{id:"stripe_account",status:"failed",code:"provider_configuration_invalid"}]);
  const expectedLive=mode==="live",accountResponse=await transport({provider:"stripe",path:"/v1/account",authorization:`Bearer ${key}`}),account=object(accountResponse.body);
  const accountVerified=accountResponse.status===200&&account.object==="account"&&account.charges_enabled===true&&Boolean(account.livemode)===expectedLive;
  checks.push(Object.freeze({id:"stripe_account",status:accountVerified?"verified":"failed",code:accountVerified?"stripe_account_verified":"stripe_account_unusable"}));
  const prices=catalog(environment.BIMLOG_STRIPE_PRICE_IDS),slots=commercialPaidOffers.flatMap(plan=>commercialBillingCycles.map(cycle=>`${plan}.${cycle}` as CommercialCatalogSlot));
  for(const slot of slots){const priceId=prices.get(slot)??"",cycle=slot.endsWith(".monthly")?"month":"year";if(!/^price_[A-Za-z0-9_]{6,}$/.test(priceId)){checks.push(Object.freeze({id:`price:${slot}`,status:"failed",code:"price_reference_invalid"}));continue;}
    const response=await transport({provider:"stripe",path:`/v1/prices/${encodeURIComponent(priceId)}`,authorization:`Bearer ${key}`}),price=object(response.body),recurring=object(price.recurring);
    const verified=response.status===200&&price.object==="price"&&price.active===true&&price.type==="recurring"&&price.livemode===expectedLive&&typeof price.currency==="string"&&price.currency.toLowerCase()==="usd"&&recurring.interval===cycle;
    checks.push(Object.freeze({id:`price:${slot}`,status:verified?"verified":"failed",code:verified?"price_verified":"price_unusable"}));
  }
  return Object.freeze(checks);
}
