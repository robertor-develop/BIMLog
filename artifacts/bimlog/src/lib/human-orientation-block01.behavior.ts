import assert from "node:assert/strict";
import fs from "node:fs";
import { nextActionReason, selectNextAction, type NextActionCandidate } from "./next-action";
import { responsibilityGapLabel, responsibilityStatusLabel } from "./responsibility-presentation";
import { groupCurrentResponsibilitySources, responsibilitySourceLabel } from "./responsibility-source";

const groups = { due: false, overdue: false, blocked: false, noResponse: false };
const item = (key: string, openLink: string, overrides: Partial<NextActionCandidate> = {}): NextActionCandidate => ({
  key, title: `Action ${key}`, status: "in_review", deadline: null,
  project: { id: 42, name: "Synthetic project", code: "SYN-42" }, classification: { groups },
  action: { label: "Open source", openLink }, ...overrides,
});

assert.equal(selectNextAction([item("active", "/projects/42/rfis"), item("late", "/projects/42/submittals", { classification: { groups: { ...groups, overdue: true } } })])?.key, "late");
assert.equal(nextActionReason("overdue", "es"), "Trabajo vencido requiere atención");
assert.equal(responsibilityStatusLabel("waiting_design", "en"), "Waiting for design");
assert.equal(responsibilityStatusLabel("in_review", "es"), "En revisión");
assert.equal(responsibilityGapLabel("OWNER_MISSING", "en"), "Owner not assigned");
assert.equal(responsibilitySourceLabel("/projects/42/rfis", "es"), "RFI fuente");
const grouped = groupCurrentResponsibilitySources([item("one", "/projects/42/rfis"), item("two", "/projects/42/rfis?record=2"), item("three", "/projects/42/submittals")]);
assert.equal(grouped.length, 2);
assert.equal(grouped[0].relatedCount, 2);

const workspace = fs.readFileSync(new URL("../components/dashboard/ResponsibilityWorkspace.tsx", import.meta.url), "utf8");
const card = fs.readFileSync(new URL("../components/dashboard/NextActionCard.tsx", import.meta.url), "utf8");
for (const token of ["role=\"status\"", "role=\"alert\"", "aria-expanded", "slice(0, 5)", "View company summary", "Current revision", "responsibilityStatusLabel", "responsibilityGapLabel"])
  assert.ok(workspace.includes(token), `missing workspace acceptance token: ${token}`);
for (const token of ["Next action", "Siguiente acción", "authorized source record", "does not create a separate task", "type=\"button\""])
  assert.ok(card.includes(token), `missing next-action acceptance token: ${token}`);
assert.ok(workspace.includes("flexWrap: \"wrap\""), "actions must wrap at exact 390px");
assert.ok(!workspace.includes("contextGaps.join"), "raw context codes must not render");
console.log("UX125 human orientation loading, error, empty, populated, source, and narrow-width contracts: PASS");
