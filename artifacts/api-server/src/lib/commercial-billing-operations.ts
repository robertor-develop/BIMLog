import crypto from "node:crypto";
import type { CompanySubscription, SubscriptionTerm } from "./subscription-authority";

export const SUBSCRIPTION_FEATURES = ["projects", "coordination", "reports", "lens_next", "commercial_controls"] as const;
export type SubscriptionFeature = (typeof SUBSCRIPTION_FEATURES)[number];

export type SubscriptionAccessGrant = Readonly<{
  id: string;
  companyId: number;
  subscriptionId: string;
  subscriptionRevision: number;
  catalogPriceVersionId: string;
  termId: string;
  features: readonly SubscriptionFeature[];
  seatLimit: number;
  effectiveAt: string;
  expiresAt: string;
  status: "active" | "expired";
}>;

function instant(value: string, label: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} is invalid`);
  return date.toISOString();
}

export function deriveSubscriptionAccess(input: {
  subscription: CompanySubscription;
  term: SubscriptionTerm;
  catalogPriceVersionId: string;
  features: readonly SubscriptionFeature[];
  seatLimit: number;
  existing: readonly SubscriptionAccessGrant[];
  now: string;
}): SubscriptionAccessGrant {
  const now = instant(input.now, "Access evaluation time");
  if (input.subscription.status !== "active") throw new Error("Only an active subscription can grant access");
  if (input.term.subscriptionId !== input.subscription.id) throw new Error("Subscription term lineage is invalid");
  if (now < input.term.startsAt || now >= input.term.endsAt) throw new Error("Subscription term is not effective");
  const catalogPriceVersionId = input.catalogPriceVersionId.trim();
  if (!catalogPriceVersionId) throw new Error("Catalog price version is required");
  if (!Number.isSafeInteger(input.seatLimit) || input.seatLimit < 1 || input.seatLimit > 100000) throw new Error("Seat limit is invalid");
  const features = [...new Set(input.features)];
  if (!features.length || features.some((feature) => !SUBSCRIPTION_FEATURES.includes(feature))) throw new Error("At least one governed subscription feature is required");
  const termId = `${input.term.subscriptionId}:${input.term.sequence}`;
  const duplicate = input.existing.find((grant) => grant.subscriptionId === input.subscription.id && grant.subscriptionRevision === input.subscription.revision && grant.termId === termId && grant.catalogPriceVersionId === catalogPriceVersionId);
  if (duplicate) return duplicate;
  if (input.existing.some((grant) => grant.companyId !== input.subscription.companyId || grant.subscriptionId !== input.subscription.id)) throw new Error("Existing access grant belongs to another subscription");
  return Object.freeze({
    id: crypto.randomUUID(), companyId: input.subscription.companyId, subscriptionId: input.subscription.id,
    subscriptionRevision: input.subscription.revision, catalogPriceVersionId, termId,
    features: Object.freeze(features), seatLimit: input.seatLimit, effectiveAt: now, expiresAt: input.term.endsAt,
    status: "active",
  });
}

export function evaluateSubscriptionAccess(input: { grant: SubscriptionAccessGrant; subscription: CompanySubscription; now: string }): SubscriptionAccessGrant {
  if (input.grant.subscriptionId !== input.subscription.id || input.grant.companyId !== input.subscription.companyId) throw new Error("Access grant subscription lineage is invalid");
  const now = instant(input.now, "Access evaluation time");
  const active = input.subscription.status === "active" && input.subscription.revision >= input.grant.subscriptionRevision && now < input.grant.expiresAt;
  return active || input.grant.status === "expired" ? input.grant : Object.freeze({ ...input.grant, status: "expired" });
}
