import assert from "node:assert/strict";
import { makeEdtWorkItemCode, validateEdtPlanNodes, validateEdtPlanWorkItems, type EdtPlanNode, type EdtPlanWorkItem } from "./edt-engine-activation-service";

const nodes: EdtPlanNode[] = [
  { kind: "project", sourceIdentity: "project:53", code: "P53", name: "Project", sequence: 1, snapshot: {} },
  { kind: "contract", sourceIdentity: "contract:c1", parentSourceIdentity: "project:53", code: "C1", name: "Contract", sequence: 1, snapshot: {} },
  { kind: "deliverable", sourceIdentity: "deliverable:d1", parentSourceIdentity: "contract:c1", code: "D1", name: "Deliverable", sequence: 1, snapshot: {} },
  { kind: "location", sourceIdentity: "location:l1", parentSourceIdentity: "deliverable:d1", code: "L1", name: "Level 1", sequence: 1, snapshot: {} },
];
const item: EdtPlanWorkItem = { id: "w1", edtNodeSourceIdentity: "location:l1", contractSourceIdentity: "contract:c1", locationIdentity: "location:l1", locationSnapshot: {}, tradeIdentity: "HVAC", tradeSnapshot: {}, deliverableTypeIdentity: "deliverable:d1", deliverableTypeSnapshot: {}, displayCode: makeEdtWorkItemCode({project:nodes[0],contract:nodes[1],deliverable:nodes[2],location:nodes[3],tradeIdentity:"HVAC"}) };
validateEdtPlanNodes(nodes);
assert.doesNotThrow(() => validateEdtPlanWorkItems(nodes, [item]));
for (const invalid of [
  { ...item, edtNodeSourceIdentity: "project:53" },
  { ...item, edtNodeSourceIdentity: "deliverable:d1" },
  { ...item, locationIdentity: "location:other" },
]) assert.throws(() => validateEdtPlanWorkItems(nodes, [invalid]), (error: unknown) => error instanceof Error && "code" in error && error.code === "EDT_PLAN_INCOMPLETE");
console.log("EDT_ENGINE_BUILD316_RESULT=PASS Work Items bind to their own location leaf");
