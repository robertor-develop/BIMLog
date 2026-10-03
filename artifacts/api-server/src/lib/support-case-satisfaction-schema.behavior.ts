import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const schema=readFileSync(new URL("../../../../lib/db/src/schema/support-cases.ts",import.meta.url),"utf8"),app=readFileSync(new URL("../app.ts",import.meta.url),"utf8");
for(const token of ["support_case_satisfaction","support_case_satisfaction_rating_chk","support_case_satisfaction_case_uidx","support_case_satisfaction_requester_key_uidx"]) {assert.ok(schema.includes(token));assert.ok(app.includes(token));}
console.log("B202 additive support satisfaction persistence parity: PASS");
