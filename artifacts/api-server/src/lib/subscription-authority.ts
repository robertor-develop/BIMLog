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
  | "entitlements.snapshotted"
  | "order.accepted"
  | "checkout.completed"
  | "invoice.issued"
  | "subscription.cancellation_scheduled"
  | "refund.recorded";

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

export type ProviderEventReceipt = Readonly<{
  provider: string;
  eventId: string;
  eventType: string;
  payloadDigest: string;
  receivedAt: string;
}>;

export function verifyAndReceiveProviderEvent(input: {
  provider: string;
  eventId: string;
  eventType: string;
  rawPayload: string;
  signatureHex: string;
  signingSecret: string;
  issuedAtEpochSeconds: number;
  nowEpochSeconds: number;
  priorReceipts: readonly ProviderEventReceipt[];
}): ProviderEventReceipt {
  const provider = input.provider.trim().toLowerCase();
  const eventId = input.eventId.trim();
  const eventType = input.eventType.trim();
  if (!provider || !eventId || !eventType) throw new Error("Provider event identity is required");
  if (!Number.isSafeInteger(input.issuedAtEpochSeconds) || Math.abs(input.nowEpochSeconds - input.issuedAtEpochSeconds) > 300) throw new Error("Provider event timestamp is outside the replay window");
  if (input.priorReceipts.some((receipt) => receipt.provider === provider && receipt.eventId === eventId)) throw new Error("Provider event was already received");
  const expected = crypto.createHmac("sha256", input.signingSecret).update(`${input.issuedAtEpochSeconds}.${input.rawPayload}`).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(input.signatureHex, "hex"); } catch { throw new Error("Provider event signature is invalid"); }
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) throw new Error("Provider event signature is invalid");
  return Object.freeze({
    provider, eventId, eventType,
    payloadDigest: crypto.createHash("sha256").update(input.rawPayload).digest("hex"),
    receivedAt: new Date(input.nowEpochSeconds * 1000).toISOString(),
  });
}

export function applyCheckoutCompletion(input: {
  receipt: ProviderEventReceipt;
  rawPayload: string;
  attempt: CheckoutAttempt;
  order: CommercialOrder;
  subscription: CompanySubscription;
  now: string;
}): Readonly<{ attempt: CheckoutAttempt; order: CommercialOrder; subscription: CompanySubscription }> {
  if (crypto.createHash("sha256").update(input.rawPayload).digest("hex") !== input.receipt.payloadDigest) throw new Error("Provider event payload does not match its receipt");
  if (input.receipt.provider !== input.attempt.provider) throw new Error("Provider event belongs to another checkout provider");
  if (input.receipt.eventType !== "checkout.completed") throw new Error("Provider event does not confirm checkout completion");
  let payload: { checkoutId?: unknown; orderId?: unknown };
  try { payload = JSON.parse(input.rawPayload) as { checkoutId?: unknown; orderId?: unknown }; } catch { throw new Error("Provider event payload is invalid JSON"); }
  if (payload.checkoutId !== input.attempt.id || payload.orderId !== input.order.id) throw new Error("Provider event does not match the checkout order");
  if (input.attempt.orderId !== input.order.id || input.order.subscriptionId !== input.subscription.id) throw new Error("Checkout completion lineage is invalid");
  if (input.attempt.status !== "created" && input.attempt.status !== "redirect_ready") throw new Error("Checkout attempt cannot be completed from its current state");
  if (input.order.status !== "submitted") throw new Error("Checkout completion requires a submitted order");
  if (input.subscription.status !== "pending") throw new Error("Checkout completion requires a pending subscription");
  const now = new Date(input.now).toISOString();
  return Object.freeze({
    attempt: Object.freeze({ ...input.attempt, status: "completed", providerReference: input.receipt.eventId, updatedAt: now }),
    order: transitionCommercialOrder({ order: input.order, to: "accepted", expectedRevision: input.order.revision, now }),
    subscription: transitionSubscription({ subscription: input.subscription, to: "active", expectedRevision: input.subscription.revision, now }),
  });
}

