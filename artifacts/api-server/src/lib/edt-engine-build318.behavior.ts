import assert from "node:assert/strict";
import { makeEdtWorkItemCode, validateEdtPlanWorkItems, type EdtPlanNode, type EdtPlanWorkItem } from "./edt-engine-activation-service";

const nodes: EdtPlanNode[] = [
  { kind: "project", sourceIdentity: "project:53", code: "QA-53", name: "Project", sequence: 1, snapshot: {} },
  { kind: "contract", sourceIdentity: "contract:1", parentSourceIdentity: "project:53", code: "C-01", name: "Contract", sequence: 1, snapshot: {} },
  { kind: "deliverable", sourceIdentity: "deliverable:sleeve", parentSourceIdentity: "contract:1", code: "SLEEVE", name: "Sleeves", sequence: 1, snapshot: {} },
  { kind: "location", sourceIdentity: "location:floor-2", parentSourceIdentity: "deliverable:sleeve", code: "L2", name: "Level 2", sequence: 1, snapshot: {} },
];
const source = { project: nodes[0], contract: nodes[1], deliverable: nodes[2], location: nodes[3], tradeIdentity: "HVAC" };
const code = makeEdtWorkItemCode(source);
assert.match(code, /^WI-QA-53-C-01-SLEEVE-L2-HVAC-[A-F0-9]{10}$/);
assert.equal(code, makeEdtWorkItemCode(source));
assert.notEqual(code, makeEdtWorkItemCode({ ...source, tradeIdentity: "PLUMBING" }));
const item: EdtPlanWorkItem = { id: "w1", edtNodeSourceIdentity: "location:floor-2", contractSourceIdentity: "contract:1", locationIdentity: "location:floor-2", locationSnapshot: {}, tradeIdentity: "HVAC", tradeSnapshot: {}, deliverableTypeIdentity: "deliverable:sleeve", deliverableTypeSnapshot: {}, displayCode: code };
validateEdtPlanWorkItems(nodes, [item]);
assert.throws(() => validateEdtPlanWorkItems(nodes, [{ ...item, displayCode: "MANUAL-CODE" }]), (error: unknown) => error instanceof Error && "code" in error && error.code === "EDT_CODE_INVALID");
assert.throws(() => makeEdtWorkItemCode({ ...source, tradeIdentity: "---" }), (error: unknown) => error instanceof Error && "code" in error && error.code === "EDT_CODE_INVALID");
console.log("EDT_ENGINE_BUILD318_RESULT=PASS visible codes derive deterministically from immutable Work Item identities");
