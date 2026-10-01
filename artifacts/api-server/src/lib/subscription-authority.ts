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

const PLAN_CAPABILITIES: Readonly<Record<SubscriptionPlanId, readonly string[]>> = {
  free: ["project.read"],
  professional: ["project.read", "project.manage", "coordination.manage"],
  team: ["project.read", "project.manage", "coordination.manage", "team.manage", "commercial.read"],
  business: ["project.read", "project.manage", "coordination.manage", "team.manage", "commercial.read", "commercial.manage", "integration.manage"],
  enterprise: ["project.read", "project.manage", "coordination.manage", "team.manage", "commercial.read", "commercial.manage", "integration.manage", "governance.manage"],
};

export type SubscriptionEntitlementSnapshot = Readonly<{
  subscriptionId: string;
  companyId: number;
  planId: SubscriptionPlanId;
  catalogPriceVersion: number;
  subscriptionRevision: number;
  enabled: boolean;
  capabilities: readonly string[];
  seats: readonly Readonly<{ seatClass: SubscriptionSeatClass; purchased: number; assigned: number; revision: number }>[];
  effectiveAt: string;
  fingerprint: string;
}>;

function snapshotFingerprint(value: Omit<SubscriptionEntitlementSnapshot, "fingerprint">): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function createEntitlementSnapshot(input: {
  subscription: CompanySubscription;
  seatQuantities: readonly SubscriptionSeatQuantity[];
  effectiveAt: string;
}): SubscriptionEntitlementSnapshot {
  const seen = new Set<SubscriptionSeatClass>();
  const seats = input.seatQuantities.map((quantity) => {
    if (quantity.subscriptionId !== input.subscription.id) throw new Error("Seat quantity belongs to another subscription");
    if (seen.has(quantity.seatClass)) throw new Error(`Duplicate ${quantity.seatClass} seat quantity`);
    seen.add(quantity.seatClass);
    validateSeatCounts(quantity.purchased, quantity.assigned);
    return Object.freeze({ seatClass: quantity.seatClass, purchased: quantity.purchased, assigned: quantity.assigned, revision: quantity.revision });
  }).sort((a, b) => a.seatClass.localeCompare(b.seatClass));
  const enabled = input.subscription.status === "active";
  const unsigned = Object.freeze({
    subscriptionId: input.subscription.id,
    companyId: input.subscription.companyId,
    planId: input.subscription.planId,
    catalogPriceVersion: input.subscription.catalogPriceVersion,
    subscriptionRevision: input.subscription.revision,
    enabled,
    capabilities: Object.freeze(enabled ? [...PLAN_CAPABILITIES[input.subscription.planId]] : []),
    seats: Object.freeze(seats),
    effectiveAt: new Date(input.effectiveAt).toISOString(),
  });
  return Object.freeze({ ...unsigned, fingerprint: snapshotFingerprint(unsigned) });
}

export function verifyEntitlementSnapshot(snapshot: SubscriptionEntitlementSnapshot): boolean {
  const { fingerprint, ...unsigned } = snapshot;
  return fingerprint === snapshotFingerprint(unsigned);
}

export type CommercialAuditAction =
  | "subscription.created"
  | "subscription.transitioned"
  | "seats.changed"
  | "entitlements.snapshotted";

export type CommercialAuditEvent = Readonly<{
  sequence: number;
  subscriptionId: string;
  companyId: number;
  action: CommercialAuditAction;
  actorId: string;
  reason: string;
  occurredAt: string;
  subscriptionRevision: number;
  previousDigest: string | null;
  details: Readonly<Record<string, string | number | boolean | null>>;
  digest: string;
}>;

function auditDigest(event: Omit<CommercialAuditEvent, "digest">): string {
  return crypto.createHash("sha256").update(JSON.stringify(event)).digest("hex");
}

export function appendCommercialAuditEvent(input: {
  history: readonly CommercialAuditEvent[];
  subscription: CompanySubscription;
  action: CommercialAuditAction;
  actorId: string;
  reason: string;
  occurredAt: string;
  details?: Readonly<Record<string, string | number | boolean | null>>;
}): CommercialAuditEvent {
  const actorId = input.actorId.trim();
  const reason = input.reason.trim();
  if (!actorId) throw new Error("A commercial audit actor is required");
  if (reason.length < 3 || reason.length > 500) throw new Error("A commercial audit reason must be between 3 and 500 characters");
  if (!verifyCommercialAuditHistory(input.history)) throw new Error("Commercial audit history is invalid");
  const previous = input.history.at(-1);
  if (previous && previous.subscriptionId !== input.subscription.id) throw new Error("Commercial audit history belongs to another subscription");
  const unsigned = Object.freeze({
    sequence: input.history.length + 1,
    subscriptionId: input.subscription.id,
    companyId: input.subscription.companyId,
    action: input.action,
    actorId,
    reason,
    occurredAt: new Date(input.occurredAt).toISOString(),
    subscriptionRevision: input.subscription.revision,
    previousDigest: previous?.digest ?? null,
    details: Object.freeze({ ...(input.details ?? {}) }),
  });
  return Object.freeze({ ...unsigned, digest: auditDigest(unsigned) });
}

