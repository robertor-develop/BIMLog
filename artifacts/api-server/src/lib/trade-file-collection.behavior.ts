import assert from "node:assert/strict";
import { issueTradeFileCollectionRequest, tradeFileCollectionRequestSchema } from "./trade-file-collection";

const draft = { id: "request-1", projectId: 7, companyId: 3, requestingUserId: 11, responsibleCompanyId: 20, responsibleContactId: 30, tradeId: 9, category: "coordination-model", requestedArtifacts: [{ key: "mechanical-model", description: "Current mechanical coordination model", required: true, allowedExtensions: [".ifc", ".nwc"] }], dueAt: "2026-09-12T17:00:00Z", status: "draft" } as const;
assert.equal(issueTradeFileCollectionRequest(draft).status, "issued");
assert.throws(() => issueTradeFileCollectionRequest({ ...draft, status: "issued" }));
assert.throws(() => tradeFileCollectionRequestSchema.parse({ ...draft, requestedArtifacts: [draft.requestedArtifacts[0], draft.requestedArtifacts[0]] }));
console.log("trade file collection behavior: PASS");
