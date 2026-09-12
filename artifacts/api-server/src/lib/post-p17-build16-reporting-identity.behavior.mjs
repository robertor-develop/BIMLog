import assert from "node:assert/strict";
import fs from "node:fs";
const service = fs.readFileSync(new URL("./job-operations-service.ts", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../../../bimlog/src/pages/JobOperationsWorkspace.tsx", import.meta.url), "utf8");
for (const field of ["projectName", "projectCode", "clientCompany", "contractName", "contractType", "reportingStatus", "lifecycleStatus", "quotationNumber", "contractNumber", "apuPlanVersions"]) assert.match(service, new RegExp(field));
assert.match(ui, /Contract reporting identity/);
assert.match(ui, /contract\.contractNumber \|\| contract\.quotationNumber/);
assert.match(ui, /contract\.reportingStatus/);
console.log("POST-P17 Build 16 reporting identity: PASS");
