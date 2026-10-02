import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {fileURLToPath} from "node:url";
const schema=readFileSync(fileURLToPath(new URL("../../../../lib/db/src/schema/support-cases.ts",import.meta.url)),"utf8"),startup=readFileSync(fileURLToPath(new URL("../app.ts",import.meta.url)),"utf8");
for(const token of ["support_cases","company_id","requester_user_id","category","priority","request_key","fingerprint","status","support_cases_requester_request_key_uidx","support_cases_company_created_idx"]){assert.match(schema,new RegExp(token));assert.match(startup,new RegExp(token));}
console.log("B142 additive support case schema and startup parity: PASS");
