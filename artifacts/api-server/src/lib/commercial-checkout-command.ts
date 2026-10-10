import crypto from "node:crypto";
import {bindPersistentCheckoutSession,createPersistentOrderCheckout,readPersistentCommercialAuthority,type CommercialQueryClient} from "./commercial-persistence";
import {createStripeCheckoutSession,createStripeTransport,inspectStripeCommercialConfiguration,type StripeTransport} from "./commercial-provider-adapter";
import {requireCommercialCheckoutReadiness} from "./commercial-checkout-readiness";
import type {CheckoutAttempt,CommercialOrder,ProviderCustomerBinding} from "./subscription-authority";

export const checkoutPlans=["professional","team","business"] as const;
export const checkoutCycles=["monthly","annual"] as const;
export type CheckoutPlan=typeof checkoutPlans[number]; export type CheckoutCycle=typeof checkoutCycles[number];
const amounts={"professional.monthly":14900,"professional.annual":149000,"team.monthly":24900,"team.annual":249000,"business.monthly":39900,"business.annual":399000} as const;
const cleanId=(prefix:string,value:string)=>`${prefix}-${crypto.createHash("sha256").update(value).digest("hex").slice(0,32)}`;

export function resolveCheckoutOffer(environment:NodeJS.ProcessEnv,plan:unknown,cycle:unknown){
  if(typeof plan!=="string"||!checkoutPlans.includes(plan as CheckoutPlan)||typeof cycle!=="string"||!checkoutCycles.includes(cycle as CheckoutCycle))throw new Error("A supported checkout plan and billing cycle are required");
  const slot=`${plan}.${cycle}` as keyof typeof amounts;
  const entries=new Map((environment.BIMLOG_STRIPE_PRICE_IDS??"").split(",").map(item=>item.trim()).filter(Boolean).map(item=>item.split("=",2).map(part=>part.trim()) as [string,string]));
  const priceReference=entries.get(slot)??""; if(!/^price_[A-Za-z0-9_]{6,}$/.test(priceReference))throw new Error("Selected checkout price is not configured");
  return Object.freeze({plan:plan as CheckoutPlan,cycle:cycle as CheckoutCycle,priceReference,subtotalCents:amounts[slot],currency:"USD" as const});
}

export async function startCommercialCheckout(input:{client:CommercialQueryClient;environment:NodeJS.ProcessEnv;companyId:number;userId:number;requestKey:string;plan:unknown;cycle:unknown;transport?:StripeTransport;now?:Date}){
  requireCommercialCheckoutReadiness(input.environment);
  const offer=resolveCheckoutOffer(input.environment,input.plan,input.cycle),authority=await readPersistentCommercialAuthority(input.client,input.companyId);
  if(!authority)throw new Error("Create the company subscription record before checkout");
  const subscription=authority.subscription,binding=authority.providerBindings.find(row=>row.provider==="stripe");
  if(!binding||subscription.plan_code!==offer.plan||subscription.billing_cycle!==offer.cycle)throw new Error("Checkout selection does not match the company subscription authority");
  const configured=inspectStripeCommercialConfiguration({secretKey:input.environment.STRIPE_SECRET_KEY,webhookSecret:input.environment.STRIPE_WEBHOOK_SECRET,portalConfigurationId:input.environment.STRIPE_PORTAL_CONFIGURATION_ID,appOrigin:input.environment.BIMLOG_APP_ORIGIN??"https://bimlog.app"});
  if(!configured.configuration)throw new Error("Secure payment service is not configured");
  const now=input.now??new Date(),expiresAt=new Date(now.getTime()+30*60_000).toISOString(),fingerprint=crypto.createHash("sha256").update(JSON.stringify({companyId:input.companyId,plan:offer.plan,cycle:offer.cycle})).digest("hex");
  const orderId=cleanId("order",`${input.companyId}:${input.requestKey}`),checkoutId=cleanId("checkout",`${input.companyId}:${input.requestKey}`),bindingId=String(binding.id),subscriptionId=String(subscription.id);
  const persisted=await createPersistentOrderCheckout(input.client,{companyId:input.companyId,userId:input.userId,subscriptionId,providerBindingId:bindingId,orderId,checkoutId,requestKey:input.requestKey,idempotencyKey:`stripe-${input.requestKey}`,fingerprint,currency:"USD",subtotalCents:offer.subtotalCents,taxCents:0,expiresAt});
  const order:CommercialOrder={id:persisted.orderId,companyId:input.companyId,subscriptionId,planId:offer.plan,catalogPriceVersion:1,billingCycle:offer.cycle,currency:"USD",subtotal:offer.subtotalCents/100,tax:0,total:offer.subtotalCents/100,status:"submitted",revision:2,expiresAt,createdAt:now.toISOString(),updatedAt:now.toISOString()};
  const attempt:CheckoutAttempt={id:persisted.checkoutId,orderId:order.id,orderRevision:order.revision,provider:"stripe",idempotencyKey:`stripe-${input.requestKey}`,amount:order.total!,currency:"USD",status:"created",providerReference:null,createdAt:now.toISOString(),updatedAt:now.toISOString()};
  const customer:ProviderCustomerBinding={id:bindingId,companyId:input.companyId,billingProfileRevision:1,provider:"stripe",providerCustomerReference:String(binding.customer_reference),status:"active",createdAt:now.toISOString()};
  const session=await createStripeCheckoutSession({configuration:configured.configuration,order,attempt,customer,priceReference:offer.priceReference,transport:input.transport??createStripeTransport()});
  await bindPersistentCheckoutSession(input.client,{companyId:input.companyId,checkoutId:persisted.checkoutId,providerBindingId:bindingId,providerSessionReference:session.providerSessionId,expiresAt:session.expiresAt});
  return Object.freeze({url:session.checkoutUrl,orderId:persisted.orderId,replayed:persisted.replayed});
}