export type CommercialInvoice = Readonly<{
  id: string;
  invoiceNumber: string;
  companyId: number;
  subscriptionId: string;
  orderId: string;
  orderRevision: number;
  checkoutAttemptId: string;
  provider: string;
  providerReference: string;
  currency: "USD";
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  status: "paid";
  issuedAt: string;
  paidAt: string;
}>;

function toCents(value: number, label: string): number {
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || cents < 0 || Math.abs(cents / 100 - value) > Number.EPSILON * 100) {
    throw new Error(`${label} must have no more than two decimal places`);
  }
  return cents;
}

export function createPaidInvoice(input: {
  id?: string;
  invoiceNumber: string;
  completion: Readonly<{ attempt: CheckoutAttempt; order: CommercialOrder; subscription: CompanySubscription }>;
  existing: readonly CommercialInvoice[];
  issuedAt: string;
}): CommercialInvoice {
  const { attempt, order, subscription } = input.completion;
  const invoiceNumber = input.invoiceNumber.trim();
  if (!invoiceNumber) throw new Error("An invoice number is required");
  if (input.existing.some((invoice) => invoice.invoiceNumber === invoiceNumber)) throw new Error("Invoice number already exists");
  if (attempt.status !== "completed" || order.status !== "accepted" || subscription.status !== "active") {
    throw new Error("A paid invoice requires a completed checkout lineage");
  }
  if (attempt.orderId !== order.id || order.subscriptionId !== subscription.id || order.total === null || order.tax === null) {
    throw new Error("Invoice checkout lineage is invalid");
  }
  if (!attempt.providerReference) throw new Error("A provider payment reference is required");
  const subtotalCents = toCents(order.subtotal, "Invoice subtotal");
  const taxCents = toCents(order.tax, "Invoice tax");
  const totalCents = toCents(order.total, "Invoice total");
  if (subtotalCents + taxCents !== totalCents || toCents(attempt.amount, "Checkout amount") !== totalCents) {
    throw new Error("Invoice amount does not match the completed checkout");
  }
  const issuedAt = new Date(input.issuedAt).toISOString();
  return Object.freeze({
    id: input.id ?? crypto.randomUUID(), invoiceNumber, companyId: subscription.companyId,
    subscriptionId: subscription.id, orderId: order.id, orderRevision: order.revision,
    checkoutAttemptId: attempt.id, provider: attempt.provider, providerReference: attempt.providerReference,
    currency: order.currency, subtotalCents, taxCents, totalCents, status: "paid", issuedAt, paidAt: issuedAt,
  });
}

export type SubscriptionTerm = Readonly<{
  subscriptionId: string;
  sequence: number;
  billingCycle: "monthly" | "annual";
  startsAt: string;
  endsAt: string;
  renewsAt: string | null;
  sourceOrderId: string;
  sourceInvoiceId: string;
}>;

function addBillingCycle(start: Date, cycle: "monthly" | "annual"): Date {
  const next = new Date(start);
  const originalDay = start.getUTCDate();
  next.setUTCDate(1);
  if (cycle === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  else next.setUTCFullYear(next.getUTCFullYear() + 1);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(originalDay, lastDay));
  return next;
}

export function createSubscriptionTerm(input: {
  subscription: CompanySubscription;
  invoice: CommercialInvoice;
  priorTerms: readonly SubscriptionTerm[];
  startsAt: string;
  automaticRenewal: boolean;
}): SubscriptionTerm {
  if (input.subscription.status !== "active" || input.invoice.status !== "paid") throw new Error("A subscription term requires active paid authority");
  if (input.invoice.subscriptionId !== input.subscription.id || input.invoice.companyId !== input.subscription.companyId) throw new Error("Subscription term invoice lineage is invalid");
  if (input.priorTerms.some((term) => term.subscriptionId !== input.subscription.id)) throw new Error("Prior term belongs to another subscription");
  const ordered = [...input.priorTerms].sort((a, b) => a.sequence - b.sequence);
  if (ordered.some((term, index) => term.sequence !== index + 1)) throw new Error("Prior subscription term sequence is invalid");
  const starts = new Date(input.startsAt);
  if (!Number.isFinite(starts.getTime())) throw new Error("A valid subscription term start is required");
  const previous = ordered.at(-1);
  if (previous && starts.toISOString() !== previous.endsAt) throw new Error("Renewal term must start at the prior term boundary");
  const ends = addBillingCycle(starts, input.subscription.billingCycle);
  return Object.freeze({
    subscriptionId: input.subscription.id, sequence: ordered.length + 1,
    billingCycle: input.subscription.billingCycle, startsAt: starts.toISOString(), endsAt: ends.toISOString(),
    renewsAt: input.automaticRenewal ? ends.toISOString() : null,
    sourceOrderId: input.invoice.orderId, sourceInvoiceId: input.invoice.id,
  });
}

