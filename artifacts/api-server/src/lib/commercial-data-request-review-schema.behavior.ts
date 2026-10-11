import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const schema=readFileSync(new URL("../../../../lib/db/src/schema/support-cases.ts",import.meta.url),"utf8"),app=readFileSync(new URL("../app.ts",import.meta.url),"utf8");
for(const source of [schema,app])for(const token of ["data_request_state","data_request_reason","data_request_reviewed_by_user_id","data_request_reviewed_at","data_request_fulfilled_at","data_request_reviewed"])assert.ok(source.includes(token),token);
assert.ok(app.includes("SET data_request_state='requested' WHERE data_request_kind IS NOT NULL AND data_request_state IS NULL"));
console.log("LR087 durable customer data-request review state: PASS");
