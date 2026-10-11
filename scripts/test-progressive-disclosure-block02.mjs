import assert from "node:assert/strict";
import fs from "node:fs";

const intake = fs.readFileSync(new URL("../artifacts/bimlog/src/pages/JobIntakeWorkspace.tsx", import.meta.url), "utf8");
const destinations = fs.readFileSync(new URL("../artifacts/bimlog/src/lib/job-intake-activation-preview.ts", import.meta.url), "utf8");

for (const token of [
  'hidden={active !== "identity"}',
  'hidden={active !== "contract"}',
  'hidden={active !== "scope"}',
  'hidden={active !== "delivery"}',
  'hidden={active !== "team"}',
  'hidden={active !== "review"}',
]) assert.ok(intake.includes(token), `active-stage disclosure missing ${token}`);

for (const token of [
  "Setup step controls",
  "Controles de pasos de configuración",
  "Previous step",
  "Continue",
  'moveToStage("documents")',
]) assert.ok(intake.includes(token), `guided step movement missing ${token}`);

for (const token of [
  "View optional, staffing, and commercial readiness",
  "ji-readiness-details",
  "ji-readiness-secondary",
]) assert.ok(intake.includes(token), `readiness disclosure missing ${token}`);

for (const token of [
  "Next required action",
  "Go to this field",
  "activeStageMissing.slice(1)",
  "job_name",
  "pricing",
]) assert.ok(intake.includes(token), `contextual requirement guidance missing ${token}`);

for (const token of ["leader: \"team\"", "hours: \"team\"", "leader: \"ji-team\"", "hours: \"ji-team\""])
  assert.ok(destinations.includes(token), `exact team blocker destination missing ${token}`);

for (const token of [
  "More Intake tools",
  "Más herramientas de Ingreso",
  "More guidance for this step",
  "useState(false)",
]) assert.ok(intake.includes(token), `secondary tool disclosure missing ${token}`);

console.log("Progressive disclosure Block 2 acceptance: PASS");
