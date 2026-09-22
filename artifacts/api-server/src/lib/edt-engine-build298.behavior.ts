import assert from"node:assert/strict";import fs from"node:fs";const route=fs.readFileSync(new URL("../routes/edt-engine.ts",import.meta.url),"utf8");
assert.match(route,/edt-engine\/change-requests", authMiddleware/);assert.match(route,/change-requests\/:requestId\/decision", authMiddleware/);
for(const action of["redistribute_work_item","redistribute_contract","extra_hours","code_correction","split_work_item","reopen_work_item"])assert.ok(route.includes(action));
assert.match(route,/outcome!=="approved"&&outcome!=="rejected"/);assert.doesNotMatch(route,/companyId:.*body\.companyId/);
console.log("EDT_ENGINE_BUILD298_RESULT=PASS");console.log("GOVERNED_CHANGE_ROUTES=PASS");
