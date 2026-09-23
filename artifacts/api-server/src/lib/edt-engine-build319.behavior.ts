import assert from "node:assert/strict";
import { validateEdtPlanCoverage, type EdtPlanWorkItem } from "./edt-engine-activation-service";

const item = (id: string) => ({ id } as EdtPlanWorkItem);
assert.doesNotThrow(() => validateEdtPlanCoverage(["a", "b"], [item("b"), item("a")]));
for (const [saved, planned] of [
  [[], []],
  [["a", "b"], [item("a")]],
  [["a"], [item("a"), item("b")]],
  [["a", "a"], [item("a")]],
  [["a", "b"], [item("a"), item("a")]],
] as const) assert.throws(() => validateEdtPlanCoverage(saved, planned), (error: unknown) => error instanceof Error && "code" in error && error.code === "EDT_PLAN_COVERAGE_MISMATCH");
console.log("EDT_ENGINE_BUILD319_RESULT=PASS approval covers exact saved active Work Items");
