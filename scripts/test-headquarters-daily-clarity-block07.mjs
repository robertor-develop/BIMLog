import assert from "node:assert/strict";
import fs from "node:fs";

const model = fs.readFileSync("artifacts/bimlog/src/lib/operational-pulse-change.ts", "utf8");
const behavior = fs.readFileSync("artifacts/bimlog/src/lib/operational-pulse-change.behavior.ts", "utf8");
const component = fs.readFileSync("artifacts/bimlog/src/components/dashboard/OperationalPulse.tsx", "utf8");
const dashboard = fs.readFileSync("artifacts/bimlog/src/pages/Dashboard.tsx", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

for (const token of ["OperationalPulseQueueChange", "queues:", "largestMovement", "Math.abs(queue.delta)"])
  assert.ok(model.includes(token), `missing queue movement model: ${token}`);
for (const token of ["largestMovement, null", 'largestMovement?.key, "rfis"', 'key: "files", previous: 14, current: 10, delta: -4'])
  assert.ok(behavior.includes(token), `missing queue movement behavior: ${token}`);
for (const token of ["Changes by queue", "Cambios por cola", "Largest verified change", "Mayor cambio verificado", "operational-pulse__movement-queue--largest"])
  assert.ok(component.includes(token), `missing queue movement presentation: ${token}`);
for (const token of ["grid-template-columns: repeat(3", "font-variant-numeric: tabular-nums", "grid-template-columns: 1fr", "white-space: normal"])
  assert.ok(dashboard.includes(token), `missing responsive queue movement styling: ${token}`);
assert.ok(packageJson.scripts["gate:pre-push"].includes("test:headquarters-daily-clarity-block07"), "Block 7 must remain in the permanent pre-push gate");

console.log("Headquarters daily clarity Block 7 acceptance: PASS");
