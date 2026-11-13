import assert from "node:assert/strict";
import {
  assertLensIssueCanReceiveResponse,
  lensIssueResponseFingerprint,
  lensIssueReviewOutcome,
  LENS_ISSUE_RESPONSE_NEXT_STATUS,
  LensIssueResponseError,
  parseLensIssueResponseDraft,
  parseLensIssueReviewDraft,
} from "./lens-issue-response";

const parsed = parseLensIssueResponseDraft({
  contractVersion: "lens-issue-response.v1",
  clientRequestId: "5bc3d398-065b-4ddd-a13f-07be5d3817a7",
  mutationVersion: 7,
  outcome: "recommend_reassignment",
  response: "The duct cannot move because the rated shaft blocks that route.",
  recommendedCompany: "Plumbing Partner",
});
assert.equal(parsed.outcome, "recommend_reassignment");
assert.equal(parsed.recommendedCompany, "Plumbing Partner");
assert.equal(LENS_ISSUE_RESPONSE_NEXT_STATUS, "under_review");
assert.equal("status" in parsed, false, "A contractor response must not accept an arbitrary status");
assert.equal("resolved" in parsed, false, "A contractor response must never close the issue");
assert.equal(lensIssueResponseFingerprint(parsed), lensIssueResponseFingerprint(parseLensIssueResponseDraft({ ...parsed })), "Unchanged retries must have stable identity");

assert.throws(
  () => parseLensIssueResponseDraft({ ...parsed, recommendedCompany: null }),
  (error: unknown) => error instanceof LensIssueResponseError && error.code === "LENS_ISSUE_RESPONSE_COMPANY_REQUIRED",
);

const review = parseLensIssueReviewDraft({ contractVersion: "lens-issue-response-review.v1", responseId: 9, mutationVersion: 8, decision: "reassign", reason: "Plumbing owns the available route.", responsibleCompany: "Plumbing Partner" });
assert.deepEqual(lensIssueReviewOutcome(review.decision), { issueStatus: "follow_up", reviewStatus: "reassigned" });
assert.deepEqual(lensIssueReviewOutcome("resolve"), { issueStatus: "resolved", reviewStatus: "accepted" });
assert.deepEqual(lensIssueReviewOutcome("waiting_design"), { issueStatus: "waiting_design", reviewStatus: "returned" });
assert.throws(() => parseLensIssueReviewDraft({ ...review, decision: "resolve", responsibleCompany: "Other" }), (error: unknown) => error instanceof LensIssueResponseError && error.code === "LENS_ISSUE_REVIEW_COMPANY_FORBIDDEN");
assert.throws(
  () => parseLensIssueResponseDraft({ ...parsed, outcome: "completed_work", recommendedCompany: "Other" }),
  (error: unknown) => error instanceof LensIssueResponseError && error.code === "LENS_ISSUE_RESPONSE_COMPANY_FORBIDDEN",
);
assert.throws(
  () => parseLensIssueResponseDraft({ ...parsed, status: "resolved" }),
  (error: unknown) => error instanceof LensIssueResponseError && error.code === "LENS_ISSUE_RESPONSE_INVALID",
);

assert.doesNotThrow(() => assertLensIssueCanReceiveResponse({ lifecycleStatus: "active", status: "open", responsibleCompany: "Sheet Metal", actorCompany: "sheet metal", elevated: false }));
assert.doesNotThrow(() => assertLensIssueCanReceiveResponse({ lifecycleStatus: "active", status: "follow_up", responsibleCompany: "Sheet Metal", actorCompany: "Coordinator", elevated: true }));
assert.throws(
  () => assertLensIssueCanReceiveResponse({ lifecycleStatus: "active", status: "open", responsibleCompany: "Sheet Metal", actorCompany: "Plumbing", elevated: false }),
  (error: unknown) => error instanceof LensIssueResponseError && error.code === "LENS_ISSUE_RESPONSE_FORBIDDEN",
);
assert.throws(
  () => assertLensIssueCanReceiveResponse({ lifecycleStatus: "active", status: "resolved", responsibleCompany: "Sheet Metal", actorCompany: "Sheet Metal", elevated: false }),
  (error: unknown) => error instanceof LensIssueResponseError && error.code === "LENS_ISSUE_ALREADY_RESOLVED",
);

console.log("Lens contractor response contract keeps answered issues open for coordinator review: PASS");
