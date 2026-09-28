import assert from "node:assert/strict";
import { filterDrawingSheetLog, type DrawingSheetLogItem } from "./drawing-sheet-log";

const base = { tenantId: 31, projectId: 26, fileId: 1, fileSha256: "a".repeat(64), sheetKey: "31:26:IFC:A-101", discipline: "ARCH", setCode: "IFC" };
const rows: DrawingSheetLogItem[] = [
  { ...base, drawingId: "old", revisionCode: "1", issueDate: "2026-01-01", current: false },
  { ...base, drawingId: "new", revisionCode: "2", issueDate: "2026-02-01", current: true },
  { ...base, drawingId: "mep", sheetKey: "31:26:IFC:M-101", discipline: "MEP", revisionCode: "1", issueDate: "2026-01-15", current: true },
];
assert.deepEqual(filterDrawingSheetLog(rows, { discipline: "ARCH", currentOnly: true }).map(row => row.drawingId), ["new"]);
assert.deepEqual(filterDrawingSheetLog(rows, { asOf: "2026-01-20", currentOnly: true }).map(row => row.drawingId), ["old", "mep"]);
assert.equal(filterDrawingSheetLog(rows, { revisionCode: "1" }).every(row => row.revisionCode === "1"), true);
assert.throws(() => filterDrawingSheetLog(rows, { asOf: "not-a-date" }), /DRAWING_LOG_AS_OF_INVALID/);
console.log("C061 sheet log filters preserve resolver-compatible latest and historical truth: PASS");
