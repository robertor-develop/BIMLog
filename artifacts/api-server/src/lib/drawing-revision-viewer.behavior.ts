import assert from "node:assert/strict";
import { prepareDrawingRevisionComparison } from "./drawing-revision-viewer";

const base = { tenantId: 31, projectId: 26, drawingId: "DR-1", fileId: 10, revisionCode: "1", mimeType: "application/pdf", downloadUrl: "/files/10/download" };
const comparison = prepareDrawingRevisionComparison({ tenantId: 31, projectId: 26, authorized: true, left: { ...base, previewUrl: "/files/10/preview" }, right: { ...base, drawingId: "DR-2", fileId: 11, revisionCode: "2", previewUrl: null, downloadUrl: "/files/11/download" } });
assert.equal(comparison.left.previewState, "available");
assert.equal(comparison.right.previewState, "missing");
assert.equal(comparison.mutationAllowed, false);
assert.equal(comparison.right.originalDownloadPreserved, true);
assert.throws(() => prepareDrawingRevisionComparison({ tenantId: 31, projectId: 99, authorized: true, left: base, right: base }), /DRAWING_COMPARISON_SCOPE_DENIED/);
assert.throws(() => prepareDrawingRevisionComparison({ tenantId: 31, projectId: 26, authorized: false, left: base, right: base }), /DRAWING_COMPARISON_NOT_AUTHORIZED/);
const unsupported = prepareDrawingRevisionComparison({ tenantId: 31, projectId: 26, authorized: true, left: { ...base, mimeType: "application/dwg" }, right: base });
assert.equal(unsupported.left.previewState, "unsupported");
console.log("C062 authorized side-by-side revision viewing preserves explicit preview limits and original downloads: PASS");
