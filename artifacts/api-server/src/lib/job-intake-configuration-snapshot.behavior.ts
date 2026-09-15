import assert from "node:assert/strict";
import fs from "node:fs";

const intake = fs.readFileSync(new URL("./job-intake-service.ts", import.meta.url), "utf8");
const operations = fs.readFileSync(new URL("./job-operations-service.ts", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../../../bimlog/src/pages/JobOperationsWorkspace.tsx", import.meta.url), "utf8");

assert.match(intake, /configurationSnapshot:[\s\S]*deliveryMethod:[\s\S]*budgetGovernancePolicy:/);
assert.match(operations, /ji\.activation_summary/);
assert.match(operations, /configurationSnapshot: access\.configurationSnapshot/);
assert.match(ui, /Activated project configuration/);
assert.match(ui, /Configuración activada del proyecto/);
assert.match(ui, /Read-only evidence captured by Job Intake/);
console.log("job-intake-configuration-snapshot: PASS");
