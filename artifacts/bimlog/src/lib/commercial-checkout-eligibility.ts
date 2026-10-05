import type {CommercialWorkspaceDto} from "./commercial-workspace-client";
export type CommercialCheckoutBlocker="billing_authority"|"billing_identity"|"subscription"|"offer_mismatch"|"provider_customer"|"payment_service";
export function deriveCommercialCheckoutEligibility(value:CommercialWorkspaceDto,selected?:{plan:"professional"|"team"|"business";cycle:"monthly"|"annual"}){
  const blockers:CommercialCheckoutBlocker[]=[];
  if(!value.billingAuthority.canManageBilling)blockers.push("billing_authority");
  if(value.billingIdentityStatus!=="complete")blockers.push("billing_identity");
  if(!["pending","trialing"].includes(value.subscriptionStatus))blockers.push("subscription");
  if(selected&&value.preparedSubscription&&(selected.plan!==value.preparedSubscription.plan||selected.cycle!==value.preparedSubscription.billingCycle))blockers.push("offer_mismatch");
  if(!value.providerCustomerBound)blockers.push("provider_customer");
  if(value.paymentProviderStatus!=="ready")blockers.push("payment_service");
  return Object.freeze({ready:blockers.length===0,blockers:Object.freeze(blockers)});
}
