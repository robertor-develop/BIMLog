import assert from "node:assert/strict";
import { approveFieldChecklist, defineFieldChecklist, freezeChecklistForInspection } from "./field-checklist-definition";

const draft = defineFieldChecklist({ templateId: "CHK-PUNCH", projectId: 8, version: 3, title: "Limited punch review", purpose: "punch", items: [{ itemId: "door", prompt: "Door closes without obstruction", evidenceRequired: true }] });
assert.equal(draft.statutoryCertification, false);
assert.throws(() => freezeChecklistForInspection(draft), /approved/);
const approved = approveFieldChecklist(draft, { approvedBy: "quality-lead", approvedAt: "2026-09-28T15:00:00Z" });
const snapshot = freezeChecklistForInspection(approved);
assert.deepEqual(snapshot, { templateId: "CHK-PUNCH", projectId: 8, version: 3, title: "Limited punch review", purpose: "punch", items: [{ itemId: "door", prompt: "Door closes without obstruction", evidenceRequired: true }], statutoryCertification: false });
assert.equal(Object.isFrozen(snapshot), true);
assert.equal(Object.isFrozen(snapshot.items[0]), true);
assert.throws(() => defineFieldChecklist({ templateId: "CHK", projectId: 8, version: 1, title: "Duplicate", purpose: "limited_inspection", items: [{ itemId: "same", prompt: "One", evidenceRequired: false }, { itemId: "same", prompt: "Two", evidenceRequired: false }] }), /unique/);
console.log("C076 versioned limited-use checklist and frozen approved snapshot: PASS");
