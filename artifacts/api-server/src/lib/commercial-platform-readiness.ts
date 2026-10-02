import {inspectStripeCommercialConfiguration} from "./commercial-provider-adapter";

export const commercialPlatformServices=["subscription_catalog","payment_provider","payment_webhook","billing_portal","support_channel"] as const;
export type CommercialPlatformService=typeof commercialPlatformServices[number];
export type CommercialPlatformCheck=Readonly<{service:CommercialPlatformService;status:"ready"|"not_configured";code:string}>;

const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pricePattern=/^price_[A-Za-z0-9_]{6,}$/;
export const commercialPaidOffers=["professional","team","business"] as const;
export const commercialBillingCycles=["monthly","annual"] as const;
export type CommercialCatalogSlot=`${typeof commercialPaidOffers[number]}.${typeof commercialBillingCycles[number]}`;
export type CommercialCatalogCoverage=Readonly<{slot:CommercialCatalogSlot;configured:boolean}>;
const sendgridPattern=/^SG\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/;
const check=(service:CommercialPlatformService,ready:boolean,code:string):CommercialPlatformCheck=>Object.freeze({service,status:ready?"ready":"not_configured",code});

export function inspectCommercialPlatformReadiness(environment:NodeJS.ProcessEnv){
  const requiredSlots=commercialPaidOffers.flatMap(plan=>commercialBillingCycles.map(cycle=>`${plan}.${cycle}` as CommercialCatalogSlot));
  const entries=(environment.BIMLOG_STRIPE_PRICE_IDS??"").split(",").map(value=>value.trim()).filter(Boolean).map(value=>value.split("=",2).map(part=>part.trim()) as [string,string]);
  const mapped=new Map(entries);
  const catalogCoverage=Object.freeze(requiredSlots.map(slot=>Object.freeze({slot,configured:pricePattern.test(mapped.get(slot)??"")})));
  const prices=entries.map(([,price])=>price);
  const subscriptionConfigured=entries.length===requiredSlots.length&&mapped.size===requiredSlots.length&&requiredSlots.every(slot=>mapped.has(slot))&&prices.every(value=>pricePattern.test(value))&&new Set(prices).size===prices.length;
  let paymentProviderConfigured=false;
  let webhookConfigured=false;
  let billingPortalConfigured=false;
  try{
    const stripe=inspectStripeCommercialConfiguration({secretKey:environment.STRIPE_SECRET_KEY,webhookSecret:environment.STRIPE_WEBHOOK_SECRET,portalConfigurationId:environment.STRIPE_PORTAL_CONFIGURATION_ID,appOrigin:environment.BIMLOG_APP_ORIGIN??"https://bimlog.app"}).readiness;
    const expectedMode=environment.BIMLOG_COMMERCIAL_MODE?.trim();
    const modeMatches=(expectedMode==="test"||expectedMode==="live")&&stripe.mode===expectedMode;
    paymentProviderConfigured=stripe.configured&&modeMatches;
    webhookConfigured=stripe.configured&&stripe.webhookConfigured;
    billingPortalConfigured=paymentProviderConfigured&&stripe.portalConfigured;
  }catch{/* Invalid provider configuration remains unavailable. */}
  const supportTransportConfigured=sendgridPattern.test((environment.SENDGRID_API_KEY??"").trim());
  const supportSenderConfigured=emailPattern.test((environment.BIMLOG_SUPPORT_FROM_EMAIL??"").trim());
  const supportInboxConfigured=emailPattern.test((environment.BIMLOG_SUPPORT_INBOX_EMAIL??"").trim());
  const supportConfigured=supportTransportConfigured&&supportSenderConfigured&&supportInboxConfigured;
  const supportCode=!supportTransportConfigured?"support_transport_invalid":!supportSenderConfigured?"support_sender_invalid":!supportInboxConfigured?"support_inbox_invalid":"support_ready";
  const checks=Object.freeze([
    check("subscription_catalog",subscriptionConfigured,subscriptionConfigured?"catalog_ready":"catalog_invalid"),
    check("payment_provider",paymentProviderConfigured,paymentProviderConfigured?"provider_ready":"provider_invalid"),
    check("payment_webhook",webhookConfigured,webhookConfigured?"webhook_ready":"webhook_invalid"),
    check("billing_portal",billingPortalConfigured,billingPortalConfigured?"portal_ready":"portal_invalid"),
    check("support_channel",supportConfigured,supportCode),
  ]);
  return Object.freeze({subscriptionConfigured,paymentProviderConfigured,webhookConfigured,billingPortalConfigured,supportConfigured,catalogCoverage,checks});
}