export type CollectionCase = Readonly<{
  id: string;
  subscriptionId: string;
  termSequence: number;
  status: "retry_scheduled" | "recovered" | "exhausted";
  failedAttempts: number;
  lastProviderEventId: string;
  nextRetryAt: string | null;
  graceEndsAt: string;
  revision: number;
  updatedAt: string;
}>;

export function recordCollectionFailure(input: {
  id?: string;
  subscription: CompanySubscription;
  term: SubscriptionTerm;
  receipt: ProviderEventReceipt;
  existing?: CollectionCase;
  nextRetryAt: string | null;
  graceEndsAt: string;
  now: string;
}): Readonly<{ subscription: CompanySubscription; collection: CollectionCase }> {
  if (input.subscription.status !== "active" && input.subscription.status !== "past_due") throw new Error("Collection failure requires an active or past-due subscription");
  if (input.term.subscriptionId !== input.subscription.id) throw new Error("Collection term belongs to another subscription");
  if (input.receipt.eventType !== "invoice.payment_failed") throw new Error("Provider event does not confirm a collection failure");
  if (input.existing && (input.existing.subscriptionId !== input.subscription.id || input.existing.termSequence !== input.term.sequence)) throw new Error("Collection case lineage is invalid");
  if (input.existing?.lastProviderEventId === input.receipt.eventId) throw new Error("Collection failure event was already applied");
  const now = new Date(input.now);
  const graceEnds = new Date(input.graceEndsAt);
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(graceEnds.getTime()) || graceEnds <= now) throw new Error("Collection grace period must end in the future");
  const nextRetry = input.nextRetryAt === null ? null : new Date(input.nextRetryAt);
  if (nextRetry && (!Number.isFinite(nextRetry.getTime()) || nextRetry <= now || nextRetry >= graceEnds)) throw new Error("Collection retry must fall inside the grace period");
  const failedAttempts = (input.existing?.failedAttempts ?? 0) + 1;
  const subscription = input.subscription.status === "active"
    ? transitionSubscription({ subscription: input.subscription, to: "past_due", expectedRevision: input.subscription.revision, now: now.toISOString() })
    : input.subscription;
  return Object.freeze({
    subscription,
    collection: Object.freeze({
      id: input.existing?.id ?? input.id ?? crypto.randomUUID(), subscriptionId: input.subscription.id,
      termSequence: input.term.sequence, status: nextRetry ? "retry_scheduled" : "exhausted",
      failedAttempts, lastProviderEventId: input.receipt.eventId,
      nextRetryAt: nextRetry?.toISOString() ?? null, graceEndsAt: graceEnds.toISOString(),
      revision: (input.existing?.revision ?? 0) + 1, updatedAt: now.toISOString(),
    }),
  });
}

export type SubscriptionCancellation = Readonly<{
  id: string;
  subscriptionId: string;
  termSequence: number;
  requestedBy: string;
  reason: string;
  requestedAt: string;
  effectiveAt: string;
  status: "scheduled" | "applied";
  appliedAt: string | null;
}>;

export function scheduleSubscriptionCancellation(input: {
  id?: string;
  subscription: CompanySubscription;
  term: SubscriptionTerm;
  requestedBy: string;
  reason: string;
  requestedAt: string;
}): SubscriptionCancellation {
  if (input.subscription.status !== "active" && input.subscription.status !== "past_due") throw new Error("Only an active or past-due subscription can be scheduled for cancellation");
  if (input.term.subscriptionId !== input.subscription.id) throw new Error("Cancellation term belongs to another subscription");
  const requestedBy = input.requestedBy.trim();
  const reason = input.reason.trim();
  if (!requestedBy) throw new Error("A cancellation actor is required");
  if (reason.length < 3 || reason.length > 500) throw new Error("A cancellation reason must be between 3 and 500 characters");
  const requestedAt = new Date(input.requestedAt).toISOString();
  if (requestedAt >= input.term.endsAt) throw new Error("Cancellation must be scheduled before the term ends");
  return Object.freeze({
    id: input.id ?? crypto.randomUUID(), subscriptionId: input.subscription.id, termSequence: input.term.sequence,
    requestedBy, reason, requestedAt, effectiveAt: input.term.endsAt, status: "scheduled", appliedAt: null,
  });
}

