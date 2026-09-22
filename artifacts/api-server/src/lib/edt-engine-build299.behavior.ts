import assert from"node:assert/strict";import fs from"node:fs";const route=fs.readFileSync(new URL("../routes/edt-engine.ts",import.meta.url),"utf8");const service=fs.readFileSync(new URL("./edt-engine-economic-service.ts",import.meta.url),"utf8");
assert.match(route,/edt-engine\/economic-plans",authMiddleware/);assert.match(route,/time-entries\/:entryId\/transition",authMiddleware/);
assert.match(route,/ECONOMIC_PLAN_NOT_SERVER_RESOLVED/);assert.match(route,/TIME_AMOUNT_NOT_SERVER_RESOLVED/);assert.match(service,/authorize\(input\.actor,"JOB_OPERATE",input\.companyId,input\.projectId\)/);
assert.doesNotMatch(route,/actor:\s*body|companyId:\s*Number\(body/);console.log("EDT_ENGINE_BUILD299_RESULT=PASS");console.log("ECONOMIC_TIME_ROUTES=PASS");
