import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../routes/onboarding.ts",import.meta.url),"utf8");
for(const token of ["LEFT JOIN LATERAL","JOIN project_members member","member.user_id=p.user_id","ORDER BY candidate.created_at,candidate.kind,candidate.record_id LIMIT 1","firstValueEvidence","Boolean(firstValueEvidence)"]) assert.ok(source.includes(token),token);
for(const kind of ["'rfi'::text","'submittal'::text","'file'::text"]) assert.ok(source.includes(kind),kind);
assert.ok(!source.includes("first_value_reached FROM user_onboarding_profiles"));
console.log("Simplification and guided adoption build 021 authoritative first-value evidence: PASS");
