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
