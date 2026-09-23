import assert from "node:assert/strict";
import { validateEdtPlanNodes, type EdtPlanNode } from "./edt-engine-activation-service";

const nodes: EdtPlanNode[] = [
  { kind: "project", sourceIdentity: "p", code: "P", name: "Project", sequence: 1, snapshot: {} },
  { kind: "contract", sourceIdentity: "c1", parentSourceIdentity: "p", code: "C-1", name: "Contract 1", sequence: 1, snapshot: {} },
  { kind: "contract", sourceIdentity: "c2", parentSourceIdentity: "p", code: "c-1", name: "Contract 2", sequence: 2, snapshot: {} },
];
assert.throws(() => validateEdtPlanNodes(nodes), (error: unknown) => error instanceof Error && "code" in error && error.code === "EDT_CODE_INVALID");
validateEdtPlanNodes([{ ...nodes[0] }, { ...nodes[1] }, { ...nodes[2], code: "C-2" }]);
console.log("EDT_ENGINE_BUILD328_RESULT=PASS sibling EDT codes are unambiguous");
