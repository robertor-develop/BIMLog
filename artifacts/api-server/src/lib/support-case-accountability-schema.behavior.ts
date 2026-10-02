import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {fileURLToPath} from "node:url";
const schema=readFileSync(fileURLToPath(new URL("../../../../lib/db/src/schema/support-cases.ts",import.meta.url)),"utf8"),startup=readFileSync(fileURLToPath(new URL("../app.ts",import.meta.url)),"utf8"),routes=readFileSync(fileURLToPath(new URL("../routes/support-cases.ts",import.meta.url)),"utf8");
for(const token of ["response_due_at","assigned_to_user_id","assigned_at","support_cases_response_due_idx"]){assert.ok(schema.includes(token),token);assert.ok(startup.includes(token),token);}assert.ok(routes.includes("supportResponseDueAt"));
console.log("B152 durable support accountability schema: PASS");
