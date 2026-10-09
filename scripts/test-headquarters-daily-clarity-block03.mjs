import assert from "node:assert/strict";
import fs from "node:fs";

const dashboard = fs.readFileSync("artifacts/bimlog/src/pages/Dashboard.tsx", "utf8");
const component = fs.readFileSync("artifacts/bimlog/src/components/dashboard/OperationalPulse.tsx", "utf8");
const model = fs.readFileSync("artifacts/bimlog/src/lib/operational-pulse.ts", "utf8");

for (const token of ["<OperationalPulse", "openRfis: stats.openRfis", "pendingSubmittals: stats.pendingSubmittals", "filesNeedingAttention: stats.filesNeedingAttention", "onOpen={setLocation}"])
  assert.ok(dashboard.includes(token), `missing dashboard pulse binding: ${token}`);
for (const token of ["Operational pulse", "Pulso operativo", "items need review", "elementos necesitan revisión", "aria-label", "type=\"button\"", "onOpen(queue.href)"])
  assert.ok(component.includes(token), `missing operational pulse contract: ${token}`);
for (const route of ["/pending?type=rfis", "/pending?type=submittals", "/pending?type=files"])
  assert.ok(model.includes(route), `missing operational pulse route: ${route}`);
for (const token of ["@media (max-width: 720px)", "@media (prefers-reduced-motion: reduce)", ".operational-pulse__queue:focus-visible"])
  assert.ok(dashboard.includes(token), `missing operational pulse accessibility contract: ${token}`);

console.log("Headquarters daily clarity Block 3 acceptance: PASS");
