import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {fileURLToPath} from "node:url";
const route=readFileSync(fileURLToPath(new URL("../routes/support-cases.ts",import.meta.url)),"utf8"),schema=readFileSync(fileURLToPath(new URL("../../../../lib/db/src/schema/support-cases.ts",import.meta.url)),"utf8"),app=readFileSync(fileURLToPath(new URL("../app.ts",import.meta.url)),"utf8");
for(const source of [schema,app])for(const token of ["support_case_events","support_case_events_type_chk","support_case_events_case_created_idx"])assert.ok(source.includes(token),token);
assert.match(route,/insert\(supportCaseEventsTable\).*type:"opened"/);assert.ok(route.indexOf("supportCaseEventsTable")<route.indexOf("return row"));
console.log("B182 atomic support opening history: PASS");
