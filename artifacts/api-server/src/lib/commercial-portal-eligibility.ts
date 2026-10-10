export type CommercialPortalLifecycle="pending"|"trialing"|"active"|"past_due"|"suspended"|"canceling"|"canceled";
export type CommercialPortalPurpose="manage"|"recover_payment"|"review_cancellation";
export type CommercialPortalBlocker="billing_authority"|"subscription_state"|"provider_customer"|"portal_service";

export type CommercialPortalEligibility=Readonly<{
  ready:boolean;
  purpose:CommercialPortalPurpose|null;
  blockers:readonly CommercialPortalBlocker[];
}>;

export function deriveCommercialPortalEligibility(input:{
  lifecycle:CommercialPortalLifecycle|null;
  canManageBilling:boolean;
  providerCustomerBound:boolean;
  portalConfigured:boolean;
}):CommercialPortalEligibility{
  const blockers:CommercialPortalBlocker[]=[];
  if(!input.canManageBilling)blockers.push("billing_authority");
  const purpose=input.lifecycle==="past_due"||input.lifecycle==="suspended"?"recover_payment":input.lifecycle==="canceling"?"review_cancellation":input.lifecycle==="active"||input.lifecycle==="trialing"?"manage":null;
  if(!purpose)blockers.push("subscription_state");
  if(!input.providerCustomerBound)blockers.push("provider_customer");
  if(!input.portalConfigured)blockers.push("portal_service");
  return Object.freeze({ready:blockers.length===0,purpose,blockers:Object.freeze(blockers)});
}
