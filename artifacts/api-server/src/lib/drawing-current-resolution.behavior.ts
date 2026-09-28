import assert from "node:assert/strict";
import { resolveDrawingAsOf, type RegisterRevision } from "./drawing-current-resolution";

const base: RegisterRevision = { tenantId: 31, projectId: 26, drawingId: "BASE-R0", sheetKey: "31:26:IFC:A-101", revisionCode: "0", issueDate: "2026-09-01", recordedAt: "2026-09-01T10:00:00Z", status: "superseded", sourceKind: "base_set" };
const bulletin: RegisterRevision = { ...base, drawingId: "BUL-R1", revisionCode: "1", issueDate: "2026-09-10", recordedAt: "2026-09-10T10:00:00Z", status: "active", sourceKind: "bulletin", bulletinId: "B-01", bulletinInScope: true };
assert.equal(resolveDrawingAsOf({ tenantId: 31, projectId: 26, asOf: "2026-09-15", revisions: [base, bulletin] }).current[0].selected?.drawingId, "BUL-R1");
const withdrawnFromScope = resolveDrawingAsOf({ tenantId: 31, projectId: 26, asOf: "2026-09-15", revisions: [base, { ...bulletin, bulletinInScope: false }] });
assert.equal(withdrawnFromScope.current[0].selected?.drawingId, "BASE-R0");
assert.equal(withdrawnFromScope.current[0].fallbackApplied, true);
assert.equal(withdrawnFromScope.pdfFilteringEquivalent, false);
assert.equal(resolveDrawingAsOf({ tenantId: 31, projectId: 26, asOf: "2026-09-05", revisions: [base, bulletin] }).current[0].selected?.drawingId, "BASE-R0");
console.log("C059 current/as-of drawing resolution preserves bulletin scope fallback semantics: PASS");
