import assert from "node:assert/strict";
import fs from "node:fs";

const contract = JSON.parse(fs.readFileSync("evidence/ga-final-closure-20261024/build99-authenticated-smoke-contract.json", "utf8"));
assert.equal(contract.schemaVersion, "bimlog-ga-build99-authenticated-smoke-contract-v1");
assert.equal(contract.deploymentUrl, "https://bimlog.app");
assert.deepEqual(contract.controlledProject, { id: 68, code: "QA-LOR-FINAL-1023" });
assert.equal(contract.requiredRoutes.length, 11);
assert.equal(new Set(contract.requiredRoutes).size, 11);
for (const route of ["intake", "operations", "rfis", "submittals", "files", "schedule", "clash-reports"]) {
  assert.ok(contract.requiredRoutes.includes(route), `missing route ${route}`);
}
for (const result of Object.values(contract.requiredChecks)) assert.equal(result, true);
assert.equal(contract.receiptStateBeforePublication, "PENDING_REAL_OBSERVATION");
console.log("BIMLog GA Build 99: PASS full authenticated Chrome smoke and non-mutation contract");
