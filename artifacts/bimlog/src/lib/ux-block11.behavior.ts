import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { submittalReviewAction, submittalRevisionFamily, submittalRoundTripSnapshot } from "./submittal-experience";

const original = { id: 10, number: "SUB-010", parentSubmittalId: null, revisionNumber: 0, status: "revise_resubmit", reviewDecision: "revise_resubmit", updatedAt: "2026-09-28T10:00:00Z" };
const revision = { id: 12, number: "SUB-010-R1", parentSubmittalId: 10, revisionNumber: 1, status: "under_review", reviewDecision: null, updatedAt: "2026-09-29T10:00:00Z" };
const unrelated = { id: 20, number: "SUB-020", parentSubmittalId: null, revisionNumber: 0, status: "approved", reviewDecision: "approved", updatedAt: "2026-09-29T11:00:00Z" };

assert.deepEqual(submittalRevisionFamily([revision, unrelated, original], revision).map(item => item.id), [10, 12]);
assert.equal(submittalReviewAction(original), "revise");
assert.equal(submittalReviewAction(revision), "review");
assert.equal(submittalReviewAction(unrelated), "complete");
assert.deepEqual(submittalRoundTripSnapshot(revision), { id: 12, number: "SUB-010-R1", revision: 1, status: "under_review", reviewDecision: "" });

const page = readFileSync(new URL("../pages/project/SubmittalsTab.tsx", import.meta.url), "utf8");
const coverage = readFileSync(new URL("../components/SubmittalRegisterCoverage.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../../../api-server/src/routes/submittals.ts", import.meta.url), "utf8");

assert.match(page, /\["register", w\("Required"/);
assert.match(page, /\["submittals", w\("Received"/);
assert.match(page, /\["tracking", w\("Control"/);
assert.match(page, /submittal-register\/\$\{seed\.requirementId\}\/packages\/\$\{created\.id\}/);
assert.match(page, /Primary related RFI/);
assert.match(page, /revisionFamily\.map/);
assert.match(page, /R\{sub\.revisionNumber \?\? 0\}/);
assert.match(coverage, /coverage, not approval or receipt/);
assert.match(route, /"Revision": s\.revisionNumber \?\? 0/);
assert.match(route, /`R\$\{sub\.revisionNumber \?\? 0\}`/);

console.log("UX_BLOCK11=PASS required=clear received=contextual relationships=purposeful review=read-first round-trip=consistent");
