export const COMMERCIAL_RUNTIME_BLOCKERS=["COMMERCIAL_ACCESS_DISABLED","SUBSCRIPTION_NOT_CONFIGURED","BILLING_IDENTITY_INCOMPLETE","PAYMENT_PROVIDER_NOT_CONFIGURED","WEBHOOK_NOT_CONFIGURED","BILLING_PORTAL_NOT_CONFIGURED","SUPPORT_CHANNEL_NOT_CONFIGURED"] as const;
export type CommercialRuntimeBlocker=(typeof COMMERCIAL_RUNTIME_BLOCKERS)[number];
export type CommercialRuntimeAction=Readonly<{id:"complete_billing_identity"|"review_plans"|"contact_support";status:"available"|"complete"|"blocked";href:string;blockers:readonly CommercialRuntimeBlocker[]}>;
export type CommercialRuntimeResponsibilities=Readonly<{customer:readonly CommercialRuntimeBlocker[];bimlog:readonly CommercialRuntimeBlocker[];customerReadiness:"action_required"|"ready";platformReadiness:"action_required"|"ready"}>;
export type CommercialRuntimeWorkspace=Readonly<{companyId:number;companyName:string;memberCount:number;commercialAccess:boolean;subscriptionStatus:"not_configured"|"active";billingIdentityStatus:"incomplete"|"complete";paymentProviderStatus:"not_configured"|"ready";webhookStatus:"not_configured"|"ready";billingPortalStatus:"not_configured"|"ready";supportStatus:"not_configured"|"ready";providerMode:CommercialProviderMode;salesLaunchStatus:"ready"|"test_only"|"blocked";salesLaunchBlockers:readonly CommercialSalesLaunchBlocker[];readiness:"action_required"|"ready";blockers:readonly CommercialRuntimeBlocker[];responsibilities:CommercialRuntimeResponsibilities;platformChecks:readonly CommercialPlatformCheck[];catalogCoverage:readonly CommercialCatalogCoverage[];actions:readonly CommercialRuntimeAction[]}>;
const actionBlockers=(...values:CommercialRuntimeBlocker[]):readonly CommercialRuntimeBlocker[]=>Object.freeze(values);

