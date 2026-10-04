import crypto from "node:crypto";
import {persistSubscriptionSetup,readPersistentCommercialAuthority,type CommercialQueryClient} from "./commercial-persistence";
import {createStripeCustomer,createStripeTransport,inspectStripeCommercialConfiguration,type StripeTransport} from "./commercial-provider-adapter";
import {resolveCheckoutOffer} from "./commercial-checkout-command";

const seats={professional:1,team:5,business:15} as const;
const stable=(prefix:string,value:string)=>`${prefix}-${crypto.createHash("sha256").update(value).digest("hex").slice(0,32)}`;
export async function prepareCompanySubscription(input:{client:CommercialQueryClient;environment:NodeJS.ProcessEnv;companyId:number;userId:number;companyName:string;billingEmail:string;requestKey:string;plan:unknown;cycle:unknown;transport?:StripeTransport}){
  if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(input.requestKey))throw new Error("A valid subscription setup request identity is required");
  const offer=resolveCheckoutOffer(input.environment,input.plan,input.cycle),current=await readPersistentCommercialAuthority(input.client,input.companyId);
  if(current){const subscription=current.subscription,binding=current.providerBindings.find(row=>row.provider==="stripe"&&row.status==="active");if(subscription.plan_code!==offer.plan||subscription.billing_cycle!==offer.cycle||!binding)throw new Error("Company already has a different commercial subscription authority");return Object.freeze({subscriptionId:String(subscription.id),providerBindingId:String(binding.id),status:String(subscription.status),replayed:true});}
  const inspected=inspectStripeCommercialConfiguration({secretKey:input.environment.STRIPE_SECRET_KEY,webhookSecret:input.environment.STRIPE_WEBHOOK_SECRET,portalConfigurationId:input.environment.STRIPE_PORTAL_CONFIGURATION_ID,appOrigin:input.environment.BIMLOG_APP_ORIGIN??"https://bimlog.app"});
  if(!inspected.configuration)throw new Error("Secure payment service is not configured");
  const customer=await createStripeCustomer({configuration:inspected.configuration,companyId:input.companyId,companyName:input.companyName,billingEmail:input.billingEmail,idempotencyKey:stable("customer",`${input.companyId}:${input.requestKey}`),transport:input.transport??createStripeTransport()});
  const persisted=await persistSubscriptionSetup(input.client,{companyId:input.companyId,userId:input.userId,subscriptionId:stable("subscription",String(input.companyId)),bindingId:stable("binding",String(input.companyId)),planCode:offer.plan,billingCycle:offer.cycle,seatQuantity:seats[offer.plan],providerEnvironment:inspected.readiness.mode,providerCustomerReference:customer.providerCustomerReference});
  return Object.freeze({...persisted,status:"pending" as const});
}
