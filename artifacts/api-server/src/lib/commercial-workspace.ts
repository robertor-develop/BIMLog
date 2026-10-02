import crypto from "node:crypto";
import type { CompanySubscription, SubscriptionPlanId } from "./subscription-authority";
import type { SubscriptionAccessGrant } from "./commercial-billing-operations";

export type CommercialWorkspaceState = Readonly<{
  companyId: number; subscriptionId: string; subscriptionRevision: number; planId: SubscriptionPlanId;
  status: CompanySubscription["status"]; accessStatus: SubscriptionAccessGrant["status"];
  seatLimit: number; effectiveAt: string; expiresAt: string; fingerprint: string;
}>;

function iso(value: string, label: string): string { const parsed=new Date(value); if(!Number.isFinite(parsed.getTime()))throw new Error(`${label} is invalid`); return parsed.toISOString(); }

export function assembleCommercialWorkspace(input:{subscription:CompanySubscription;access:SubscriptionAccessGrant;now:string}):CommercialWorkspaceState{
  const now=iso(input.now,"Commercial workspace time"),{subscription,access}=input;
  if(access.companyId!==subscription.companyId||access.subscriptionId!==subscription.id||access.subscriptionRevision!==subscription.revision)throw new Error("Commercial workspace lineage is invalid");
  if(access.effectiveAt>now)throw new Error("Commercial access is not yet effective");
  const canonical=`${subscription.companyId}:${subscription.id}:${subscription.revision}:${subscription.planId}:${subscription.status}:${access.id}:${access.status}:${access.seatLimit}:${access.effectiveAt}:${access.expiresAt}`;
  return Object.freeze({companyId:subscription.companyId,subscriptionId:subscription.id,subscriptionRevision:subscription.revision,planId:subscription.planId,status:subscription.status,accessStatus:access.expiresAt<=now?"inactive":access.status,seatLimit:access.seatLimit,effectiveAt:access.effectiveAt,expiresAt:access.expiresAt,fingerprint:crypto.createHash("sha256").update(canonical).digest("hex")});
}
