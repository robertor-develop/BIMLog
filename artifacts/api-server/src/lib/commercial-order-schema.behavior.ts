import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const schema=readFileSync(new URL("../../../../lib/db/src/schema/commercial-subscriptions.ts",import.meta.url),"utf8");
for(const token of ["commercial_orders","commercial_orders_company_request_uidx","subtotalCents","taxCents","totalCents","fingerprint","createdByUserId"])assert.ok(schema.includes(token),token);
assert.match(schema,/totalCents.*subtotalCents.*taxCents/s);
assert.doesNotMatch(schema,/numeric\(|decimal\(|float|double precision/i);
console.log("B213 idempotent integer-cent commercial order ledger: PASS");
