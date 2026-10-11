import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {fileURLToPath} from "node:url";
const schema=readFileSync(fileURLToPath(new URL("../../../../lib/db/src/schema/support-cases.ts",import.meta.url)),"utf8"),app=readFileSync(fileURLToPath(new URL("../app.ts",import.meta.url)),"utf8");
for(const source of [schema,app])for(const token of ["support_case_data_request_fulfillments","receipt_reference","decision_state","fingerprint"])assert.ok(source.includes(token),token);
for(const source of [schema,app])assert.ok(source.includes("support_case_data_request_fulfillments_case_uidx"));
assert.ok(!app.includes("DROP TABLE support_case_data_request_fulfillments"));assert.ok(!app.includes("DROP COLUMN receipt_reference"));
console.log("LR092 additive data-request fulfillment ledger: PASS");
