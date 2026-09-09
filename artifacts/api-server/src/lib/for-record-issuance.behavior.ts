import assert from "node:assert/strict";
import { proposeForRecordIssuance } from "./for-record-issuance";

const input = { id: "issuance-1", projectId: 7, companyId: 3, coordinationFileId: "file-1", revisionId: "revision-2", observedCurrentRevisionId: "revision-2", contentSha256: "a".repeat(64), qcDecisionId: "qc-1", qcDecision: "approve", issuePurpose: "Approved coordination record", recipients: [{ contactId: 30, companyId: 20, deliveryChannel: "email" }], approvedByUserId: 11, approvedAt: "2026-09-09T16:00:00Z", status: "proposed" } as const;
assert.equal(proposeForRecordIssuance(input).status, "proposed");
assert.throws(() => proposeForRecordIssuance({ ...input, observedCurrentRevisionId: "revision-3" }));
assert.throws(() => proposeForRecordIssuance({ ...input, recipients: [input.recipients[0], input.recipients[0]] }));
assert.throws(() => proposeForRecordIssuance({ ...input, qcDecision: "reject" }));
console.log("for record issuance behavior: PASS");
