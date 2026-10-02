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

export type CommercialSeatAssignment=Readonly<{userId:number;email:string;role:"member"|"administrator"|"viewer";status:"active"|"invited"}>;
export function reconcileCommercialSeats(input:{workspace:CommercialWorkspaceState;assignments:readonly CommercialSeatAssignment[]}):Readonly<{assigned:number;available:number;assignments:readonly CommercialSeatAssignment[];canInvite:boolean}>{
  const seenUsers=new Set<number>(),seenEmails=new Set<string>();
  const assignments=input.assignments.map(entry=>{const email=entry.email.trim().toLowerCase();if(!Number.isSafeInteger(entry.userId)||entry.userId<1||!/^\S+@\S+\.\S+$/.test(email))throw new Error("Commercial seat identity is invalid");if(seenUsers.has(entry.userId)||seenEmails.has(email))throw new Error("Commercial seat assignment is duplicated");seenUsers.add(entry.userId);seenEmails.add(email);return Object.freeze({...entry,email});});
  if(assignments.length>input.workspace.seatLimit)throw new Error("Commercial seat limit exceeded");
  const available=input.workspace.seatLimit-assignments.length;
  return Object.freeze({assigned:assignments.length,available,assignments:Object.freeze(assignments),canInvite:input.workspace.status==="active"&&input.workspace.accessStatus==="active"&&available>0});
}

export const COMMERCIAL_LAUNCH_BLOCKERS=["SUBSCRIPTION_INACTIVE","ACCESS_INACTIVE","BILLING_IDENTITY_INCOMPLETE","PROVIDER_NOT_READY","WEBHOOK_NOT_READY","PORTAL_NOT_READY","SUPPORT_NOT_READY"] as const;
export type CommercialLaunchBlocker=(typeof COMMERCIAL_LAUNCH_BLOCKERS)[number];
export function assessCommercialLaunch(input:{workspace:CommercialWorkspaceState;billingIdentityComplete:boolean;providerReady:boolean;webhookReady:boolean;portalReady:boolean;supportReady:boolean;now:string}):Readonly<{status:"ready"|"blocked";blockers:readonly CommercialLaunchBlocker[];checkedAt:string}>{
  const checkedAt=iso(input.now,"Commercial launch check time"),blockers:CommercialLaunchBlocker[]=[];
  if(input.workspace.status!=="active")blockers.push("SUBSCRIPTION_INACTIVE");
  if(input.workspace.accessStatus!=="active"||input.workspace.expiresAt<=checkedAt)blockers.push("ACCESS_INACTIVE");
  if(!input.billingIdentityComplete)blockers.push("BILLING_IDENTITY_INCOMPLETE");
  if(!input.providerReady)blockers.push("PROVIDER_NOT_READY");
  if(!input.webhookReady)blockers.push("WEBHOOK_NOT_READY");
  if(!input.portalReady)blockers.push("PORTAL_NOT_READY");
  if(!input.supportReady)blockers.push("SUPPORT_NOT_READY");
  return Object.freeze({status:blockers.length?"blocked":"ready",blockers:Object.freeze(blockers),checkedAt});
}

export type CommercialWorkspaceRole="customer_admin"|"billing_admin"|"support"|"auditor";
export function projectCommercialWorkspace(input:{workspace:CommercialWorkspaceState;role:CommercialWorkspaceRole;launch:ReturnType<typeof assessCommercialLaunch>;seats:ReturnType<typeof reconcileCommercialSeats>}):Readonly<Record<string,unknown>>{
  const operational=input.role==="billing_admin"||input.role==="support";
  const customer=input.role==="customer_admin";
  return Object.freeze({companyId:input.workspace.companyId,planId:input.workspace.planId,status:input.workspace.status,accessStatus:input.workspace.accessStatus,expiresAt:input.workspace.expiresAt,seatSummary:Object.freeze({assigned:input.seats.assigned,available:input.seats.available,canInvite:customer&&input.seats.canInvite}),launch:Object.freeze({status:input.launch.status,blockers:operational||customer?input.launch.blockers:[],checkedAt:input.launch.checkedAt}),canChangePlan:customer,canOpenBillingPortal:customer&&input.launch.status==="ready",canManageProvider:input.role==="billing_admin",canManageSupport:input.role==="support"});
}
