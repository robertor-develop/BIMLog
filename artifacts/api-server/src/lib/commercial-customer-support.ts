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
