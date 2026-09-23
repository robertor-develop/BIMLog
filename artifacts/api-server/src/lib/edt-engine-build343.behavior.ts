import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateResolvedEdtApprovalIntent } from "./edt-engine-resolved-activation";

const actor = { grants: ["JOB_ACTIVATION_APPROVE"] as const, actorUserId: 8,
  actorCompanyId: 7, actorProjectIds: [11], eligibleRole: "OPERATIONS_DIRECTOR" };
const valid = { actor, companyId: 7, projectId: 11, requesterId: 3,
  expectedFingerprint: "a".repeat(64), reason: "Approved the saved Intake EDT" };
assert.doesNotThrow(() => validateResolvedEdtApprovalIntent(valid));
for (const [change, code] of [
  [{ requesterId: 8 }, "SELF_APPROVAL_PROHIBITED"],
  [{ companyId: 9 }, "COMPANY_SCOPE_REQUIRED"],
  [{ projectId: 12 }, "PROJECT_SCOPE_REQUIRED"],
  [{ actor: { ...actor, grants: [] } }, "PERMISSION_REQUIRED"],
  [{ expectedFingerprint: "stale" }, "EDT_CANDIDATE_STALE"],
  [{ reason: " " }, "REASON_REQUIRED"],
] as const) {
  assert.throws(() => validateResolvedEdtApprovalIntent({ ...valid, ...change }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === code, code);
}
const source = readFileSync(new URL("./edt-engine-resolved-activation.ts", import.meta.url), "utf8");
assert.match(source, /loadEdtActivationCandidate\(client/);
assert.match(source, /candidate\.requestFingerprint !== request\.request_fingerprint/);
assert.match(source, /validateEdtPlanCoverage\(saved\.map/);
assert.match(source, /UPDATE job_activation_work_items SET edt_node_id/);
assert.match(source, /INSERT INTO job_activation_decisions/);
assert.doesNotMatch(source, /nodes:EdtPlanNode\[\]|workItems:EdtPlanWorkItem\[\]/);
console.log("EDT_ENGINE_BUILD343_RESULT=PASS approval intent, separation of duties and server-owned plan boundary");
