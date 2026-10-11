import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const schema=readFileSync(new URL("../../../../lib/db/src/schema/support-cases.ts",import.meta.url),"utf8");
const startup=readFileSync(new URL("../app.ts",import.meta.url),"utf8");
for(const token of ["dataRequestKind:text(\"data_request_kind\")","support_cases_data_request_kind_chk","'export','correction','deletion','restriction'"])assert.ok(schema.includes(token),token);
for(const token of ["ADD COLUMN IF NOT EXISTS data_request_kind text","support_cases_data_request_kind_chk","category = 'data'"])assert.ok(startup.includes(token),token);
console.log("LR082 additive customer data-request schema parity: PASS");
