import assert from "node:assert/strict";
import { recordCompositeQcDecision } from "./composite-qc";

const base = { compositeManifestId: "composite-1", projectId: 7, companyId: 3, reviewerUserId: 11, reviewedAt: "2026-09-09T13:00:00Z", checks: [{ key: "federation-open", result: "pass", blocking: true, evidenceRevisionIds: ["evidence-1"], note: "Opened and inspected" }], decision: "approve", decisionReason: "All required checks passed" } as const;
assert.equal(recordCompositeQcDecision(base).decision, "approve");
assert.throws(() => recordCompositeQcDecision({ ...base, checks: [{ ...base.checks[0], result: "fail" }] }));
assert.throws(() => recordCompositeQcDecision({ ...base, checks: [{ ...base.checks[0], evidenceRevisionIds: [] }] }));
assert.equal(recordCompositeQcDecision({ ...base, checks: [{ ...base.checks[0], result: "fail" }], decision: "reject", decisionReason: "Blocking coordination failure" }).decision, "reject");
console.log("composite QC behavior: PASS");
