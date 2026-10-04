import {inspectCommercialPlatformReadiness,type CommercialSalesLaunchBlocker} from "./commercial-platform-readiness";

export const commercialLaunchStepIds=["catalog","provider","live_mode","webhook","portal","support"] as const;
export type CommercialLaunchStepId=typeof commercialLaunchStepIds[number];
export type CommercialLaunchStep=Readonly<{
  id:CommercialLaunchStepId;
  status:"ready"|"action_required";
  owner:"bimlog_platform";
  title:string;
  configurationKeys:readonly string[];
}>;

const definitions:Readonly<Record<CommercialLaunchStepId,Omit<CommercialLaunchStep,"id"|"status">>>=Object.freeze({
  catalog:{owner:"bimlog_platform",title:"Publish six unique Stripe prices for paid plans",configurationKeys:["BIMLOG_STRIPE_PRICE_IDS"]},
  provider:{owner:"bimlog_platform",title:"Connect the Stripe account for checkout",configurationKeys:["BIMLOG_COMMERCIAL_MODE","STRIPE_SECRET_KEY","BIMLOG_APP_ORIGIN"]},
  live_mode:{owner:"bimlog_platform",title:"Switch the verified payment connection to live mode",configurationKeys:["BIMLOG_COMMERCIAL_MODE","STRIPE_SECRET_KEY"]},
  webhook:{owner:"bimlog_platform",title:"Connect signed Stripe payment confirmation",configurationKeys:["STRIPE_WEBHOOK_SECRET"]},
  portal:{owner:"bimlog_platform",title:"Connect Stripe billing self-service",configurationKeys:["STRIPE_PORTAL_CONFIGURATION_ID"]},
  support:{owner:"bimlog_platform",title:"Connect SendGrid customer support delivery",configurationKeys:["SENDGRID_API_KEY","BIMLOG_SUPPORT_FROM_EMAIL","BIMLOG_SUPPORT_INBOX_EMAIL"]},
});

export function deriveCommercialLaunchActivation(environment:NodeJS.ProcessEnv){
  const readiness=inspectCommercialPlatformReadiness(environment);
  const blockers=new Set<CommercialSalesLaunchBlocker>(readiness.salesLaunchBlockers);
  const steps=Object.freeze(commercialLaunchStepIds.map(id=>Object.freeze({id,status:blockers.has(id)?"action_required" as const:"ready" as const,...definitions[id],configurationKeys:Object.freeze([...definitions[id].configurationKeys])})));
  return Object.freeze({status:readiness.salesLaunchStatus,providerMode:readiness.providerMode,ready:readiness.salesLaunchStatus==="ready",steps,requiredActionCount:steps.filter(step=>step.status==="action_required").length,checkedAt:new Date().toISOString()});
}
