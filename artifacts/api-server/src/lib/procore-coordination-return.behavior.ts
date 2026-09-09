import assert from "node:assert/strict";
import { ProcoreReturnConflict, stageProcoreCoordinationReturn } from "./procore-coordination-return";

const value = { id: "return-1", projectId: 7, companyId: 3, procoreProjectId: "pc-7", compositeManifestId: "composite-1", compositeRevision: 2, compositeSha256: "a".repeat(64), qcDecisionId: "qc-1", qcDecision: "approve", destination: { kind: "document", providerRecordId: "folder-1" }, requestedByUserId: 11, approval: { approvedByUserId: 12, approvedAt: "2026-09-09T14:00:00Z" }, idempotencyKey: "return:7:composite-1:2" } as const;
assert.equal(stageProcoreCoordinationReturn(value, null).result, "staged");
assert.equal(stageProcoreCoordinationReturn(value, value).result, "idempotent");
assert.throws(() => stageProcoreCoordinationReturn({ ...value, compositeSha256: "b".repeat(64) }, value), ProcoreReturnConflict);
assert.throws(() => stageProcoreCoordinationReturn({ ...value, qcDecision: "reject" }, null));
console.log("procore coordination return behavior: PASS");
