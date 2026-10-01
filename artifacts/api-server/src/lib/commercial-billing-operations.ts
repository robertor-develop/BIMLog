import crypto from "node:crypto";
import type { CollectionCase, CommercialCreditNote, CommercialInvoice, CompanySubscription, SubscriptionTerm } from "./subscription-authority";

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

export type CustomerBillingStatement = Readonly<{
  id: string;
  companyId: number;
  subscriptionId: string;
  currency: "USD";
  periodStartsAt: string;
  periodEndsAt: string;
  invoiceIds: readonly string[];
  creditNoteIds: readonly string[];
  paidCents: number;
  creditedCents: number;
  netPaidCents: number;
  status: "paid" | "partially_refunded" | "fully_refunded";
  generatedAt: string;
}>;

export function createCustomerBillingStatement(input: {
  companyId: number;
  subscriptionId: string;
  invoices: readonly CommercialInvoice[];
  credits: readonly CommercialCreditNote[];
  periodStartsAt: string;
  periodEndsAt: string;
  generatedAt: string;
}): CustomerBillingStatement {
  const periodStartsAt = instant(input.periodStartsAt, "Statement period start");
  const periodEndsAt = instant(input.periodEndsAt, "Statement period end");
  if (periodStartsAt >= periodEndsAt) throw new Error("Statement period is invalid");
  if (!input.invoices.length) throw new Error("A billing statement requires at least one paid invoice");
  if (input.invoices.some((invoice) => invoice.companyId !== input.companyId || invoice.subscriptionId !== input.subscriptionId || invoice.status !== "paid" || invoice.currency !== "USD")) throw new Error("Statement invoice lineage is invalid");
  const invoiceIds = new Set(input.invoices.map((invoice) => invoice.id));
  if (invoiceIds.size !== input.invoices.length) throw new Error("Statement contains duplicate invoices");
  if (input.invoices.some((invoice) => invoice.issuedAt < periodStartsAt || invoice.issuedAt >= periodEndsAt)) throw new Error("Statement invoice falls outside the requested period");
  if (input.credits.some((credit) => !invoiceIds.has(credit.invoiceId) || credit.subscriptionId !== input.subscriptionId || credit.currency !== "USD")) throw new Error("Statement credit lineage is invalid");
  const creditIds = new Set(input.credits.map((credit) => credit.id));
  if (creditIds.size !== input.credits.length) throw new Error("Statement contains duplicate credits");
  const paidCents = input.invoices.reduce((sum, invoice) => sum + invoice.totalCents, 0);
  const creditedCents = input.credits.reduce((sum, credit) => sum + credit.amountCents, 0);
  if (creditedCents > paidCents) throw new Error("Statement credits exceed paid invoices");
  const netPaidCents = paidCents - creditedCents;
  return Object.freeze({
    id: crypto.createHash("sha256").update(`${input.companyId}:${input.subscriptionId}:${periodStartsAt}:${periodEndsAt}:${[...invoiceIds].sort().join(",")}:${[...creditIds].sort().join(",")}`).digest("hex"),
    companyId: input.companyId, subscriptionId: input.subscriptionId, currency:"USD", periodStartsAt, periodEndsAt,
    invoiceIds:Object.freeze([...invoiceIds].sort()), creditNoteIds:Object.freeze([...creditIds].sort()), paidCents, creditedCents, netPaidCents,
    status: creditedCents === 0 ? "paid" : netPaidCents === 0 ? "fully_refunded" : "partially_refunded",
    generatedAt: instant(input.generatedAt, "Statement generation time"),
  });
}

export type BillingNotice = Readonly<{
  id: string;
  companyId: number;
  subscriptionId: string;
  collectionCaseId: string;
  collectionAttempt: number;
  kind: "payment_failed" | "retry_scheduled" | "grace_ending" | "collection_exhausted";
  recipientEmail: string;
  locale: "en" | "es";
  status: "prepared" | "cancelled";
  preparedAt: string;
  notBefore: string;
}>;

