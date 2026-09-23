import assert from "node:assert/strict";
import { makeEdtWorkItemCode, validateEdtPlanNodes, validateEdtPlanWorkItems, type EdtPlanNode, type EdtPlanWorkItem } from "./edt-engine-activation-service";

const nodes: EdtPlanNode[] = [
  { kind: "project", sourceIdentity: "p", code: "P", name: "Project", sequence: 1, snapshot: {} },
  { kind: "contract", sourceIdentity: "c1", parentSourceIdentity: "p", code: "C1", name: "Contract 1", sequence: 1, snapshot: {} },
  { kind: "deliverable", sourceIdentity: "d1", parentSourceIdentity: "c1", code: "D1", name: "Sleeve", sequence: 1, snapshot: {} },
  { kind: "location", sourceIdentity: "l1", parentSourceIdentity: "d1", code: "L1", name: "Floor 1", sequence: 1, snapshot: {} },
  { kind: "contract", sourceIdentity: "c2", parentSourceIdentity: "p", code: "C2", name: "Contract 2", sequence: 2, snapshot: {} },
  { kind: "deliverable", sourceIdentity: "d2", parentSourceIdentity: "c2", code: "D2", name: "Model", sequence: 1, snapshot: {} },
  { kind: "location", sourceIdentity: "l2", parentSourceIdentity: "d2", code: "L2", name: "Floor 2", sequence: 1, snapshot: {} },
];
const item: EdtPlanWorkItem = { id: "w1", edtNodeSourceIdentity: "l1", contractSourceIdentity: "c1", locationIdentity: "l1", locationSnapshot: {}, tradeIdentity: "HVAC", tradeSnapshot: {}, deliverableTypeIdentity: "d1", deliverableTypeSnapshot: {}, displayCode: makeEdtWorkItemCode({project:nodes[0],contract:nodes[1],deliverable:nodes[2],location:nodes[3],tradeIdentity:"HVAC"}) };
validateEdtPlanNodes(nodes);
assert.doesNotThrow(() => validateEdtPlanWorkItems(nodes, [item]));
for (const invalid of [
  { ...item, contractSourceIdentity: "c2" },
  { ...item, deliverableTypeIdentity: "d2" },
  { ...item, contractSourceIdentity: "" },
]) assert.throws(() => validateEdtPlanWorkItems(nodes, [invalid]), (error: unknown) => error instanceof Error && "code" in error && error.code === "EDT_PLAN_INCOMPLETE");
console.log("EDT_ENGINE_BUILD317_RESULT=PASS Work Item contract and deliverable bind to leaf ancestry");