export function deriveCommercialRuntimeWorkspace(input:{companyId:number;companyName:string;memberCount:number;commercialAccess:boolean;subscriptionConfigured:boolean;billingIdentityComplete:boolean;paymentProviderConfigured:boolean;webhookConfigured:boolean;billingPortalConfigured:boolean;supportConfigured:boolean;providerMode:CommercialProviderMode;salesLaunchStatus:"ready"|"test_only"|"blocked";salesLaunchBlockers:readonly CommercialSalesLaunchBlocker[];platformChecks:readonly CommercialPlatformCheck[];catalogCoverage:readonly CommercialCatalogCoverage[]}):CommercialRuntimeWorkspace{
  if(!Number.isSafeInteger(input.companyId)||input.companyId<1||!Number.isSafeInteger(input.memberCount)||input.memberCount<0||!input.companyName.trim())throw new Error("Commercial runtime company identity is invalid");
  const checkServices=input.platformChecks.map(item=>item.service);
  if(checkServices.length!==commercialPlatformServices.length||new Set(checkServices).size!==commercialPlatformServices.length||commercialPlatformServices.some(service=>!checkServices.includes(service)))throw new Error("Commercial platform checks are incomplete");
  const expected=[input.subscriptionConfigured,input.paymentProviderConfigured,input.webhookConfigured,input.billingPortalConfigured,input.supportConfigured];
  if(input.platformChecks.some((item,index)=>(item.status==="ready")!==expected[index]||!/^[a-z_]{3,40}$/.test(item.code)))throw new Error("Commercial platform checks conflict with runtime status");
  const requiredSlots=commercialPaidOffers.flatMap(plan=>commercialBillingCycles.map(cycle=>`${plan}.${cycle}`));
  if(input.catalogCoverage.length!==requiredSlots.length||new Set(input.catalogCoverage.map(item=>item.slot)).size!==requiredSlots.length||requiredSlots.some(slot=>!input.catalogCoverage.some(item=>item.slot===slot))||input.subscriptionConfigured!==input.catalogCoverage.every(item=>item.status==="ready"))throw new Error("Commercial catalog coverage conflicts with runtime status");
  if(input.salesLaunchBlockers.some(blocker=>!commercialSalesLaunchBlockers.includes(blocker))||new Set(input.salesLaunchBlockers).size!==input.salesLaunchBlockers.length)throw new Error("Commercial sales launch blockers are invalid");
  const expectedSalesStatus=input.salesLaunchBlockers.length===0?"ready":input.providerMode==="test"&&input.salesLaunchBlockers.every(blocker=>blocker==="live_mode")?"test_only":"blocked";
  if(input.salesLaunchStatus!==expectedSalesStatus)throw new Error("Commercial sales launch status is contradictory");
  const blockers:CommercialRuntimeBlocker[]=[];
  if(!input.commercialAccess)blockers.push("COMMERCIAL_ACCESS_DISABLED");
  if(!input.subscriptionConfigured)blockers.push("SUBSCRIPTION_NOT_CONFIGURED");
  if(!input.billingIdentityComplete)blockers.push("BILLING_IDENTITY_INCOMPLETE");
  if(!input.paymentProviderConfigured)blockers.push("PAYMENT_PROVIDER_NOT_CONFIGURED");
  if(!input.webhookConfigured)blockers.push("WEBHOOK_NOT_CONFIGURED");
  if(!input.billingPortalConfigured)blockers.push("BILLING_PORTAL_NOT_CONFIGURED");
  if(!input.supportConfigured)blockers.push("SUPPORT_CHANNEL_NOT_CONFIGURED");
  const actions:CommercialRuntimeAction[]=[
    Object.freeze({id:"complete_billing_identity",status:input.billingIdentityComplete?"complete":"available",href:"/settings/company-profile",blockers:actionBlockers()}),
    Object.freeze({id:"review_plans",status:input.commercialAccess?"available":"blocked",href:"/pricing",blockers:input.commercialAccess?actionBlockers():actionBlockers("COMMERCIAL_ACCESS_DISABLED")}),
    Object.freeze({id:"contact_support",status:input.supportConfigured?"available":"blocked",href:"/contact",blockers:input.supportConfigured?actionBlockers():actionBlockers("SUPPORT_CHANNEL_NOT_CONFIGURED")}),
  ];
  const customer=Object.freeze(blockers.filter(blocker=>blocker==="BILLING_IDENTITY_INCOMPLETE"));
  const bimlog=Object.freeze(blockers.filter(blocker=>blocker!=="BILLING_IDENTITY_INCOMPLETE"));
  const responsibilities=Object.freeze({customer,bimlog,customerReadiness:customer.length?"action_required" as const:"ready" as const,platformReadiness:bimlog.length?"action_required" as const:"ready" as const});
  return Object.freeze({companyId:input.companyId,companyName:input.companyName.trim(),memberCount:input.memberCount,commercialAccess:input.commercialAccess,subscriptionStatus:input.subscriptionConfigured?"active":"not_configured",billingIdentityStatus:input.billingIdentityComplete?"complete":"incomplete",paymentProviderStatus:input.paymentProviderConfigured?"ready":"not_configured",webhookStatus:input.webhookConfigured?"ready":"not_configured",billingPortalStatus:input.billingPortalConfigured?"ready":"not_configured",supportStatus:input.supportConfigured?"ready":"not_configured",providerMode:input.providerMode,salesLaunchStatus:input.salesLaunchStatus,salesLaunchBlockers:Object.freeze([...input.salesLaunchBlockers]),readiness:blockers.length?"action_required":"ready",blockers:Object.freeze(blockers),responsibilities,platformChecks:Object.freeze([...input.platformChecks]),catalogCoverage:Object.freeze([...input.catalogCoverage]),actions:Object.freeze(actions)});
}
import {commercialBillingCycles,commercialPaidOffers,commercialPlatformServices,commercialSalesLaunchBlockers,type CommercialCatalogCoverage,type CommercialPlatformCheck,type CommercialProviderMode,type CommercialSalesLaunchBlocker} from "./commercial-platform-readiness";
