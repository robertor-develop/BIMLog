import assert from "node:assert/strict";
import { edtReadinessRepair } from "./EdtPlanPreviewPanel";

const operationReturn = encodeURIComponent("/projects/59/operations?taskId=task-7");
assert.deepEqual(edtReadinessRepair("EDT_CONTRACT_SOURCE_MISSING", 59, "task-7"), { missing: "Contract version", href: `/projects/59/financial/contracts?returnTo=${operationReturn}` });
assert.match(edtReadinessRepair("EDT_WORKFLOW_SOURCE_MISMATCH", 59, "task-7")?.href ?? "", new RegExp(`company-workflows.*returnTo=${operationReturn}`));
assert.match(edtReadinessRepair("EDT_GOVERNANCE_SOURCE_MISSING", 59, "task-7")?.href ?? "", new RegExp(`/projects/59/intake\\?stage=review&returnTo=${operationReturn}`));
assert.match(edtReadinessRepair("EDT_LOCATION_AMBIGUOUS", 59, "task-7")?.href ?? "", new RegExp(`/projects/59/intake\\?stage=scope&returnTo=${operationReturn}`));
assert.doesNotMatch(edtReadinessRepair("EDT_LOCATION_AMBIGUOUS", 59, "task-7")?.href ?? "", /job-intake|job-operations/);
assert.equal(edtReadinessRepair("UNKNOWN", 59), null);
console.log("UX139_RESULT=PASS EDT readiness identifies the exact missing source and provides a return path without weakening integrity checks");
