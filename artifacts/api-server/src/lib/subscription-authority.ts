import crypto from "node:crypto";

export const SUBSCRIPTION_PLAN_IDS = ["free", "professional", "team", "business", "enterprise"] as const;
export type SubscriptionPlanId = (typeof SUBSCRIPTION_PLAN_IDS)[number];
export type SubscriptionStatus = "draft" | "pending" | "active" | "past_due" | "suspended" | "cancelled" | "expired";

export type CompanySubscription = Readonly<{
  id: string;
  companyId: number;
  planId: SubscriptionPlanId;
  catalogPriceVersion: number;
  billingCycle: "monthly" | "annual";
  currency: "USD";
  amount: number | null;
  status: SubscriptionStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
}>;

export function createCompanySubscription(input: {
  id?: string;
  companyId: number;
  planId: SubscriptionPlanId;
  catalogPriceVersion: number;
  billingCycle: "monthly" | "annual";
  currency: "USD";
  amount: number | null;
  now: string;
}): CompanySubscription {
  if (!Number.isSafeInteger(input.companyId) || input.companyId < 1) throw new Error("A valid company is required");
  if (!SUBSCRIPTION_PLAN_IDS.includes(input.planId)) throw new Error("A valid subscription plan is required");
  if (!Number.isSafeInteger(input.catalogPriceVersion) || input.catalogPriceVersion < 1) throw new Error("A valid catalog price version is required");
  if (input.amount !== null && (!Number.isFinite(input.amount) || input.amount < 0)) throw new Error("A non-negative amount is required");
  const now = new Date(input.now).toISOString();
  return Object.freeze({
    id: input.id ?? crypto.randomUUID(), companyId: input.companyId, planId: input.planId,
    catalogPriceVersion: input.catalogPriceVersion, billingCycle: input.billingCycle,
    currency: input.currency, amount: input.amount, status: "draft", revision: 1,
    createdAt: now, updatedAt: now,
  });
}
