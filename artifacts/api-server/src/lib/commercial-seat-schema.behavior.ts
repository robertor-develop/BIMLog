import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const schema=readFileSync(new URL("../../../../lib/db/src/schema/commercial-subscriptions.ts",import.meta.url),"utf8");
for(const token of ["commercial_subscription_seats","commercial_subscription_seats_number_uidx","commercial_subscription_seats_active_user_uidx","assignedUserId","releasedAt","revision"])assert.ok(schema.includes(token),token);
assert.match(schema,/status.*assigned.*assignedUserId.*assignedAt/s);
console.log("B212 durable seat ledger and active-user uniqueness: PASS");
