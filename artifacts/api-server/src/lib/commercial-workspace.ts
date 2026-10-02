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

export type PlanChangePreview=Readonly<{companyId:number;subscriptionId:string;fromPlan:SubscriptionPlanId;toPlan:SubscriptionPlanId;fromSeatLimit:number;toSeatLimit:number;assignedSeats:number;effectiveAt:string;requiresSeatReduction:boolean;canSubmit:boolean;blockers:readonly string[];writesPerformed:0}>;
export function previewPlanChange(input:{workspace:CommercialWorkspaceState;toPlan:SubscriptionPlanId;toSeatLimit:number;assignedSeats:number;effectiveAt:string}):PlanChangePreview{
  const effectiveAt=iso(input.effectiveAt,"Plan change effective time"),blockers:string[]=[];
  if(!Number.isSafeInteger(input.toSeatLimit)||input.toSeatLimit<0||!Number.isSafeInteger(input.assignedSeats)||input.assignedSeats<0)throw new Error("Plan change seat quantities are invalid");
  if(input.workspace.status!=="active"||input.workspace.accessStatus!=="active")blockers.push("SUBSCRIPTION_NOT_ACTIVE");
  if(input.toPlan===input.workspace.planId&&input.toSeatLimit===input.workspace.seatLimit)blockers.push("NO_PLAN_CHANGE");
  if(effectiveAt<input.workspace.effectiveAt)blockers.push("EFFECTIVE_TIME_PRECEDES_ACCESS");
  const requiresSeatReduction=input.assignedSeats>input.toSeatLimit;
  if(requiresSeatReduction)blockers.push("ASSIGNED_SEATS_EXCEED_TARGET");
  return Object.freeze({companyId:input.workspace.companyId,subscriptionId:input.workspace.subscriptionId,fromPlan:input.workspace.planId,toPlan:input.toPlan,fromSeatLimit:input.workspace.seatLimit,toSeatLimit:input.toSeatLimit,assignedSeats:input.assignedSeats,effectiveAt,requiresSeatReduction,canSubmit:blockers.length===0,blockers:Object.freeze(blockers),writesPerformed:0});
}
