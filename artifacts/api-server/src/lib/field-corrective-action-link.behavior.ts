import assert from "node:assert/strict";
import { approveFieldChecklist, defineFieldChecklist, freezeChecklistForInspection } from "./field-checklist-definition";
import { completeFieldInspection, recordInspectionResult, startFieldInspection } from "./field-inspection-execution";
import { correctiveActionIdentity, ensureCorrectiveAction } from "./field-corrective-action-link";

const checklist = freezeChecklistForInspection(approveFieldChecklist(defineFieldChecklist({ templateId: "CHK-1", projectId: 8, version: 1, title: "Punch", purpose: "punch", items: [{ itemId: "support", prompt: "Support installed", evidenceRequired: true }] }), { approvedBy: "quality-lead", approvedAt: "2026-09-28T14:00:00Z" }));
let inspection = startFieldInspection({ inspectionId: "INSP-1", projectId: 8, checklist, executorId: "inspector-1", executorRole: "field_inspector" });
inspection = recordInspectionResult(inspection, { itemId: "support", outcome: "fail", evidenceIds: ["PHOTO-1"], note: "Missing", recordedBy: "inspector-1", recordedAt: "2026-09-28T15:00:00Z" });
inspection = completeFieldInspection(inspection, "2026-09-28T16:00:00Z");
const first = ensureCorrectiveAction({ inspection, itemId: "support", ownerId: "trade-lead", dueDate: "2026-10-02", createdBy: "quality-lead", createdAt: "2026-09-28T16:05:00Z", existing: [] });
assert.equal(first.created, true);
assert.equal(first.action.actionId, correctiveActionIdentity("INSP-1", "support"));
assert.equal(first.action.originatingInspectionId, "INSP-1");
const retry = ensureCorrectiveAction({ inspection, itemId: "support", ownerId: "another-owner", dueDate: "2026-10-10", createdBy: "quality-lead", createdAt: "2026-09-28T16:06:00Z", existing: [first.action] });
assert.equal(retry.created, false);
assert.strictEqual(retry.action, first.action, "repeated submission returns the canonical action without duplication");
assert.throws(() => ensureCorrectiveAction({ inspection: { ...inspection, results: [{ ...inspection.results[0]!, outcome: "pass" }] }, itemId: "support", ownerId: "trade", dueDate: "2026-10-02", createdBy: "quality", createdAt: "2026-09-28T16:05:00Z", existing: [] }), /failed/);
console.log("C078 idempotent corrective action with originating inspection: PASS");
