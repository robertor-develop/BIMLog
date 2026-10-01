import crypto from "node:crypto";
import type { CompanySubscription } from "./subscription-authority";
import type { SubscriptionAccessGrant } from "./commercial-billing-operations";

export const SUPPORT_CHANNELS = ["web", "email"] as const;
export type SupportChannel = (typeof SUPPORT_CHANNELS)[number];
export type SupportTier = "standard" | "priority";

export type CustomerSupportEntitlement = Readonly<{
  id: string; companyId: number; subscriptionId: string; subscriptionRevision: number; accessGrantId: string;
  tier: SupportTier; channels: readonly SupportChannel[]; responseTargetMinutes: number;
  effectiveAt: string; expiresAt: string; status: "active" | "inactive";
}>;

function instant(value: string, label: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} is invalid`);
  return date.toISOString();
}

export function deriveCustomerSupportEntitlement(input: {
  subscription: CompanySubscription; grant: SubscriptionAccessGrant; tier: SupportTier;
  channels: readonly SupportChannel[]; existing: readonly CustomerSupportEntitlement[]; now: string;
}): CustomerSupportEntitlement {
  const now = instant(input.now, "Support entitlement time");
  if (input.subscription.status !== "active") throw new Error("Only an active subscription can grant customer support");
  if (input.grant.status !== "active" || input.grant.companyId !== input.subscription.companyId || input.grant.subscriptionId !== input.subscription.id || input.grant.subscriptionRevision !== input.subscription.revision) throw new Error("Support access lineage is invalid");
  if (input.grant.expiresAt <= now) throw new Error("Support access grant is expired");
  const channels = [...new Set(input.channels)];
  if (!channels.length || channels.some(channel => !SUPPORT_CHANNELS.includes(channel))) throw new Error("At least one governed support channel is required");
  const duplicate = input.existing.find(entitlement => entitlement.subscriptionId === input.subscription.id && entitlement.subscriptionRevision === input.subscription.revision && entitlement.accessGrantId === input.grant.id && entitlement.tier === input.tier);
  if (duplicate) return duplicate;
  if (input.existing.some(entitlement => entitlement.companyId !== input.subscription.companyId || entitlement.subscriptionId !== input.subscription.id)) throw new Error("Existing support entitlement belongs to another subscription");
  return Object.freeze({
    id: crypto.createHash("sha256").update(`${input.subscription.companyId}:${input.subscription.id}:${input.subscription.revision}:${input.grant.id}:${input.tier}`).digest("hex"),
    companyId: input.subscription.companyId, subscriptionId: input.subscription.id, subscriptionRevision: input.subscription.revision,
    accessGrantId: input.grant.id, tier: input.tier, channels: Object.freeze(channels), responseTargetMinutes: input.tier === "priority" ? 240 : 1440,
    effectiveAt: now, expiresAt: input.grant.expiresAt, status: "active",
  });
}

export type CustomerSupportCase = Readonly<{
  id: string; companyId: number; subscriptionId: string; entitlementId: string; requesterUserId: number;
  channel: SupportChannel; locale: "en" | "es"; category: "billing" | "access" | "workflow" | "technical";
  priority: "normal" | "urgent"; subject: string; description: string; status: "open" | "in_progress" | "resolved" | "closed";
  openedAt: string; responseDueAt: string; revision: number;
}>;

export function openCustomerSupportCase(input: {
  entitlement: CustomerSupportEntitlement; requesterUserId: number; channel: SupportChannel; locale: "en" | "es";
  category: CustomerSupportCase["category"]; priority: CustomerSupportCase["priority"];
  subject: string; description: string; requestKey: string; existing: readonly CustomerSupportCase[]; now: string;
}): CustomerSupportCase {
  const openedAt = instant(input.now, "Support case opening time");
  if (input.entitlement.status !== "active" || input.entitlement.expiresAt <= openedAt) throw new Error("Customer support entitlement is not active");
  if (!input.entitlement.channels.includes(input.channel)) throw new Error("Support channel is not entitled");
  if (!Number.isSafeInteger(input.requesterUserId) || input.requesterUserId < 1) throw new Error("Support requester is invalid");
  const subject = input.subject.trim();
  const description = input.description.trim();
  const requestKey = input.requestKey.trim();
  if (subject.length < 5 || subject.length > 160 || description.length < 10 || description.length > 10000 || !requestKey) throw new Error("Support case content is invalid");
  const id = crypto.createHash("sha256").update(`${input.entitlement.companyId}:${input.requesterUserId}:${requestKey}`).digest("hex");
  const duplicate = input.existing.find(supportCase => supportCase.id === id);
  if (duplicate) return duplicate;
  if (input.existing.some(supportCase => supportCase.companyId !== input.entitlement.companyId)) throw new Error("Existing support case belongs to another company");
  const targetMinutes = input.priority === "urgent" ? Math.min(input.entitlement.responseTargetMinutes, 120) : input.entitlement.responseTargetMinutes;
  return Object.freeze({
    id, companyId:input.entitlement.companyId, subscriptionId:input.entitlement.subscriptionId, entitlementId:input.entitlement.id,
    requesterUserId:input.requesterUserId, channel:input.channel, locale:input.locale, category:input.category, priority:input.priority,
    subject, description, status:"open", openedAt, responseDueAt:new Date(new Date(openedAt).getTime() + targetMinutes * 60000).toISOString(), revision:1,
  });
}

export type SupportCaseEvent = Readonly<{
  id: string; caseId: string; companyId: number; revision: number; actorUserId: number;
  actorRole: "customer" | "support" | "support_manager"; action: "acknowledge" | "resolve" | "close" | "reopen";
  fromStatus: CustomerSupportCase["status"]; toStatus: CustomerSupportCase["status"]; occurredAt: string; note: string;
}>;

export function transitionCustomerSupportCase(input: {
  supportCase: CustomerSupportCase; expectedRevision: number; actorUserId: number;
  actorRole: SupportCaseEvent["actorRole"]; action: SupportCaseEvent["action"]; note: string; now: string;
}): Readonly<{ supportCase: CustomerSupportCase; event: SupportCaseEvent }> {
  if (input.expectedRevision !== input.supportCase.revision) throw new Error("Support case revision conflict");
  if (!Number.isSafeInteger(input.actorUserId) || input.actorUserId < 1) throw new Error("Support actor is invalid");
  const transitions: Record<SupportCaseEvent["action"], readonly [CustomerSupportCase["status"], CustomerSupportCase["status"], readonly SupportCaseEvent["actorRole"][]]> = {
    acknowledge:["open","in_progress",["support","support_manager"]],
    resolve:["in_progress","resolved",["support","support_manager"]],
    close:["resolved","closed",["customer","support_manager"]],
    reopen:["resolved","in_progress",["customer","support","support_manager"]],
  };
  const [fromStatus, toStatus, roles] = transitions[input.action];
  if (input.supportCase.status !== fromStatus) throw new Error("Support case transition is invalid");
  if (!roles.includes(input.actorRole)) throw new Error("Support actor cannot perform this transition");
  const note = input.note.trim();
  if (note.length < 3 || note.length > 2000) throw new Error("Support transition note is invalid");
  const occurredAt = instant(input.now, "Support transition time");
  const revision = input.supportCase.revision + 1;
  const event = Object.freeze({ id:crypto.createHash("sha256").update(`${input.supportCase.id}:${revision}:${input.action}`).digest("hex"), caseId:input.supportCase.id, companyId:input.supportCase.companyId, revision, actorUserId:input.actorUserId, actorRole:input.actorRole, action:input.action, fromStatus, toStatus, occurredAt, note });
  return Object.freeze({ supportCase:Object.freeze({ ...input.supportCase, status:toStatus, revision }), event });
}

export type SupportWorkspaceRole = "customer" | "support" | "support_manager" | "auditor";

export function projectCustomerSupportWorkspace(input: {
  companyId: number; viewerUserId: number; role: SupportWorkspaceRole;
  entitlement: CustomerSupportEntitlement; cases: readonly CustomerSupportCase[]; events: readonly SupportCaseEvent[];
}): Readonly<{
  entitlement: Readonly<{ tier: SupportTier; channels: readonly SupportChannel[]; responseTargetMinutes: number; expiresAt: string }>;
  cases: readonly Readonly<{ id: string; requesterUserId: number | null; category: CustomerSupportCase["category"]; priority: CustomerSupportCase["priority"]; subject: string; description: string | null; status: CustomerSupportCase["status"]; openedAt: string; responseDueAt: string; revision: number }>[];
  events: readonly Readonly<{ caseId: string; revision: number; action: SupportCaseEvent["action"]; occurredAt: string; note: string | null }>[];
  canManage: boolean;
}> {
  if (input.entitlement.companyId !== input.companyId) throw new Error("Support entitlement belongs to another company");
  if (input.cases.some(supportCase => supportCase.companyId !== input.companyId || supportCase.entitlementId !== input.entitlement.id)) throw new Error("Support case lineage is invalid");
  const visibleCases = input.role === "customer" ? input.cases.filter(supportCase => supportCase.requesterUserId === input.viewerUserId) : input.cases;
  const visibleIds = new Set(visibleCases.map(supportCase => supportCase.id));
  if (input.events.some(event => event.companyId !== input.companyId || !input.cases.some(supportCase => supportCase.id === event.caseId))) throw new Error("Support event lineage is invalid");
  const operational = input.role === "support" || input.role === "support_manager";
  return Object.freeze({
    entitlement:Object.freeze({ tier:input.entitlement.tier, channels:input.entitlement.channels, responseTargetMinutes:input.entitlement.responseTargetMinutes, expiresAt:input.entitlement.expiresAt }),
    cases:Object.freeze(visibleCases.map(supportCase => Object.freeze({ id:supportCase.id, requesterUserId:operational ? supportCase.requesterUserId : null, category:supportCase.category, priority:supportCase.priority, subject:supportCase.subject, description:input.role === "auditor" ? null : supportCase.description, status:supportCase.status, openedAt:supportCase.openedAt, responseDueAt:supportCase.responseDueAt, revision:supportCase.revision }))),
    events:Object.freeze(input.events.filter(event => visibleIds.has(event.caseId)).map(event => Object.freeze({ caseId:event.caseId, revision:event.revision, action:event.action, occurredAt:event.occurredAt, note:input.role === "auditor" ? null : event.note }))),
    canManage:operational,
  });
}

export const SUPPORT_READINESS_BLOCKERS = [
  "ENTITLEMENT_MISSING", "ENTITLEMENT_STALE", "OPEN_CASE_OVERDUE", "UNRESOLVED_URGENT_CASE", "CASE_EVENT_GAP",
] as const;
export type SupportReadinessBlocker = (typeof SUPPORT_READINESS_BLOCKERS)[number];

export function assessCustomerSupportReadiness(input: {
  companyId: number; entitlement: CustomerSupportEntitlement | null;
  cases: readonly CustomerSupportCase[]; events: readonly SupportCaseEvent[]; now: string;
}): Readonly<{ status: "ready" | "action_required"; blockers: readonly SupportReadinessBlocker[]; checkedAt: string }> {
  const checkedAt = instant(input.now, "Support readiness time");
  const blockers: SupportReadinessBlocker[] = [];
  if (!input.entitlement) blockers.push("ENTITLEMENT_MISSING");
  else if (input.entitlement.companyId !== input.companyId || input.entitlement.status !== "active" || input.entitlement.expiresAt <= checkedAt) blockers.push("ENTITLEMENT_STALE");
  if (input.cases.some(supportCase => supportCase.companyId !== input.companyId || (input.entitlement && supportCase.entitlementId !== input.entitlement.id))) throw new Error("Support readiness case lineage is invalid");
  if (input.events.some(event => event.companyId !== input.companyId || !input.cases.some(supportCase => supportCase.id === event.caseId))) throw new Error("Support readiness event lineage is invalid");
  if (input.cases.some(supportCase => (supportCase.status === "open" || supportCase.status === "in_progress") && supportCase.responseDueAt < checkedAt)) blockers.push("OPEN_CASE_OVERDUE");
  if (input.cases.some(supportCase => supportCase.priority === "urgent" && supportCase.status !== "resolved" && supportCase.status !== "closed")) blockers.push("UNRESOLVED_URGENT_CASE");
  if (input.cases.some(supportCase => supportCase.revision > 1 && !input.events.some(event => event.caseId === supportCase.id && event.revision === supportCase.revision))) blockers.push("CASE_EVENT_GAP");
  return Object.freeze({ status:blockers.length ? "action_required" : "ready", blockers:Object.freeze(blockers), checkedAt });
}
