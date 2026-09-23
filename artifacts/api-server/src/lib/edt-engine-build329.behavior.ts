import assert from "node:assert/strict";
import { makeEdtWorkItemCode, validateEdtPlanWorkItems, type EdtPlanNode, type EdtPlanWorkItem } from "./edt-engine-activation-service";

const nodes: EdtPlanNode[] = [
  { kind: "project", sourceIdentity: "p", code: "P", name: "Project", sequence: 1, snapshot: {} },
  { kind: "contract", sourceIdentity: "c", parentSourceIdentity: "p", code: "C", name: "Contract", sequence: 1, snapshot: {} },
  { kind: "deliverable", sourceIdentity: "d", parentSourceIdentity: "c", code: "D", name: "Deliverable", sequence: 1, snapshot: { deliverableType: "D" } },
  { kind: "location", sourceIdentity: "l", parentSourceIdentity: "d", code: "L", name: "Level", sequence: 1, snapshot: { workPackageId: "wp-1" } },
];
const item: EdtPlanWorkItem = { id: "wi", edtNodeSourceIdentity: "l", contractSourceIdentity: "c", locationIdentity: "l",
  locationSnapshot: nodes[3].snapshot, tradeIdentity: "trade-1", tradeSnapshot: { id: "trade-1", code: "T" },
  deliverableTypeIdentity: "d", deliverableTypeSnapshot: nodes[2].snapshot,
  displayCode: makeEdtWorkItemCode({ project: nodes[0], contract: nodes[1], deliverable: nodes[2], location: nodes[3], tradeIdentity: "trade-1", tradeCode: "T" }) };
validateEdtPlanWorkItems(nodes, [item]);
for (const changed of [
  { ...item, locationSnapshot: { workPackageId: "foreign" } },
  { ...item, deliverableTypeSnapshot: { deliverableType: "OTHER" } },
  { ...item, tradeSnapshot: { id: "foreign", code: "T" } },
]) assert.throws(() => validateEdtPlanWorkItems(nodes, [changed]), (error: unknown) => error instanceof Error && "code" in error && error.code === "EDT_PLAN_SOURCE_MISMATCH");
console.log("EDT_ENGINE_BUILD329_RESULT=PASS Work Item snapshots cannot contradict hierarchy or trade identity");
