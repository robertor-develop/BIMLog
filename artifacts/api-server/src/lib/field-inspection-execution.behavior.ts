import assert from "node:assert/strict";
import { approveFieldChecklist, defineFieldChecklist, freezeChecklistForInspection } from "./field-checklist-definition";
import { completeFieldInspection, recordInspectionResult, startFieldInspection } from "./field-inspection-execution";

const checklist = freezeChecklistForInspection(approveFieldChecklist(defineFieldChecklist({ templateId: "CHK-1", projectId: 8, version: 1, title: "Limited field check", purpose: "limited_inspection", items: [{ itemId: "support", prompt: "Support installed", evidenceRequired: true }, { itemId: "label", prompt: "Label visible", evidenceRequired: false }] }), { approvedBy: "quality-lead", approvedAt: "2026-09-28T14:00:00Z" }));
let inspection = startFieldInspection({ inspectionId: "INSP-1", projectId: 8, checklist, executorId: "inspector-1", executorRole: "field_inspector" });
assert.throws(() => completeFieldInspection(inspection, "2026-09-28T16:00:00Z"), /Every checklist item/);
assert.throws(() => recordInspectionResult(inspection, { itemId: "support", outcome: "fail", evidenceIds: [], note: "Missing", recordedBy: "inspector-1", recordedAt: "2026-09-28T15:00:00Z" }), /Required evidence/);
assert.throws(() => recordInspectionResult(inspection, { itemId: "support", outcome: "fail", evidenceIds: ["PHOTO-1"], note: "Missing", recordedBy: "other", recordedAt: "2026-09-28T15:00:00Z" }), /assigned/);
inspection = recordInspectionResult(inspection, { itemId: "support", outcome: "fail", evidenceIds: ["PHOTO-1"], note: "Support absent", recordedBy: "inspector-1", recordedAt: "2026-09-28T15:00:00Z" });
assert.throws(() => recordInspectionResult(inspection, { itemId: "label", outcome: "not_applicable", evidenceIds: [], note: null, recordedBy: "inspector-1", recordedAt: "2026-09-28T15:05:00Z" }), /require a reason/);
inspection = recordInspectionResult(inspection, { itemId: "label", outcome: "not_applicable", evidenceIds: [], note: "Equipment not installed", recordedBy: "inspector-1", recordedAt: "2026-09-28T15:05:00Z" });
const completed = completeFieldInspection(inspection, "2026-09-28T16:00:00Z");
assert.equal(completed.state, "completed");
assert.throws(() => recordInspectionResult(completed, { itemId: "label", outcome: "pass", evidenceIds: [], note: null, recordedBy: "inspector-1", recordedAt: "2026-09-28T17:00:00Z" }), /immutable/);
console.log("C077 evidence and role-gated inspection completion: PASS");
