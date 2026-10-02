import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {fileURLToPath} from "node:url";
const route=readFileSync(fileURLToPath(new URL("./support-cases.ts",import.meta.url)),"utf8"),index=readFileSync(fileURLToPath(new URL("./index.ts",import.meta.url)),"utf8");
const supportPath="/support/"+"cases";
for(const token of [`router.get("${supportPath}",authMiddleware`,`router.post("${supportPath}",authMiddleware`,"actor.companyId","actor.userId","SUPPORT_CASE_REQUEST_CONFLICT","private, no-store"] )assert.ok(route.includes(token),token);assert.match(index,/router\.use\(supportCasesRouter\)/);assert.doesNotMatch(route,/apiKey|password|Authorization:`Bearer/);
console.log("B143 authenticated company/requester-scoped support operations: PASS");
