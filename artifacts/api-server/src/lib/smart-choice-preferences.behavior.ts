import assert from "node:assert/strict";
import { addSmartChoiceInContext, normalizeSmartChoiceProfile, preferredEligibleChoices, rankSmartChoices, recordSmartChoiceUse, searchSmartChoices, validWorkflowStatusChoices } from "./smart-choice-preferences";

const catalog = Array.from({ length: 50 }, (_, index) => ({ id: `d-${index + 1}`, code: `D${index + 1}`, name: `Discipline ${index + 1}` }));
const profile = normalizeSmartChoiceProfile({ userId: 7, companyId: 2, pinnedDisciplineIds: ["d-4", "d-2", "d-4"] });
assert.deepEqual(profile.pinnedDisciplineIds, ["d-4", "d-2"]);
assert.deepEqual(preferredEligibleChoices({ eligible: catalog, companyPinnedIds: ["d-1", "foreign"], userPinnedIds: profile.pinnedDisciplineIds }).map(row => row.id), ["d-4", "d-2", "d-1"]);
assert.throws(() => normalizeSmartChoiceProfile({ userId: 7, companyId: 2, pinnedDisciplineIds: Array.from({ length: 9 }, (_, index) => `d-${index}`) }), /At most 8/);
let usage = recordSmartChoiceUse({}, "d-30", "2026-09-29T12:00:00Z");
usage = recordSmartChoiceUse(usage, "d-30", "2026-09-30T12:00:00Z");
usage = recordSmartChoiceUse(usage, "d-20", "2026-09-30T13:00:00Z");
const historical = { id: "historic", code: "OLD", name: "Historical selection" };
const ranked = rankSmartChoices({ eligible: catalog, selected: [historical], pinnedIds: profile.pinnedDisciplineIds, usage, preferredLimit: 6 });
assert.equal(ranked.all[0]?.id, "historic");
assert.ok(ranked.preferred.some(row => row.id === "historic"));
assert.ok(ranked.all.findIndex(row => row.id === "d-30") < ranked.all.findIndex(row => row.id === "d-20"));
assert.equal(ranked.all.length, 51);
const documentTypes = [{ id: "shop", code: "SD", name: "Shop Drawing", aliases: ["fabrication drawing"] }, { id: "rfi", code: "RFI", name: "Request for Information" }, { id: "calc", code: "CALC", name: "Calculation" }];
assert.deepEqual(searchSmartChoices(documentTypes, "fabrication").map(row => row.id), ["shop"]);
assert.deepEqual(searchSmartChoices(documentTypes, "CALC").map(row => row.id), ["calc"]);
const addedDocumentType = addSmartChoiceInContext({ eligible: documentTypes, created: { id: "sketch", code: "sk", name: "Coordination Sketch" }, authorized: true });
assert.equal(addedDocumentType.selectedId, "sketch");
assert.equal(addedDocumentType.eligible.at(-1)?.code, "SK");
assert.throws(() => addSmartChoiceInContext({ eligible: documentTypes, created: { id: "private", code: "X", name: "Unauthorized" }, authorized: false }), /do not have authority/);
const transitions = [
  { id: "review", code: "REV", name: "In review", workflowVersionId: "wf-2", fromStatusIds: ["draft"], allowedRoles: ["coordinator"] },
  { id: "approved", code: "APP", name: "Approved", workflowVersionId: "wf-2", fromStatusIds: ["review"], allowedRoles: ["approver"] },
  { id: "legacy-review", code: "REV", name: "Legacy review", workflowVersionId: "wf-1", fromStatusIds: ["draft"], allowedRoles: ["coordinator"] },
];
assert.deepEqual(validWorkflowStatusChoices({ workflowVersionId: "wf-2", currentStatusId: "draft", role: "Coordinator", transitions, favoriteIds: ["approved", "review"] }).map(row => row.id), ["review"]);
assert.deepEqual(validWorkflowStatusChoices({ workflowVersionId: "wf-2", currentStatusId: "review", role: "approver", transitions, favoriteIds: ["approved"] }).map(row => row.id), ["approved"]);
console.log("UX106_UX109_WORKFLOW_STATUS_CHOICES=PASS");
