import crypto from "node:crypto";
import {readPersistentCommercialAuthority,type CommercialQueryClient} from "./commercial-persistence";
import {createStripeBillingPortalLaunch,createStripeTransport,inspectStripeCommercialConfiguration,type StripeTransport} from "./commercial-provider-adapter";
import {createBillingPortalSession,type ProviderCustomerBinding} from "./subscription-authority";

export async function startCommercialBillingPortal(input:{client:CommercialQueryClient;environment:NodeJS.ProcessEnv;companyId:number;userId:number;transport?:StripeTransport;now?:Date}){
  const authority=await readPersistentCommercialAuthority(input.client,input.companyId),binding=authority?.providerBindings.find(row=>row.provider==="stripe");
  if(!authority||!binding)throw new Error("Active company billing provider is unavailable");
  const configured=inspectStripeCommercialConfiguration({secretKey:input.environment.STRIPE_SECRET_KEY,webhookSecret:input.environment.STRIPE_WEBHOOK_SECRET,portalConfigurationId:input.environment.STRIPE_PORTAL_CONFIGURATION_ID,appOrigin:input.environment.BIMLOG_APP_ORIGIN??"https://bimlog.app"});
  if(!configured.configuration||!configured.configuration.portalConfigurationId)throw new Error("Billing self-service is not configured");
  const now=input.now??new Date();
  const customer:ProviderCustomerBinding={id:String(binding.id),companyId:input.companyId,billingProfileRevision:1,provider:"stripe",providerCustomerReference:String(binding.customer_reference),status:"active",createdAt:now.toISOString()};
  const session=createBillingPortalSession({id:`portal-${crypto.randomUUID()}`,customer,requestedBy:String(input.userId),returnPath:"/settings/billing-support",now:now.toISOString()});
  const launch=await createStripeBillingPortalLaunch({configuration:configured.configuration,session,customer,transport:input.transport??createStripeTransport()});
  return Object.freeze({url:launch.portalUrl,expiresAt:session.expiresAt});
}
