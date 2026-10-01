import crypto from "node:crypto";
import { transitionCommercialOrder, transitionSubscription } from "./subscription-authority";
import type { CheckoutAttempt, CommercialOrder, CompanySubscription, ProviderEventReceipt } from "./subscription-authority";

export const STRIPE_COMMERCIAL_EVENT_TYPES = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "charge.refunded",
] as const;

export type StripeCommercialEventType = (typeof STRIPE_COMMERCIAL_EVENT_TYPES)[number];

export type CommercialProviderEvent = Readonly<{
  id: string;
  provider: "stripe";
  providerEventId: string;
  eventType: string;
  payloadDigest: string;
  providerCreatedAt: string;
  receivedAt: string;
  status: "pending" | "ignored" | "applied" | "unresolved";
  objectId: string;
  customerReference: string | null;
  attemptCount: number;
  lastErrorCode: string | null;
  appliedAt: string | null;
}>;

type StripeEventPayload = {
  id?: unknown;
  type?: unknown;
  created?: unknown;
  data?: { object?: { id?: unknown; customer?: unknown } };
};

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function ingestStripeProviderEvent(input: {
  receipt: ProviderEventReceipt;
  rawPayload: string;
  existing: readonly CommercialProviderEvent[];
}): CommercialProviderEvent {
  if (input.receipt.provider !== "stripe") throw new Error("Stripe event intake requires a Stripe receipt");
  if (sha256(input.rawPayload) !== input.receipt.payloadDigest) throw new Error("Stripe event payload does not match its verified receipt");
  if (input.existing.some((event) => event.provider === "stripe" && event.providerEventId === input.receipt.eventId)) throw new Error("Stripe event was already ingested");
  let payload: StripeEventPayload;
  try { payload = JSON.parse(input.rawPayload) as StripeEventPayload; } catch { throw new Error("Stripe event payload is invalid JSON"); }
  if (payload.id !== input.receipt.eventId || payload.type !== input.receipt.eventType) throw new Error("Stripe event identity does not match its verified receipt");
  if (!Number.isSafeInteger(payload.created) || (payload.created as number) < 1) throw new Error("Stripe event creation time is invalid");
  const object = payload.data?.object;
  if (!object || typeof object.id !== "string" || !object.id.trim()) throw new Error("Stripe event object identity is missing");
  const customerReference = typeof object.customer === "string" && object.customer.trim() ? object.customer : null;
  const supported = (STRIPE_COMMERCIAL_EVENT_TYPES as readonly string[]).includes(input.receipt.eventType);
  return Object.freeze({
    id: crypto.randomUUID(), provider: "stripe", providerEventId: input.receipt.eventId,
    eventType: input.receipt.eventType, payloadDigest: input.receipt.payloadDigest,
    providerCreatedAt: new Date((payload.created as number) * 1000).toISOString(), receivedAt: input.receipt.receivedAt,
    status: supported ? "pending" : "ignored", objectId: object.id, customerReference,
    attemptCount: 0, lastErrorCode: supported ? null : "UNSUPPORTED_EVENT_TYPE", appliedAt: null,
  });
}

function appliedEvent(event: CommercialProviderEvent, now: string): CommercialProviderEvent {
  if (event.status !== "pending") throw new Error("Only a pending provider event can be applied");
  return Object.freeze({ ...event, status: "applied", attemptCount: event.attemptCount + 1, lastErrorCode: null, appliedAt: new Date(now).toISOString() });
}

export function applyStripeCheckoutCompleted(input: {
  event: CommercialProviderEvent;
  rawPayload: string;
  attempt: CheckoutAttempt;
  order: CommercialOrder;
  subscription: CompanySubscription;
  now: string;
}): Readonly<{ event: CommercialProviderEvent; attempt: CheckoutAttempt; order: CommercialOrder; subscription: CompanySubscription }> {
  if (input.event.eventType !== "checkout.session.completed" || input.event.status !== "pending") throw new Error("A pending checkout completion event is required");
  if (sha256(input.rawPayload) !== input.event.payloadDigest) throw new Error("Checkout event payload does not match its intake record");
  let payload: { data?: { object?: { id?: unknown; customer?: unknown; subscription?: unknown; payment_status?: unknown; currency?: unknown; amount_total?: unknown; metadata?: Record<string, unknown> } } };
  try { payload = JSON.parse(input.rawPayload); } catch { throw new Error("Checkout event payload is invalid JSON"); }
  const object = payload.data?.object;
  const metadata = object?.metadata;
  if (!object || object.id !== input.event.objectId || object.id !== input.attempt.providerReference) throw new Error("Checkout session identity does not match the prepared attempt");
  if (metadata?.order_id !== input.order.id || metadata?.subscription_id !== input.subscription.id || metadata?.company_id !== String(input.subscription.companyId)) throw new Error("Checkout metadata lineage is invalid");
  if (input.attempt.orderId !== input.order.id || input.order.subscriptionId !== input.subscription.id) throw new Error("Checkout commercial lineage is invalid");
  if (input.attempt.status !== "redirect_ready" || input.order.status !== "submitted" || input.subscription.status !== "pending") throw new Error("Checkout records are not ready for completion");
  if (object.payment_status !== "paid" || object.currency !== input.attempt.currency.toLowerCase() || object.amount_total !== Math.round(input.attempt.amount * 100)) throw new Error("Checkout payment does not match the authorized amount");
  if (typeof object.subscription !== "string" || !object.subscription.startsWith("sub_")) throw new Error("Stripe subscription reference is missing");
  const now = new Date(input.now).toISOString();
  return Object.freeze({
    event: appliedEvent(input.event, now),
    attempt: Object.freeze({ ...input.attempt, status: "completed", updatedAt: now }),
    order: transitionCommercialOrder({ order: input.order, to: "accepted", expectedRevision: input.order.revision, now }),
    subscription: transitionSubscription({ subscription: input.subscription, to: "active", expectedRevision: input.subscription.revision, now }),
  });
}
