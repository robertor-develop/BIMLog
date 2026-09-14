import assert from "node:assert/strict";
import fs from "node:fs";

const service = fs.readFileSync(new URL("./job-intake-service.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../routes/job-intake.ts", import.meta.url), "utf8");

assert.match(service, /classificationScopes/);
assert.match(service, /package:\$\{workPackage\.id\}/);
assert.match(service, /task:\$\{task\.id\}/);
for (const table of ["enterprise_trades", "enterprise_services", "enterprise_phases"]) assert.match(service, new RegExp(table));
assert.match(service, /JOB_INTAKE_CLASSIFICATION_INVALID/);
assert.match(route, /JOB_INTAKE_CLASSIFICATION_INVALID/);
assert.match(service, /'scope-delivery'[\s\S]+discipline_id[\s\S]+service_id[\s\S]+phase_id/);
assert.match(service, /packageClass\.disciplineId/);
assert.match(service, /taskClass\.serviceId/);
console.log("Intake-to-Operations classification activation boundary: PASS");
