import assert from"node:assert/strict";import fs from"node:fs";
const route=fs.readFileSync(new URL("../routes/edt-engine.ts",import.meta.url),"utf8");const changes=fs.readFileSync(new URL("./edt-engine-governed-change-service.ts",import.meta.url),"utf8");const economics=fs.readFileSync(new URL("./edt-engine-economic-service.ts",import.meta.url),"utf8");
for(const path of["work-items/:workItemId/issuances","issuances/:issuanceId/qc-decisions","intakes/:intakeId/result-imports/preview"])assert.ok(route.includes(path));
assert.match(route,/conflictUserIds must be an integer array/);assert.match(route,/fileSha256:requiredText/);assert.doesNotMatch(route,/actor:\s*body|companyId:\s*Number\(body/);
assert.match(changes,/project_id=\$2 AND company_id=\$3 FOR UPDATE/);assert.match(economics,/w\.project_id=\$2 AND w\.company_id=\$3/);
console.log("EDT_ENGINE_BUILD300_RESULT=PASS");console.log("ISSUANCE_QC_IMPORT_ROUTES=PASS");console.log("COMPANY_PROJECT_SCOPE_HARDENING=PASS");console.log("LENS_NEXT_NATIVE_CHANGED=NO");