export function prepareBillingNotice(input: {
  companyId: number;
  subscription: CompanySubscription;
  collection: CollectionCase;
  recipientEmail: string;
  locale: "en" | "es";
  kind: BillingNotice["kind"];
  existing: readonly BillingNotice[];
  now: string;
}): BillingNotice {
  if (input.subscription.companyId !== input.companyId || input.collection.subscriptionId !== input.subscription.id) throw new Error("Billing notice lineage is invalid");
  if (!input.collection.id.trim() || input.collection.failedAttempts < 1) throw new Error("Billing collection state is invalid");
  const recipientEmail = input.recipientEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) throw new Error("Billing notice recipient is invalid");
  const compatible = input.collection.status === "exhausted" ? ["collection_exhausted"] : ["payment_failed", "retry_scheduled", "grace_ending"];
  if (!compatible.includes(input.kind)) throw new Error("Billing notice kind does not match collection state");
  const duplicate = input.existing.find((notice) => notice.collectionCaseId === input.collection.id && notice.collectionAttempt === input.collection.failedAttempts && notice.kind === input.kind);
  if (duplicate) return duplicate;
  if (input.existing.some((notice) => notice.companyId !== input.companyId || notice.subscriptionId !== input.subscription.id)) throw new Error("Existing billing notice belongs to another subscription");
  const now = instant(input.now, "Billing notice preparation time");
  const notBefore = input.kind === "retry_scheduled" && input.collection.nextRetryAt ? input.collection.nextRetryAt : now;
  return Object.freeze({
    id:crypto.createHash("sha256").update(`${input.companyId}:${input.collection.id}:${input.collection.failedAttempts}:${input.kind}`).digest("hex"),
    companyId:input.companyId, subscriptionId:input.subscription.id, collectionCaseId:input.collection.id,
    collectionAttempt:input.collection.failedAttempts, kind:input.kind, recipientEmail, locale:input.locale,
    status:"prepared", preparedAt:now, notBefore,
  });
}

export function cancelBillingNotice(input: { notice: BillingNotice; subscription: CompanySubscription; now: string }): BillingNotice {
  instant(input.now, "Billing notice cancellation time");
  if (input.notice.subscriptionId !== input.subscription.id || input.notice.companyId !== input.subscription.companyId) throw new Error("Billing notice subscription lineage is invalid");
  if (input.notice.status === "cancelled" || input.subscription.status === "past_due") return input.notice;
  return Object.freeze({ ...input.notice, status:"cancelled" });
}

export type BillingOperationsRole = "billing_admin" | "customer_admin" | "support" | "auditor";

export function projectBillingOperations(input: {
  companyId: number;
  subscription: CompanySubscription;
  grant: SubscriptionAccessGrant | null;
  statements: readonly CustomerBillingStatement[];
  notices: readonly BillingNotice[];
  role: BillingOperationsRole;
}): Readonly<{
  subscription: Readonly<{ id: string | null; planId: string; status: CompanySubscription["status"]; revision: number | null }>;
  access: Readonly<{ active: boolean; features: readonly SubscriptionFeature[]; seatLimit: number | null; expiresAt: string | null }>;
  statements: readonly Readonly<{ id: string; periodStartsAt: string; periodEndsAt: string; netPaidCents: number | null; status: CustomerBillingStatement["status"] }>[];
  notices: readonly Readonly<{ id: string | null; kind: BillingNotice["kind"]; status: BillingNotice["status"]; recipientEmail: string | null; notBefore: string }>[];
  canManageBilling: boolean;
}> {
  if (input.subscription.companyId !== input.companyId) throw new Error("Billing operations subscription belongs to another company");
  if (input.grant && (input.grant.companyId !== input.companyId || input.grant.subscriptionId !== input.subscription.id)) throw new Error("Billing operations access grant lineage is invalid");
  if (input.statements.some((statement) => statement.companyId !== input.companyId || statement.subscriptionId !== input.subscription.id)) throw new Error("Billing operations statement lineage is invalid");
  if (input.notices.some((notice) => notice.companyId !== input.companyId || notice.subscriptionId !== input.subscription.id)) throw new Error("Billing operations notice lineage is invalid");
  const financial = input.role === "billing_admin" || input.role === "customer_admin" || input.role === "auditor";
  const identifiers = input.role === "billing_admin" || input.role === "auditor";
  return Object.freeze({
    subscription:Object.freeze({ id:identifiers ? input.subscription.id : null, planId:input.subscription.planId, status:input.subscription.status, revision:identifiers ? input.subscription.revision : null }),
    access:Object.freeze({ active:input.grant?.status === "active", features:input.grant?.features ?? [], seatLimit:input.grant?.seatLimit ?? null, expiresAt:input.grant?.expiresAt ?? null }),
    statements:Object.freeze(input.statements.map((statement) => Object.freeze({ id:statement.id, periodStartsAt:statement.periodStartsAt, periodEndsAt:statement.periodEndsAt, netPaidCents:financial ? statement.netPaidCents : null, status:statement.status }))),
    notices:Object.freeze(input.notices.map((notice) => Object.freeze({ id:identifiers ? notice.id : null, kind:notice.kind, status:notice.status, recipientEmail:input.role === "billing_admin" ? notice.recipientEmail : null, notBefore:notice.notBefore }))),
    canManageBilling:input.role === "billing_admin",
  });
}
