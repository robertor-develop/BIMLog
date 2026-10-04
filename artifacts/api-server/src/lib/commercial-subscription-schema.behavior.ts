import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const schema=readFileSync(new URL("../../../../lib/db/src/schema/commercial-subscriptions.ts",import.meta.url),"utf8");
for(const token of ["commercial_subscriptions","commercial_subscription_terms","commercial_subscriptions_company_active_uidx","commercial_subscription_terms_sequence_uidx","past_due","canceling"])assert.ok(schema.includes(token),token);
assert.doesNotMatch(schema,/float|real|double precision/i);
console.log("B211 durable subscription and term authority: PASS");
