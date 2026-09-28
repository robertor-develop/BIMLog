import assert from "node:assert/strict";
import { buildDrawingRecordLinks, type DrawingRecordLink } from "./drawing-record-links";

const base = { tenantId: 31, projectId: 26, targetProjectId: 26, drawingId: "DR-2", revisionCode: "2", authorized: true };
const links: DrawingRecordLink[] = [
  { ...base, kind: "rfi", targetId: "RFI-10" }, { ...base, kind: "submittal", targetId: "SUB-4" },
  { ...base, kind: "work_item", targetId: "WI-9" }, { ...base, kind: "change_order", targetId: "CO-2" },
  { ...base, kind: "coordination_issue", targetId: "ISS-7" }, { ...base, kind: "lens_viewpoint", targetId: "VP-7" },
];
const result = buildDrawingRecordLinks({ tenantId: 31, projectId: 26, drawingId: "DR-2", revisionCode: "2", links });
assert.equal(result.links.length, 6);
assert.equal(result.links.every(link => !link.copiedRecord), true);
assert.equal(result.workingViewBehaviorChanged, false);
assert.throws(() => buildDrawingRecordLinks({ tenantId: 31, projectId: 26, drawingId: "DR-2", revisionCode: "2", links: [{ ...links[0], targetProjectId: 99 }] }), /DRAWING_LINK_SCOPE_DENIED/);
assert.throws(() => buildDrawingRecordLinks({ tenantId: 31, projectId: 26, drawingId: "DR-2", revisionCode: "2", links: [links[0], links[0]] }), /DRAWING_LINK_DUPLICATE/);
console.log("C063 drawing links preserve project/revision identity without copied records or Working View mutation: PASS");
