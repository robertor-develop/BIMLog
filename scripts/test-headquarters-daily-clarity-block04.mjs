import assert from "node:assert/strict";
import fs from "node:fs";

const model = fs.readFileSync("artifacts/bimlog/src/lib/operational-pulse.ts", "utf8");
const behavior = fs.readFileSync("artifacts/bimlog/src/lib/operational-pulse.behavior.ts", "utf8");
const component = fs.readFileSync("artifacts/bimlog/src/components/dashboard/OperationalPulse.tsx", "utf8");
const dashboard = fs.readFileSync("artifacts/bimlog/src/pages/Dashboard.tsx", "utf8");

for (const token of ["recommended: OperationalPulseQueue | null", "queue.count > largest.count", "total === 0", "recommended"])
  assert.ok(model.includes(token), `missing deterministic recommendation contract: ${token}`);
for (const token of ["largest verified workload right now", "la carga verificada más grande en este momento", "does not imply contractual priority or a due date", "no implica prioridad contractual ni fecha de vencimiento", "aria-live=\"polite\""])
  assert.ok(component.includes(token), `missing truthful next-action contract: ${token}`);
for (const token of ["operational-pulse__next > button:focus-visible", "operational-pulse__next > button { width: 100%", "prefers-reduced-motion", "operational-pulse__next > button:hover"])
  assert.ok(dashboard.includes(token), `missing responsive recommendation contract: ${token}`);
assert.ok(behavior.includes("pendingSubmittals: 5"), "tie behavior is not bound");
assert.ok(behavior.includes("recommended: null"), "all-clear behavior is not bound");

console.log("Headquarters daily clarity Block 4 acceptance: PASS");
