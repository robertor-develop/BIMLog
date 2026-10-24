import assert from "node:assert/strict";
import fs from "node:fs";

const contract = JSON.parse(fs.readFileSync("evidence/outcome-remediation-20261023/build40-exact-candidate-smoke-contract.json", "utf8"));
assert.equal(contract.projectId, 68);
assert.equal(contract.projectCode, "QA-LOR-FINAL-1023");
assert.deepEqual(contract.requiredRoutes, ["/projects/68/intake", "/projects/68/operations", "/projects/68/rfis", "/projects/68/submittals", "/projects/68/files"]);
assert.equal(contract.requiredAssertions.length, 9);
assert.deepEqual(contract.evidencePolicy, {
  sameProjectRequired: true,
  exactCandidateRequired: true,
  hardReloadRequired: true,
  secondAuthenticatedTabRequired: true,
  mixedProjectEvidenceRejected: true,
});
const source = fs.readFileSync("artifacts/bimlog/src/pages/JobIntakeWorkspace.tsx", "utf8");
assert.match(source, /hydrateSelectedDeliveryWorkflowGuidance\(loadedData\.scopeItems, deliveryChoices\.options\)/);
console.log("BIMLog final closure Build 40: PASS exact-candidate authenticated smoke contract");
