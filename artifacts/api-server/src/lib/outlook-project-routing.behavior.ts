import assert from "node:assert/strict";
import { routeOutlookMessage } from "./outlook-project-routing";

const base = { internetMessageId: "message@example", conversationId: "conversation-1" };
assert.deepEqual(routeOutlookMessage({ ...base, candidates: [] }), { status: "review_required", reason: "no_project_match" });
assert.equal(routeOutlookMessage({ ...base, candidates: [{ projectId: 7, companyId: 3, matchedBy: "project_reference", matchedValue: "BIM-007" }] }).status, "routed");
assert.equal(routeOutlookMessage({ ...base, candidates: [{ projectId: 7, companyId: 3, matchedBy: "project_reference", matchedValue: "BIM-007" }, { projectId: 8, companyId: 3, matchedBy: "dedicated_mailbox", matchedValue: "p8@example.com" }] }).status, "review_required");
const duplicateEvidence = routeOutlookMessage({ ...base, candidates: [{ projectId: 7, companyId: 3, matchedBy: "project_reference", matchedValue: "BIM-007" }, { projectId: 7, companyId: 3, matchedBy: "dedicated_mailbox", matchedValue: "p7@example.com" }] });
assert.equal(duplicateEvidence.status, "routed");
console.log("outlook project routing behavior: PASS");
