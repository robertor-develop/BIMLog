import assert from "node:assert/strict";
import { validateEdtPlanSourceBindings, type EdtPlanWorkItem } from "./edt-engine-activation-service";

const item = { id: "w1", contractSourceIdentity: "canonical-contract-1" } as EdtPlanWorkItem;
assert.doesNotThrow(() => validateEdtPlanSourceBindings([{ id: "w1", contractId: "canonical-contract-1", stableScopeItemId: "scope-1" }], [item]));
for (const row of [
  { id: "w1", contractId: "canonical-contract-2", stableScopeItemId: "scope-1" },
  { id: "w1", contractId: null, stableScopeItemId: "scope-1" },
  { id: "w1", contractId: "canonical-contract-1", stableScopeItemId: "" },
]) assert.throws(() => validateEdtPlanSourceBindings([row], [item]), (error: unknown) => error instanceof Error && "code" in error && error.code === "EDT_PLAN_SOURCE_MISMATCH");
assert.throws(() => validateEdtPlanSourceBindings([], [item]), (error: unknown) => error instanceof Error && "code" in error && error.code === "EDT_PLAN_SOURCE_MISMATCH");
console.log("EDT_ENGINE_BUILD320_RESULT=PASS Work Item plan remains bound to saved canonical Contract and scope");
