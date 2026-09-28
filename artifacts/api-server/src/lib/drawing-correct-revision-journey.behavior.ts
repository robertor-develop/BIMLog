import assert from "node:assert/strict";
import { resolveCorrectDrawingJourney } from "./drawing-correct-revision-journey";

const rows = [
  { drawingId: "DR-1", sheetKey: "A-101", revisionCode: "1", issueDate: "2026-01-01", current: false, viewerUrl: "/drawings/DR-1" },
  { drawingId: "DR-2", sheetKey: "A-101", revisionCode: "2", issueDate: "2026-02-01", current: true, viewerUrl: "/drawings/DR-2" },
];
const stale = resolveCorrectDrawingJourney({ requestedDrawingId: "DR-1", revisions: rows });
assert.equal(stale.state, "stale");
if (stale.state === "stale") {
  assert.equal(stale.target.drawingId, "DR-2");
  assert.equal(stale.history.length, 2);
  assert.equal(stale.silentlyReplaced, false);
  assert.match(stale.warning, /historical/);
}
assert.equal(resolveCorrectDrawingJourney({ requestedDrawingId: "DR-2", revisions: rows }).state, "current");
assert.equal(resolveCorrectDrawingJourney({ requestedDrawingId: "absent", revisions: rows }).state, "missing");
assert.equal(resolveCorrectDrawingJourney({ requestedDrawingId: "DR-1", revisions: rows.map(row => ({ ...row, current: false })) }).state, "no-current-revision");
console.log("C065 correct-sheet journey warns on stale identity and preserves explicit history/context: PASS");
