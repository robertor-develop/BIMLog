import assert from "node:assert/strict";
import {
  assertLensIssueCanReceiveResponse,
  LENS_ISSUE_RESPONSE_NEXT_STATUS,
  LensIssueResponseError,
  parseLensIssueResponseDraft,
} from "./lens-issue-response";

const parsed = parseLensIssueResponseDraft({
  contractVersion: "lens-issue-response.v1",
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

assert.throws(
  () => parseLensIssueResponseDraft({ ...parsed, recommendedCompany: null }),
  (error: unknown) => error instanceof LensIssueResponseError && error.code === "LENS_ISSUE_RESPONSE_COMPANY_REQUIRED",
);
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
