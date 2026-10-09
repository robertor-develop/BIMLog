import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync("artifacts/bimlog/src/pages/Dashboard.tsx", "utf8");
const statCard = readFileSync("artifacts/bimlog/src/components/dashboard/StatCard.tsx", "utf8");
const css = readFileSync("artifacts/bimlog/src/index.css", "utf8");
const primaryKpis = dashboard.slice(
  dashboard.indexOf('aria-labelledby="headquarters-operational-snapshot"'),
  dashboard.indexOf('aria-controls="headquarters-operational-details"'),
);

assert.match(statCard, /<button[\s\S]*type="button"[\s\S]*data-assistant-context="true"/);
assert.match(statCard, /actionLabel: string/);
assert.match(statCard, /className="kpi-action"/);
assert.match(primaryKpis, /Your operational snapshot/);
assert.match(primaryKpis, /Live workspace data/);
assert.match(primaryKpis, /setLocation\("\/pending\?type=rfis"\)/);
assert.match(primaryKpis, /setLocation\("\/pending\?type=submittals"\)/);
assert.doesNotMatch(primaryKpis, /projects\?\.\[0\]/);
assert.match(dashboard, /aria-controls="headquarters-project-controls"/);
assert.match(dashboard, /hidden=\{!showProjectControls\}/);
assert.match(dashboard, /aria-controls="headquarters-test-guidance"/);
assert.match(dashboard, /hidden=\{!showTestGuidance\}/);
assert.match(css, /\.kpi-card-action:focus-visible/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

console.log("Headquarters daily clarity Block 1 acceptance: PASS");
