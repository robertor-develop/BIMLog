import assert from "node:assert/strict";
import { reviewTradeFileSubmission } from "./trade-file-submission-review";

const submission = { id: "submission-1", collectionRequestId: "request-1", requestedArtifactKey: "mechanical-model", submitterCompanyId: 20, submitterContactId: 30, revisionNumber: 1, fileName: "coordination.ifc", byteSize: 42, sha256: "a".repeat(64), malwareScan: "clean", receivedAt: "2026-09-09T12:00:00Z" } as const;
assert.equal(reviewTradeFileSubmission({ submission, expectedExtensions: [".ifc"], reviewerUserId: 11, decision: "accept", reason: "Complete and verified" }).decision, "accepted");
assert.throws(() => reviewTradeFileSubmission({ submission: { ...submission, malwareScan: "pending" }, expectedExtensions: [".ifc"], reviewerUserId: 11, decision: "accept", reason: "Too early" }));
assert.throws(() => reviewTradeFileSubmission({ submission: { ...submission, fileName: "coordination.exe" }, expectedExtensions: [".ifc"], reviewerUserId: 11, decision: "accept", reason: "Wrong format" }));
assert.equal(reviewTradeFileSubmission({ submission: { ...submission, malwareScan: "blocked" }, expectedExtensions: [".ifc"], reviewerUserId: 11, decision: "reject", reason: "Security scan blocked file" }).decision, "rejected");
console.log("trade file submission review behavior: PASS");