export function verifyCommercialAuditHistory(history: readonly CommercialAuditEvent[]): boolean {
  let previousDigest: string | null = null;
  for (let index = 0; index < history.length; index += 1) {
    const event = history[index];
    if (event.sequence !== index + 1 || event.previousDigest !== previousDigest) return false;
    const { digest, ...unsigned } = event;
    if (digest !== auditDigest(unsigned)) return false;
    previousDigest = digest;
  }
  return true;
}

export type CommercialOrderStatus = "draft" | "ready" | "submitted" | "accepted" | "cancelled" | "expired";

export type CommercialOrder = Readonly<{
  id: string;
  companyId: number;
  subscriptionId: string;
  planId: SubscriptionPlanId;
  catalogPriceVersion: number;
  billingCycle: "monthly" | "annual";
  currency: "USD";
  subtotal: number;
  tax: number | null;
  total: number | null;
  status: CommercialOrderStatus;
  revision: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}>;

export function createCommercialOrder(input: {
  id?: string;
  subscription: CompanySubscription;
  subtotal: number;
  tax?: number | null;
  expiresAt: string;
  now: string;
}): CommercialOrder {
  if (input.subscription.status !== "draft") throw new Error("Orders require a draft subscription");
  if (!Number.isFinite(input.subtotal) || input.subtotal < 0) throw new Error("Order subtotal must be non-negative");
  const tax = input.tax ?? null;
  if (tax !== null && (!Number.isFinite(tax) || tax < 0)) throw new Error("Order tax must be non-negative");
  const now = new Date(input.now).toISOString();
  const expiresAt = new Date(input.expiresAt).toISOString();
  if (expiresAt <= now) throw new Error("Order expiration must be in the future");
  return Object.freeze({
    id: input.id ?? crypto.randomUUID(),
    companyId: input.subscription.companyId,
    subscriptionId: input.subscription.id,
    planId: input.subscription.planId,
    catalogPriceVersion: input.subscription.catalogPriceVersion,
    billingCycle: input.subscription.billingCycle,
    currency: input.subscription.currency,
    subtotal: input.subtotal,
    tax,
    total: tax === null ? null : input.subtotal + tax,
    status: tax === null ? "draft" : "ready",
    revision: 1,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });
}

const ORDER_TRANSITIONS: Readonly<Record<CommercialOrderStatus, readonly CommercialOrderStatus[]>> = {
  draft: ["ready", "cancelled", "expired"],
  ready: ["submitted", "cancelled", "expired"],
  submitted: ["accepted", "cancelled", "expired"],
  accepted: [],
  cancelled: [],
  expired: [],
};

export function transitionCommercialOrder(input: {
  order: CommercialOrder;
  to: CommercialOrderStatus;
  expectedRevision: number;
  tax?: number;
  now: string;
}): CommercialOrder {
  if (input.order.revision !== input.expectedRevision) throw new Error("Order revision is stale");
  if (!ORDER_TRANSITIONS[input.order.status].includes(input.to)) throw new Error(`Order transition ${input.order.status} -> ${input.to} is not allowed`);
  const now = new Date(input.now).toISOString();
  if (input.to !== "expired" && now >= input.order.expiresAt) throw new Error("Order has expired");
  let tax = input.order.tax;
  let total = input.order.total;
  if (input.order.status === "draft" && input.to === "ready") {
    if (!Number.isFinite(input.tax) || (input.tax ?? -1) < 0) throw new Error("A non-negative finalized tax is required");
    tax = input.tax!;
    total = input.order.subtotal + tax;
  }
  if ((input.to === "submitted" || input.to === "accepted") && total === null) throw new Error("Order total must be finalized before submission");
  return Object.freeze({ ...input.order, tax, total, status: input.to, revision: input.order.revision + 1, updatedAt: now });
}

export type CheckoutAttempt = Readonly<{
  id: string;
  orderId: string;
  orderRevision: number;
  provider: string;
  idempotencyKey: string;
  amount: number;
  currency: "USD";
  status: "created" | "redirect_ready" | "completed" | "failed" | "expired";
  providerReference: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export function createCheckoutAttempt(input: {
  id?: string;
  order: CommercialOrder;
  provider: string;
  idempotencyKey: string;
  existing: readonly CheckoutAttempt[];
  now: string;
}): CheckoutAttempt {
  if (input.order.status !== "submitted" || input.order.total === null) throw new Error("Checkout requires a submitted order with a finalized total");
  const provider = input.provider.trim().toLowerCase();
  const idempotencyKey = input.idempotencyKey.trim();
  if (!provider) throw new Error("A checkout provider is required");
  if (idempotencyKey.length < 16 || idempotencyKey.length > 200) throw new Error("A bounded checkout idempotency key is required");
  const duplicate = input.existing.find((attempt) => attempt.provider === provider && attempt.idempotencyKey === idempotencyKey);
  if (duplicate) {
    if (duplicate.orderId !== input.order.id || duplicate.orderRevision !== input.order.revision || duplicate.amount !== input.order.total) {
      throw new Error("Checkout idempotency key conflicts with another order state");
    }
    return duplicate;
  }
  const now = new Date(input.now).toISOString();
  return Object.freeze({
    id: input.id ?? crypto.randomUUID(), orderId: input.order.id, orderRevision: input.order.revision,
    provider, idempotencyKey, amount: input.order.total, currency: input.order.currency,
    status: "created", providerReference: null, createdAt: now, updatedAt: now,
  });
}
