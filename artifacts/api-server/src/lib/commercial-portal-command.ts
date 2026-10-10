import crypto from "node:crypto";
import {readPersistentCommercialAuthority,type CommercialQueryClient} from "./commercial-persistence";
import {createStripeBillingPortalLaunch,createStripeTransport,inspectStripeCommercialConfiguration,type StripeTransport} from "./commercial-provider-adapter";
import {createBillingPortalSession,type ProviderCustomerBinding} from "./subscription-authority";
import {deriveCommercialPortalEligibility} from "./commercial-portal-eligibility";

export async function startCommercialBillingPortal(input:{client:CommercialQueryClient;environment:NodeJS.ProcessEnv;companyId:number;userId:number;transport?:StripeTransport;now?:Date}){
  const authority=await readPersistentCommercialAuthority(input.client,input.companyId),binding=authority?.providerBindings.find(row=>row.provider==="stripe");
  if(!authority)throw new Error("Company subscription is unavailable for billing self-service");
  const lifecycle=authority.subscription.status;
  if(typeof lifecycle!=="string"||!["pending","trialing","active","past_due","suspended","canceling","canceled"].includes(lifecycle))throw new Error("Company subscription lifecycle is invalid");
  const configured=inspectStripeCommercialConfiguration({secretKey:input.environment.STRIPE_SECRET_KEY,webhookSecret:input.environment.STRIPE_WEBHOOK_SECRET,portalConfigurationId:input.environment.STRIPE_PORTAL_CONFIGURATION_ID,appOrigin:input.environment.BIMLOG_APP_ORIGIN??"https://bimlog.app"});
  const eligibility=deriveCommercialPortalEligibility({lifecycle:lifecycle as "pending"|"trialing"|"active"|"past_due"|"suspended"|"canceling"|"canceled",canManageBilling:true,providerCustomerBound:Boolean(binding),portalConfigured:Boolean(configured.configuration?.portalConfigurationId)});
  if(!eligibility.ready||!binding||!configured.configuration||!configured.configuration.portalConfigurationId)throw new Error(`Billing self-service is unavailable: ${eligibility.blockers.join(",")}`);
  const now=input.now??new Date();
  const customer:ProviderCustomerBinding={id:String(binding.id),companyId:input.companyId,billingProfileRevision:1,provider:"stripe",providerCustomerReference:String(binding.customer_reference),status:"active",createdAt:now.toISOString()};
  const session=createBillingPortalSession({id:`portal-${crypto.randomUUID()}`,customer,requestedBy:String(input.userId),returnPath:"/settings/billing-support?billing=returned",now:now.toISOString()});
  const launch=await createStripeBillingPortalLaunch({configuration:configured.configuration,session,customer,transport:input.transport??createStripeTransport()});
  return Object.freeze({url:launch.portalUrl,expiresAt:session.expiresAt,purpose:eligibility.purpose});
}
