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

const ALLOWED_TRANSITIONS: Readonly<Record<SubscriptionStatus, readonly SubscriptionStatus[]>> = {
  draft: ["pending", "cancelled"],
  pending: ["active", "cancelled", "expired"],
  active: ["past_due", "suspended", "cancelled", "expired"],
  past_due: ["active", "suspended", "cancelled", "expired"],
  suspended: ["active", "cancelled", "expired"],
  cancelled: [],
  expired: [],
};

export function transitionSubscription(input: {
  subscription: CompanySubscription;
  to: SubscriptionStatus;
  expectedRevision: number;
  now: string;
}): CompanySubscription {
  if (input.subscription.revision !== input.expectedRevision) throw new Error("Subscription revision is stale");
  if (!ALLOWED_TRANSITIONS[input.subscription.status].includes(input.to)) {
    throw new Error(`Subscription transition ${input.subscription.status} -> ${input.to} is not allowed`);
  }
  return Object.freeze({
    ...input.subscription,
    status: input.to,
    revision: input.subscription.revision + 1,
    updatedAt: new Date(input.now).toISOString(),
  });
}

export const SUBSCRIPTION_SEAT_CLASSES = ["member", "administrator", "viewer"] as const;
export type SubscriptionSeatClass = (typeof SUBSCRIPTION_SEAT_CLASSES)[number];

export type SubscriptionSeatQuantity = Readonly<{
  subscriptionId: string;
  seatClass: SubscriptionSeatClass;
  purchased: number;
  assigned: number;
  revision: number;
  updatedAt: string;
}>;

function validateSeatCounts(purchased: number, assigned: number): void {
  if (!Number.isSafeInteger(purchased) || purchased < 0) throw new Error("Purchased seats must be a non-negative integer");
  if (!Number.isSafeInteger(assigned) || assigned < 0) throw new Error("Assigned seats must be a non-negative integer");
  if (assigned > purchased) throw new Error("Assigned seats cannot exceed purchased seats");
}

export function createSeatQuantity(input: {
  subscriptionId: string;
  seatClass: SubscriptionSeatClass;
  purchased: number;
  assigned?: number;
  now: string;
}): SubscriptionSeatQuantity {
  if (!input.subscriptionId.trim()) throw new Error("A subscription is required for seat quantities");
  if (!SUBSCRIPTION_SEAT_CLASSES.includes(input.seatClass)) throw new Error("A valid seat class is required");
  const assigned = input.assigned ?? 0;
  validateSeatCounts(input.purchased, assigned);
  return Object.freeze({
    subscriptionId: input.subscriptionId,
    seatClass: input.seatClass,
    purchased: input.purchased,
    assigned,
    revision: 1,
    updatedAt: new Date(input.now).toISOString(),
  });
}

export function changeSeatQuantity(input: {
  quantity: SubscriptionSeatQuantity;
  purchased?: number;
  assigned?: number;
  expectedRevision: number;
  now: string;
}): SubscriptionSeatQuantity {
  if (input.quantity.revision !== input.expectedRevision) throw new Error("Seat quantity revision is stale");
  const purchased = input.purchased ?? input.quantity.purchased;
  const assigned = input.assigned ?? input.quantity.assigned;
  validateSeatCounts(purchased, assigned);
  return Object.freeze({
    ...input.quantity,
    purchased,
    assigned,
    revision: input.quantity.revision + 1,
    updatedAt: new Date(input.now).toISOString(),
  });
}
