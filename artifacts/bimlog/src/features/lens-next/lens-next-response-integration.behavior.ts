import assert from "node:assert/strict";
import { createLensNextApiClient } from "./lens-next-client.ts";
import { adaptLensNextHistoryResponse } from "./lens-next-model.ts";
import type { LensNextIssue } from "./lens-next-types.ts";

const issue: LensNextIssue = {
  identity: { projectId: 7, serverId: 19, viewpointId: "vp-19", lifecycleStatus: "active", revisionNumber: 1 },
  mutationVersion: 4, publishingAllowed: true, displayId: "ME-019", navisworksGuid: null, bimlogPhysicalId: null,
  issueGroupId: null, note: "Clear access", openItems: null, trade: "HVAC", floor: "L2", responsibleCompany: "BAM",
  reportType: "COORDINATION", priority: 2, status: "open", capturedAt: null, syncedAt: null, supersedesId: null,
  supersedesCode: null, screenshotUrl: null, visualStateAvailable: false, visualStateDigest: null,
};

const calls: Array<{ url: string; body: any }> = [];
const fetchImpl: typeof fetch = async (input, init) => {
  const url = String(input), body = init?.body ? JSON.parse(String(init.body)) : null;
  calls.push({ url, body });
  if (url.endsWith("/responses/review")) return new Response(JSON.stringify({ success: true, response: { id: 31 }, issue: { serverId: 19, status: "follow_up", responsibleCompany: "BAM", mutationVersion: 6 } }), { status: 200, headers: { "content-type": "application/json" } });
  return new Response(JSON.stringify({ success: true, replayed: false, response: { id: 31 }, issue: { serverId: 19, status: "under_review", mutationVersion: 5 } }), { status: 201, headers: { "content-type": "application/json" } });
};
const client = createLensNextApiClient({ token: "test-token", apiBaseUrl: "/api/v1", fetchImpl });
const submitted = await client.submitIssueResponse(issue, { clientRequestId: "11111111-1111-4111-8111-111111111111", outcome: "cannot_complete", response: "Existing access panel blocks the move.", recommendedCompany: null });
assert.deepEqual(submitted, { replayed: false, responseId: 31, status: "under_review", mutationVersion: 5 });
assert.equal(calls[0].body.contractVersion, "lens-issue-response.v1");
assert.equal(calls[0].body.mutationVersion, 4);
const underReview = { ...issue, status: "under_review" as const, mutationVersion: 5 };
const reviewed = await client.reviewIssueResponse(underReview, { responseId: 31, decision: "follow_up", reason: "Return to the assigned contractor with coordination notes.", responsibleCompany: null });
assert.deepEqual(reviewed, { responseId: 31, status: "follow_up", responsibleCompany: "BAM", mutationVersion: 6 });
assert.equal(calls[1].body.contractVersion, "lens-issue-response-review.v1");
assert.equal(calls[1].body.mutationVersion, 5);

const history = adaptLensNextHistoryResponse({ success: true, chain: [{ id: 19, revisionNumber: 1, note: "Clear access", trade: "HVAC", floor: "L2", lifecycleStatus: "active", supersedesId: null, updatedAt: null, createdAt: null }], responses: [{ id: 31, issueId: 19, outcome: "cannot_complete", response: "Existing access panel blocks the move.", recommendedCompany: null, reviewStatus: "pending_review", actorUserId: 44, actorFullName: "Ruben", actorCompanyName: "BAM", reviewerUserId: null, reviewDecision: null, reviewReason: null, reviewedAt: null, createdAt: "2026-11-13T17:00:00.000Z" }], events: [] }, issue.identity);
assert.equal(history.responses.length, 1);
assert.equal(history.responses[0].reviewStatus, "pending_review");
assert.equal(history.responses[0].response, "Existing access panel blocks the move.");

console.log("Lens Next contractor response submit/review/history integration: PASS");
