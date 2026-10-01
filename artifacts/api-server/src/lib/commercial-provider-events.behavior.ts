import assert from "node:assert/strict";
import crypto from "node:crypto";
import { ingestStripeProviderEvent } from "./commercial-provider-events";
import type { ProviderEventReceipt } from "./subscription-authority";

function verified(rawPayload: string, eventId: string, eventType: string): ProviderEventReceipt {
  return Object.freeze({ provider: "stripe", eventId, eventType, payloadDigest: crypto.createHash("sha256").update(rawPayload).digest("hex"), receivedAt: "2026-10-01T12:00:05.000Z" });
}

const checkoutRaw = JSON.stringify({ id: "evt_036", type: "checkout.session.completed", created: 1790856000, data: { object: { id: "cs_036", customer: "cus_036" } } });
const event036 = ingestStripeProviderEvent({ receipt: verified(checkoutRaw, "evt_036", "checkout.session.completed"), rawPayload: checkoutRaw, existing: [] });
assert.deepEqual({ type: event036.eventType, status: event036.status, object: event036.objectId, customer: event036.customerReference, attempts: event036.attemptCount }, { type: "checkout.session.completed", status: "pending", object: "cs_036", customer: "cus_036", attempts: 0 });
assert.throws(() => ingestStripeProviderEvent({ receipt: verified(checkoutRaw, "evt_036", "checkout.session.completed"), rawPayload: checkoutRaw, existing: [event036] }), /already ingested/);
assert.throws(() => ingestStripeProviderEvent({ receipt: verified(`${checkoutRaw} `, "evt_036", "checkout.session.completed"), rawPayload: checkoutRaw, existing: [] }), /does not match/);

const unknownRaw = JSON.stringify({ id: "evt_unknown", type: "radar.early_fraud_warning.created", created: 1790856000, data: { object: { id: "iss_unknown" } } });
const ignored = ingestStripeProviderEvent({ receipt: verified(unknownRaw, "evt_unknown", "radar.early_fraud_warning.created"), rawPayload: unknownRaw, existing: [] });
assert.equal(ignored.status, "ignored");
assert.equal(ignored.lastErrorCode, "UNSUPPORTED_EVENT_TYPE");

console.log("Commercial provider Block 8 Build 036: PASS");
