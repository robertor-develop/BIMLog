import assert from "node:assert/strict";
import fs from "node:fs";

const dashboard = fs.readFileSync(new URL("../artifacts/bimlog/src/pages/Dashboard.tsx", import.meta.url), "utf8");
const today = fs.readFileSync(new URL("../artifacts/bimlog/src/components/dashboard/TodayWorkspace.tsx", import.meta.url), "utf8");
const pulse = fs.readFileSync(new URL("../artifacts/bimlog/src/components/dashboard/OperationalPulse.tsx", import.meta.url), "utf8");

const todayPosition = dashboard.indexOf("<TodayWorkspace");
const pulsePosition = dashboard.indexOf("<OperationalPulse");
assert.ok(todayPosition > 0 && pulsePosition > todayPosition, "Today must precede Operational Pulse");

for (const token of ["operational-pulse__disclosure", "aria-controls=\"operational-pulse-details\"", "hidden={!expanded}"])
  assert.ok(pulse.includes(token), `Operational Pulse disclosure missing ${token}`);

for (const token of ["Continue recent work", "Continuar trabajo reciente", "aria-controls=\"today-recent-work\"", "!action || showRecent"])
  assert.ok(today.includes(token), `Today recent-work disclosure missing ${token}`);

for (const token of ["showResponsibilities", "headquarters-responsibility-workspace", "showResponsibilities && <ResponsibilityWorkspace"])
  assert.ok(dashboard.includes(token), `Responsibility disclosure missing ${token}`);

for (const token of ["More Headquarters tools", "Más herramientas de Sede", "headquarters-secondary-workspace", "hidden={!showSecondaryWorkspace}"])
  assert.ok(dashboard.includes(token), `Secondary workspace disclosure missing ${token}`);

assert.ok(dashboard.includes("@media (max-width: 720px)"), "narrow-width containment must remain explicit");
console.log("Progressive disclosure Block 1 acceptance: PASS");
