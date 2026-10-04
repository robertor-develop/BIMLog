import assert from "node:assert/strict";
import crypto from "node:crypto";
import { acceptPersistentStripeWebhook, type CommercialWebhookResult } from "./commercial-provider-webhook";
import type { CommercialQueryClient } from "./commercial-persistence";

const now = new Date("2026-10-04T12:00:00.000Z");
const environment = { STRIPE_SECRET_KEY: "sk_test_example123456789", STRIPE_WEBHOOK_SECRET: "whsec_example123456789", BIMLOG_APP_ORIGIN: "https://bimlog.app" } as NodeJS.ProcessEnv;

function signed(rawPayload: string): string {
  const timestamp = Math.floor(now.getTime() / 1000);
  const digest = crypto.createHmac("sha256", environment.STRIPE_WEBHOOK_SECRET!).update(`${timestamp}.${rawPayload}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}
function checkoutPayload(): string {
  return JSON.stringify({ id: "evt_webhook_231", type: "checkout.session.completed", data: { object: { id: "cs_webhook_231", customer: "cus_webhook_231", metadata: { company_id: "7", order_id: "order-webhook-231", subscription_id: "subscription-webhook-231" } } } });
}
function clientFor(rawPayload: string, options: Readonly<{ replay?: boolean; missingLineage?: boolean }> = {}): Readonly<{ client: CommercialQueryClient; calls: string[] }> {
  const calls: string[] = [], payloadDigest = crypto.createHash("sha256").update(rawPayload).digest("hex");
  const client: CommercialQueryClient = { async query(text) {
    calls.push(text);
    if (text.includes("environment=$1") && text.includes("customer_reference=$2")) return { rows: [{ id: "binding-webhook-231", company_id: 7 }], rowCount: 1 };
    if (text.includes("FROM commercial_provider_bindings") && text.includes("id=$1")) return { rows: [{ id: "binding-webhook-231" }], rowCount: 1 };
    if (text.includes("FROM commercial_provider_receipts") && text.includes("provider_event_reference=$1")) return options.replay ? { rows: [{ id: "receipt-evt_webhook_231", payload_digest: payloadDigest, event_type: "checkout.session.completed" }], rowCount: 1 } : { rows: [], rowCount: 0 };
    if (text.includes("INSERT INTO commercial_provider_receipts")) return { rows: [{ id: "receipt-evt_webhook_231" }], rowCount: 1 };
    if (text.includes("processing_status='processing'") && text.includes("RETURNING id,raw_payload")) return { rows: [{ id: "receipt-evt_webhook_231", raw_payload: rawPayload, payload_digest: payloadDigest }], rowCount: 1 };
    if (text.includes("FROM commercial_checkout_attempts") && text.includes("provider_session_reference=$3")) return options.missingLineage ? { rows: [], rowCount: 0 } : { rows: [{ id: "checkout-webhook-231" }], rowCount: 1 };
    if (text.startsWith("SELECT r.raw_payload")) return { rows: [{ raw_payload: rawPayload, payload_digest: payloadDigest, provider_session_reference: "cs_webhook_231" }], rowCount: 1 };
    if (text.includes("processing_status=$3")) return { rows: [{ id: "receipt-evt_webhook_231", processing_status: options.missingLineage ? "failed" : "ignored" }], rowCount: 1 };
    if (text === "BEGIN" || text === "COMMIT" || text === "ROLLBACK" || text.startsWith("UPDATE commercial_")) return { rows: [], rowCount: null };
    throw new Error(`Unexpected webhook query: ${text}`);
  } };
  return { client, calls };
}
async function accept(rawPayload: string, client: CommercialQueryClient): Promise<CommercialWebhookResult> {
  return acceptPersistentStripeWebhook({ client, environment, rawPayload, signatureHeader: signed(rawPayload), now });
}

const appliedRaw = checkoutPayload(), appliedState = clientFor(appliedRaw);
assert.equal((await accept(appliedRaw, appliedState.client)).outcome, "applied");
assert.ok(appliedState.calls.includes("COMMIT"));
const replayState = clientFor(appliedRaw, { replay: true });
assert.equal((await accept(appliedRaw, replayState.client)).outcome, "replayed");
assert.ok(!replayState.calls.some((query) => query.includes("processing_status='processing'")));
const unsupportedRaw = JSON.stringify({ id: "evt_webhook_unsupported", type: "customer.created", data: { object: { customer: "cus_webhook_231" } } }), unsupportedState = clientFor(unsupportedRaw);
assert.equal((await accept(unsupportedRaw, unsupportedState.client)).outcome, "ignored");
const failedState = clientFor(appliedRaw, { missingLineage: true });
assert.equal((await accept(appliedRaw, failedState.client)).outcome, "failed");
let queried = false;
await assert.rejects(() => acceptPersistentStripeWebhook({ client: { async query() { queried = true; return { rows: [], rowCount: 0 }; } }, environment, rawPayload: appliedRaw, signatureHeader: "t=1,v1=invalid", now }), /timestamp|signature/);
assert.equal(queried, false);
console.log("B235 commercial provider webhook behavior: PASS");
