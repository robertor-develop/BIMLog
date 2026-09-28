import assert from "node:assert/strict";
import { acceptedRequirementCreates, previewSpecificationRequirementImport } from "./specification-requirement-preview";

const reviewed = { sourceSectionId: "s1", sourceFileRevisionId: "rev-b", sourcePage: 12, requirementCode: "DUCT-SUB", title: "Duct product data" };
const first = previewSpecificationRequirementImport({ projectId: 8, reviewed: [reviewed, reviewed], existing: [
  { id: "manual-1", projectId: 8, sourceIdentity: null, requirementCode: "MANUAL", manual: true },
] });
assert.deepEqual(first.map(item => item.disposition), ["create", "duplicate"], "duplicate rows in one preview are visible and not created twice");
assert.equal(acceptedRequirementCreates(first).length, 1);
const repeated = previewSpecificationRequirementImport({ projectId: 8, reviewed: [reviewed], existing: [
  { id: "req-1", projectId: 8, sourceIdentity: first[0]!.sourceIdentity, requirementCode: "DUCT-SUB", manual: false },
  { id: "manual-1", projectId: 8, sourceIdentity: null, requirementCode: "MANUAL", manual: true },
] });
assert.equal(repeated[0]?.disposition, "duplicate", "repeat import preserves the existing requirement");
assert.equal(repeated[0]?.existingRequirementId, "req-1");
console.log("C067 reviewed specification requirement preview: PASS");
