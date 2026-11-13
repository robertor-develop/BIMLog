import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { lensIssueReviewOutcome, parseLensIssueReviewDraft } from "./lens-issue-response";

const root = path.resolve(import.meta.dirname, "../../../..");
const route = fs.readFileSync(path.join(root, "artifacts/api-server/src/routes/clash_reports.ts"), "utf8");
const ui = fs.readFileSync(path.join(root, "artifacts/bimlog/src/pages/project/LensViewpointsView.tsx"), "utf8");
const start = route.indexOf('router.post("/projects/:projectId/clash-reports/lens-next/issues/:id/responses/review"');
const end = route.indexOf('router.patch("/projects/:projectId/clash-reports/lens-viewpoints/:id"', start);
assert.ok(start > 0 && end > start);
const reviewRoute = route.slice(start, end);

assert.deepEqual(lensIssueReviewOutcome("resolve"), { issueStatus: "resolved", reviewStatus: "accepted" });
assert.deepEqual(lensIssueReviewOutcome("reassign"), { issueStatus: "follow_up", reviewStatus: "reassigned" });
assert.equal(parseLensIssueReviewDraft({ contractVersion: "lens-issue-response-review.v1", responseId: 4, mutationVersion: 8, decision: "follow_up", reason: "Return to contractor with the coordinator direction.", responsibleCompany: null }).decision, "follow_up");
assert.match(reviewRoute, /roleMeta\?\.permission !== "admin"/);
assert.match(reviewRoute, /review_status !== "pending_review"/);
assert.match(reviewRoute, /issue\.status !== LENS_ISSUE_RESPONSE_NEXT_STATUS/);
assert.match(reviewRoute, /mutation_version=\$3/);
assert.match(reviewRoute, /coordinator_response_reviewed/);
assert.match(reviewRoute, /lens_issue_response_reviewed/);
assert.match(reviewRoute, /responsible_company=\$2/);
assert.match(reviewRoute, /await client\.query\("ROLLBACK"\)/);

assert.match(ui, /Coordinator decision/);
assert.match(ui, /Decisión del coordinador/);
assert.match(ui, /Only Resolve closes the issue/);
assert.match(ui, /Solo Resolver cierra la incidencia/);
assert.match(ui, /lens-issue-response-review\.v1/);
assert.match(ui, /await loadViewpoints\(draft\.v\.id\)/);
assert.match(ui, /response\.reviewStatus === "pending_review" && v\.status === "under_review"/);

console.log("Lens coordinator review is admin-gated, atomic, auditable, bilingual, and preserves explicit open/closed outcomes: PASS");
