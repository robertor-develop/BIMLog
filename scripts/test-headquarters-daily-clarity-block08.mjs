import assert from "node:assert/strict";
import fs from "node:fs";

const model = fs.readFileSync("artifacts/bimlog/src/lib/operational-pulse-change.ts", "utf8");
const refresh = fs.readFileSync("artifacts/bimlog/src/lib/operational-pulse-refresh.ts", "utf8");
const component = fs.readFileSync("artifacts/bimlog/src/components/dashboard/OperationalPulse.tsx", "utf8");
const dashboard = fs.readFileSync("artifacts/bimlog/src/pages/Dashboard.tsx", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

for (const token of ["previous: number", "current: number", "previousRfis", "currentRfis"])
  assert.ok(model.includes(token), `missing exact queue comparison value: ${token}`);
for (const token of ["formatOperationalPulseComparisonAt", 'month: "short"', 'day: "numeric"'])
  assert.ok(refresh.includes(token), `missing truthful comparison timestamp: ${token}`);
for (const token of ["previousCheckedAt", "Comparison window", "Ventana comparada", "queue.previous", "queue.current"])
  assert.ok(component.includes(token), `missing queue comparison explanation: ${token}`);
for (const token of ["operational-pulse__movement-window", "operational-pulse__movement-queue-copy", "font-variant-numeric: tabular-nums", "text-overflow: clip"])
  assert.ok(dashboard.includes(token), `missing responsive comparison styling: ${token}`);
assert.ok(packageJson.scripts["gate:pre-push"].includes("test:headquarters-daily-clarity-block08"), "Block 8 must remain in the permanent pre-push gate");

console.log("Headquarters daily clarity Block 8 acceptance: PASS");
