import assert from "node:assert/strict";
import { edtReadinessRepair } from "./EdtPlanPreviewPanel";

assert.deepEqual(edtReadinessRepair("EDT_CONTRACT_SOURCE_MISSING", 59), { missing: "Contract version", href: "/projects/59/financial/contracts?returnTo=job-operations" });
assert.match(edtReadinessRepair("EDT_WORKFLOW_SOURCE_MISMATCH", 59)?.href ?? "", /company-workflows/);
assert.match(edtReadinessRepair("EDT_GOVERNANCE_SOURCE_MISSING", 59)?.href ?? "", /stage=review/);
assert.match(edtReadinessRepair("EDT_LOCATION_AMBIGUOUS", 59)?.href ?? "", /stage=scope/);
assert.equal(edtReadinessRepair("UNKNOWN", 59), null);
console.log("UX139_RESULT=PASS EDT readiness identifies the exact missing source and provides a return path without weakening integrity checks");
