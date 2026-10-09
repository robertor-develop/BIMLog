import assert from "node:assert/strict";
import fs from "node:fs";

const model = fs.readFileSync("artifacts/bimlog/src/lib/operational-pulse-change.ts", "utf8");
const component = fs.readFileSync("artifacts/bimlog/src/components/dashboard/OperationalPulse.tsx", "utf8");
const dashboard = fs.readFileSync("artifacts/bimlog/src/pages/Dashboard.tsx", "utf8");

for (const token of ["increased", "decreased", "unchanged", "safeCount", "current.openRfis"])
  assert.ok(model.includes(token), `missing movement truth contract: ${token}`);
for (const token of ["No change since the last check", "Sin cambios desde la última verificación", "two latest verified counts", "dos últimos conteos verificados"])
  assert.ok(component.includes(token), `missing bilingual movement presentation: ${token}`);
for (const token of ["lastPulseSnapshot", "previousPulseCounts", "prior?.checkedAt === statsUpdatedAt", "previousCounts={previousPulseCounts}"])
  assert.ok(dashboard.includes(token), `missing successive snapshot connection: ${token}`);
for (const token of ["operational-pulse__movement--decreased", "operational-pulse__movement--increased", "role=\"status\"", "aria-live=\"polite\""])
  assert.ok(`${dashboard}\n${component}`.includes(token), `missing movement accessibility or styling: ${token}`);

console.log("Headquarters daily clarity Block 6 acceptance: PASS");
