import crypto from "node:crypto";
import type { ProviderEventReceipt } from "./subscription-authority";

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
