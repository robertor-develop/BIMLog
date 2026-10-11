import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../routes/onboarding.ts",import.meta.url),"utf8");
for(const token of ["acknowledgeFirstValue===true","first_value_seen","FIRST_VALUE_EVIDENCE_REQUIRED","member.user_id=profile.user_id","firstValueAcknowledged:acknowledgeFirstValue"]) assert.ok(source.includes(token),token);
assert.ok(source.indexOf("FIRST_VALUE_EVIDENCE_REQUIRED")<source.indexOf("firstValueAcknowledged:acknowledgeFirstValue"));
console.log("Simplification and guided adoption build 022 verified first-value acknowledgement: PASS");