export function applyScheduledCancellation(input: {
  subscription: CompanySubscription;
  cancellation: SubscriptionCancellation;
  now: string;
}): Readonly<{ subscription: CompanySubscription; cancellation: SubscriptionCancellation }> {
  if (input.cancellation.subscriptionId !== input.subscription.id) throw new Error("Cancellation belongs to another subscription");
  if (input.cancellation.status !== "scheduled") throw new Error("Cancellation is not scheduled");
  const now = new Date(input.now).toISOString();
  if (now < input.cancellation.effectiveAt) throw new Error("Cancellation effective time has not arrived");
  const subscription = transitionSubscription({ subscription: input.subscription, to: "cancelled", expectedRevision: input.subscription.revision, now });
  return Object.freeze({ subscription, cancellation: Object.freeze({ ...input.cancellation, status: "applied", appliedAt: now }) });
}

export type CommercialCreditNote = Readonly<{
  id: string;
  creditNumber: string;
  invoiceId: string;
  subscriptionId: string;
  provider: string;
  providerEventId: string;
  amountCents: number;
  currency: "USD";
  reason: string;
  status: "partial_refund" | "full_refund";
  issuedAt: string;
}>;

export function createRefundCreditNote(input: {
  id?: string;
  creditNumber: string;
  invoice: CommercialInvoice;
  receipt: ProviderEventReceipt;
  rawPayload: string;
  priorCredits: readonly CommercialCreditNote[];
  reason: string;
  issuedAt: string;
}): CommercialCreditNote {
  const creditNumber = input.creditNumber.trim();
  const reason = input.reason.trim();
  if (!creditNumber) throw new Error("A credit note number is required");
  if (reason.length < 3 || reason.length > 500) throw new Error("A refund reason must be between 3 and 500 characters");
  if (input.priorCredits.some((credit) => credit.creditNumber === creditNumber)) throw new Error("Credit note number already exists");
  if (input.priorCredits.some((credit) => credit.provider === input.receipt.provider && credit.providerEventId === input.receipt.eventId)) throw new Error("Refund event was already applied");
  if (input.priorCredits.some((credit) => credit.invoiceId !== input.invoice.id)) throw new Error("Prior credit belongs to another invoice");
  if (input.receipt.eventType !== "charge.refunded") throw new Error("Provider event does not confirm a refund");
  if (crypto.createHash("sha256").update(input.rawPayload).digest("hex") !== input.receipt.payloadDigest) throw new Error("Refund payload does not match its receipt");
  let payload: { invoiceId?: unknown; amountCents?: unknown };
  try { payload = JSON.parse(input.rawPayload) as { invoiceId?: unknown; amountCents?: unknown }; } catch { throw new Error("Refund payload is invalid JSON"); }
  if (payload.invoiceId !== input.invoice.id || !Number.isSafeInteger(payload.amountCents) || (payload.amountCents as number) <= 0) throw new Error("Refund payload identity or amount is invalid");
  const amountCents = payload.amountCents as number;
  const credited = input.priorCredits.reduce((sum, credit) => sum + credit.amountCents, 0);
  if (credited + amountCents > input.invoice.totalCents) throw new Error("Refund exceeds the paid invoice total");
  return Object.freeze({
    id: input.id ?? crypto.randomUUID(), creditNumber, invoiceId: input.invoice.id,
    subscriptionId: input.invoice.subscriptionId, provider: input.receipt.provider,
    providerEventId: input.receipt.eventId, amountCents, currency: input.invoice.currency, reason,
    status: credited + amountCents === input.invoice.totalCents ? "full_refund" : "partial_refund",
    issuedAt: new Date(input.issuedAt).toISOString(),
  });
}
