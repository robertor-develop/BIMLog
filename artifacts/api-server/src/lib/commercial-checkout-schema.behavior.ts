import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const schema=readFileSync(new URL("../../../../lib/db/src/schema/commercial-subscriptions.ts",import.meta.url),"utf8");
for(const token of ["commercial_provider_bindings","commercial_checkout_attempts","commercial_provider_bindings_company_provider_uidx","commercial_provider_bindings_customer_uidx","commercial_checkout_attempts_company_key_uidx","commercial_checkout_attempts_provider_session_uidx","requestFingerprint","expiresAt"])assert.ok(schema.includes(token),token);
assert.match(schema,/environment.*test.*live/s);
console.log("B214 provider binding and idempotent checkout attempt authority: PASS");
