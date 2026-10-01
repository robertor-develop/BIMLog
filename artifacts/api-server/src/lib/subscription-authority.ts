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
