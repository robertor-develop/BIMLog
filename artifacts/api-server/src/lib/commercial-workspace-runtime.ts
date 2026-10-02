export const COMMERCIAL_RUNTIME_BLOCKERS=["COMMERCIAL_ACCESS_DISABLED","SUBSCRIPTION_NOT_CONFIGURED","BILLING_IDENTITY_INCOMPLETE","PAYMENT_PROVIDER_NOT_CONFIGURED","WEBHOOK_NOT_CONFIGURED","BILLING_PORTAL_NOT_CONFIGURED","SUPPORT_CHANNEL_NOT_CONFIGURED"] as const;
export type CommercialRuntimeBlocker=(typeof COMMERCIAL_RUNTIME_BLOCKERS)[number];
export type CommercialRuntimeWorkspace=Readonly<{companyId:number;companyName:string;memberCount:number;commercialAccess:boolean;subscriptionStatus:"not_configured"|"active";billingIdentityStatus:"incomplete"|"complete";paymentProviderStatus:"not_configured"|"ready";webhookStatus:"not_configured"|"ready";billingPortalStatus:"not_configured"|"ready";supportStatus:"not_configured"|"ready";readiness:"action_required"|"ready";blockers:readonly CommercialRuntimeBlocker[]}>;

export function deriveCommercialRuntimeWorkspace(input:{companyId:number;companyName:string;memberCount:number;commercialAccess:boolean;subscriptionConfigured:boolean;billingIdentityComplete:boolean;paymentProviderConfigured:boolean;webhookConfigured:boolean;billingPortalConfigured:boolean;supportConfigured:boolean}):CommercialRuntimeWorkspace{
  if(!Number.isSafeInteger(input.companyId)||input.companyId<1||!Number.isSafeInteger(input.memberCount)||input.memberCount<0||!input.companyName.trim())throw new Error("Commercial runtime company identity is invalid");
  const blockers:CommercialRuntimeBlocker[]=[];
  if(!input.commercialAccess)blockers.push("COMMERCIAL_ACCESS_DISABLED");
  if(!input.subscriptionConfigured)blockers.push("SUBSCRIPTION_NOT_CONFIGURED");
  if(!input.billingIdentityComplete)blockers.push("BILLING_IDENTITY_INCOMPLETE");
  if(!input.paymentProviderConfigured)blockers.push("PAYMENT_PROVIDER_NOT_CONFIGURED");
  if(!input.webhookConfigured)blockers.push("WEBHOOK_NOT_CONFIGURED");
  if(!input.billingPortalConfigured)blockers.push("BILLING_PORTAL_NOT_CONFIGURED");
  if(!input.supportConfigured)blockers.push("SUPPORT_CHANNEL_NOT_CONFIGURED");
  return Object.freeze({companyId:input.companyId,companyName:input.companyName.trim(),memberCount:input.memberCount,commercialAccess:input.commercialAccess,subscriptionStatus:input.subscriptionConfigured?"active":"not_configured",billingIdentityStatus:input.billingIdentityComplete?"complete":"incomplete",paymentProviderStatus:input.paymentProviderConfigured?"ready":"not_configured",webhookStatus:input.webhookConfigured?"ready":"not_configured",billingPortalStatus:input.billingPortalConfigured?"ready":"not_configured",supportStatus:input.supportConfigured?"ready":"not_configured",readiness:blockers.length?"action_required":"ready",blockers:Object.freeze(blockers)});
}
