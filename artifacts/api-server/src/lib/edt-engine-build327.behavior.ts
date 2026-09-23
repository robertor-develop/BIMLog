import assert from "node:assert/strict";
import { projectActivatedEdtPlan } from "./edt-engine-plan-projection";
import type { ActivatedEdtSource } from "./edt-engine-source-service";

const source: ActivatedEdtSource = { project: { id: 1, code: "P1", name: "Project" }, intake: { id: "i", revision: 2,
  data: { commercial: { contracts: [{ id: "A", contractNumber: "A" }, { id: "B", contractNumber: "B" }] },
    scopeItems: [{ id: "a", contractId: "A", deliverableType: "MODEL", workPackages: [{ id: "wa", dimensionType: "floor", dimensionValue: "L1", classification: { disciplineId: "d", disciplineCode: "HVAC" } }] },
      { id: "b", contractId: "B", deliverableType: "MODEL", workPackages: [{ id: "wb", dimensionType: "floor", dimensionValue: "L2", classification: { disciplineId: "d", disciplineCode: "HVAC" } }] }] },
  activationSummary: { contracts: [{ profileId: "A", contractId: "ca", contractVersionId: "same-version" }, { profileId: "B", contractId: "cb", contractVersionId: "same-version" }] } },
  workItems: [{ id: "ia", stableScopeItemId: "a", contractId: "ca", contractVersionId: "same-version", status: "active" },
    { id: "ib", stableScopeItemId: "b", contractId: "cb", contractVersionId: "same-version", status: "active" }] };
assert.throws(() => projectActivatedEdtPlan(source), (error: unknown) => error instanceof Error && "code" in error && error.code === "EDT_SOURCE_AMBIGUOUS");
console.log("EDT_ENGINE_BUILD327_RESULT=PASS one canonical Contract version cannot bind two Contracts");
