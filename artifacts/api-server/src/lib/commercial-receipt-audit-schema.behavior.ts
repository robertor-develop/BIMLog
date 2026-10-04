import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../../..");
const source=readFileSync(path.join(root,"lib/db/src/schema/commercial-subscriptions.ts"),"utf8");
for(const token of ["commercialProviderReceiptsTable","commercial_provider_receipts","provider_event_reference","payload_digest","raw_payload","signature_verified_at","processing_status","commercialAuditEventsTable","commercial_audit_events","event_digest","previous_event_digest","company_sequence_uidx"])
  assert.ok(source.includes(token),`missing receipt/audit authority ${token}`);
assert.match(source,/commercial_provider_receipts_event_uidx"\)\.on\(table\.provider,table\.providerEventReference\)/);
assert.match(source,/uniqueIndex\("commercial_audit_events_digest_uidx"\)/);
assert.doesNotMatch(source,/export const commercialAudit.*(?:update|delete)/i);
console.log("B219 idempotent provider receipt and immutable commercial audit chain: PASS");
