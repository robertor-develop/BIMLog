import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),tsx=path.join(root,"artifacts/api-server/node_modules/tsx/dist/cli.mjs");
for(const file of ["commercial-invoice-schema.behavior.ts","commercial-credit-schema.behavior.ts","commercial-dispute-schema.behavior.ts","commercial-receipt-audit-schema.behavior.ts"])
  execFileSync(process.execPath,[tsx,path.join(root,"artifacts/api-server/src/lib",file)],{stdio:"inherit"});
const schema=readFileSync(path.join(root,"lib/db/src/schema/commercial-subscriptions.ts"),"utf8"),migration=readFileSync(path.join(root,"artifacts/api-server/src/lib/commercial-subscription-migration.ts"),"utf8");
for(const table of ["commercial_invoices","commercial_credit_notes","commercial_disputes","commercial_provider_receipts","commercial_audit_events"])
  if(!schema.includes(table)||!migration.includes(table))throw new Error(`schema/startup parity missing ${table}`);
if(/DROP TABLE|TRUNCATE|DELETE FROM/i.test(migration))throw new Error("commercial migration must remain additive");
for(const invariant of ["commercial_invoices_checkout_uidx","commercial_credit_notes_provider_event_uidx","commercial_disputes_provider_ref_uidx","commercial_provider_receipts_event_uidx","commercial_audit_events_company_sequence_uidx","commercial_audit_events_digest_uidx"])
  if(!schema.includes(invariant)||!migration.includes(invariant))throw new Error(`commercial uniqueness parity missing ${invariant}`);
console.log("B220 Block 44 billing evidence persistence and migration parity: PASS");
