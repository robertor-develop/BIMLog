import assert from "node:assert/strict";
import { readPersistentCommercialAuthority, type CommercialQueryClient } from "./commercial-persistence";

const calls: { text: string; values?: readonly unknown[] }[] = [];
const client: CommercialQueryClient = { async query(text, values) {
  calls.push({ text, values });
  if (text.includes("FROM commercial_subscriptions")) return { rows: [{ id: "sub-company-7", company_id: 7, status: "active" }], rowCount: 1 };
  if (text.includes("commercial_subscription_terms")) return { rows: [{ id: "term-1", sequence: 1 }], rowCount: 1 };
  if (text.includes("commercial_subscription_seats")) return { rows: [{ id: "seat-1", seat_number: 1 }], rowCount: 1 };
  if (text.includes("commercial_provider_bindings")) return { rows: [{ id: "binding-1", provider: "stripe" }], rowCount: 1 };
  throw new Error(`Unexpected query: ${text}`);
} };

const authority = await readPersistentCommercialAuthority(client, 7);
assert.equal(authority?.subscription.id, "sub-company-7");
assert.equal(authority?.terms.length, 1);
assert.equal(authority?.seats.length, 1);
assert.equal(authority?.providerBindings.length, 1);
assert.match(calls[0].text, /company_id=\$1/);
assert.deepEqual(calls[2].values, ["sub-company-7", 7]);
assert.rejects(() => readPersistentCommercialAuthority(client, 0), /Company identity/);

console.log("COMMERCIAL_PERSISTENCE_B221=PASS");
