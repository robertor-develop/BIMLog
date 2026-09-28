import assert from "node:assert/strict";
import { matchDrawingRevision, type DrawingRevision } from "./drawing-revision-matching";

const prior: DrawingRevision = { tenantId: 31, projectId: 26, drawingId: "DR-1", fileId: 900, fileSha256: "a".repeat(64), setCode: "IFC", sheetNumber: "A-101", revisionCode: "0", issueDate: "2026-09-01", status: "active" };
const next: DrawingRevision = { ...prior, drawingId: "DR-2", fileId: 901, fileSha256: "b".repeat(64), revisionCode: "1", issueDate: "2026-09-20" };
const review = matchDrawingRevision(next, [prior]);
assert.equal(review.decision, "reviewable_successor");
assert.equal(review.automaticSupersessionAllowed, false);
assert.equal(review.supersedesDrawingId, "DR-1");
assert.equal(prior.status, "active");
assert.equal(matchDrawingRevision(next, [prior, { ...prior, drawingId: "DR-X", fileId: 902 }]).decision, "ambiguous");
assert.equal(matchDrawingRevision({ ...next, issueDate: "2026-08-01" }, [prior]).decision, "older_candidate");
assert.equal(matchDrawingRevision({ ...next, projectId: 99 }, [prior]).decision, "new_sheet");
console.log("C058 revision matching preserves prior bytes/history and blocks automatic ambiguous supersession: PASS");
