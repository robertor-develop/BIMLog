import {inspectStripeCommercialConfiguration} from "./commercial-provider-adapter";

export const commercialPlatformServices=["subscription_catalog","payment_provider","payment_webhook","billing_portal","support_channel"] as const;
export type CommercialPlatformService=typeof commercialPlatformServices[number];
export type CommercialPlatformCheck=Readonly<{service:CommercialPlatformService;status:"ready"|"not_configured";code:string}>;

const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pricePattern=/^price_[A-Za-z0-9_]{6,}$/;
const sendgridPattern=/^SG\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/;
const check=(service:CommercialPlatformService,ready:boolean,code:string):CommercialPlatformCheck=>Object.freeze({service,status:ready?"ready":"not_configured",code});

export function inspectCommercialPlatformReadiness(environment:NodeJS.ProcessEnv){
  const prices=(environment.BIMLOG_STRIPE_PRICE_IDS??"").split(",").map(value=>value.trim()).filter(Boolean);
  const subscriptionConfigured=prices.length>0&&prices.every(value=>pricePattern.test(value))&&new Set(prices).size===prices.length;
  let paymentProviderConfigured=false;
  let webhookConfigured=false;
  let billingPortalConfigured=false;
  try{
    const stripe=inspectStripeCommercialConfiguration({secretKey:environment.STRIPE_SECRET_KEY,webhookSecret:environment.STRIPE_WEBHOOK_SECRET,portalConfigurationId:environment.STRIPE_PORTAL_CONFIGURATION_ID,appOrigin:environment.BIMLOG_APP_ORIGIN??"https://bimlog.app"}).readiness;
    paymentProviderConfigured=stripe.configured;
    webhookConfigured=stripe.configured&&stripe.webhookConfigured;
    billingPortalConfigured=stripe.configured&&stripe.portalConfigured;
  }catch{/* Invalid provider configuration remains unavailable. */}
  const supportConfigured=sendgridPattern.test((environment.SENDGRID_API_KEY??"").trim())&&emailPattern.test((environment.BIMLOG_SUPPORT_FROM_EMAIL??"").trim())&&emailPattern.test((environment.BIMLOG_SUPPORT_INBOX_EMAIL??"").trim());
  const checks=Object.freeze([
    check("subscription_catalog",subscriptionConfigured,subscriptionConfigured?"catalog_ready":"catalog_invalid"),
    check("payment_provider",paymentProviderConfigured,paymentProviderConfigured?"provider_ready":"provider_invalid"),
    check("payment_webhook",webhookConfigured,webhookConfigured?"webhook_ready":"webhook_invalid"),
    check("billing_portal",billingPortalConfigured,billingPortalConfigured?"portal_ready":"portal_invalid"),
    check("support_channel",supportConfigured,supportConfigured?"support_ready":"support_invalid"),
  ]);
  return Object.freeze({subscriptionConfigured,paymentProviderConfigured,webhookConfigured,billingPortalConfigured,supportConfigured,checks});
}
