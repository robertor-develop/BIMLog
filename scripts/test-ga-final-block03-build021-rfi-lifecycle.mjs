import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = file => readFileSync(file, "utf8");
const tsx = path.resolve("artifacts/api-server/node_modules/tsx/dist/cli.mjs");
for (const file of [
  "artifacts/api-server/src/lib/rfi-complete-package.behavior.ts",
  "artifacts/api-server/src/lib/post120-build159-rfi-negative-matrix.behavior.ts",
]) execFileSync(process.execPath, [tsx, path.resolve(file)], { stdio: "inherit" });

const routes = read("artifacts/api-server/src/routes/rfis.ts");
for (const contract of [
  /router\.get\("\/projects\/:projectId\/rfis", authMiddleware, requireProjectMember\(\)/,
  /router\.post\("\/projects\/:projectId\/rfis", authMiddleware, requirePermission\("admin", "write"\)/,
  /router\.patch\("\/projects\/:projectId\/rfis\/:rfiId", authMiddleware, requirePermission\("admin", "write"\)/,
  /router\.post\("\/projects\/:projectId\/rfis\/:rfiId\/close", authMiddleware, requirePermission\("admin", "write"\)/,
  /router\.post\("\/projects\/:projectId\/rfis\/:rfiId\/reopen", authMiddleware, requirePermission\("admin", "write"\)/,
  /router\.get\("\/projects\/:projectId\/rfis\/export-pdf", authMiddleware, requireProjectMember\(\)/,
  /router\.get\("\/projects\/:projectId\/rfis\/export-excel", authMiddleware, requireProjectMember\(\)/,
]) assert.match(routes, contract);

// BIMLog's canonical RFI names are submittedToCompany (responsible company),
// assignedToId (assigned user), rfiType (discipline/type), and
// locationDescription (location). Keep the acceptance bound to those persisted
// production fields instead of inventing parallel aliases.
for (const field of ["submittedToCompany", "assignedToId", "rfiType", "locationDescription", "dueDate", "priority", "attachmentsJson", "revisionNumber", "closedAt", "reopenedAt"]) {
  assert.ok(routes.includes(field), `RFI lifecycle is missing ${field}`);
}
assert.match(routes, /rfi\.closed/);
assert.match(routes, /rfi\.reopened/);
assert.match(routes, /aging|daysHeld/i);

const ui = read("artifacts/bimlog/src/pages/project/RfisTab.tsx");
for (const label of ["Submitted To", "Type", "Location", "Date Required", "Priority"]) assert.ok(ui.includes(label), `RFI UI is missing ${label}`);
const actions = read("artifacts/bimlog/src/pages/project/rfi-frontend/rfi-action-presentation.ts");
assert.match(actions, /Close RFI/);
assert.match(actions, /Reopen RFI/);

console.log("GA-F03-B021 RFI full lifecycle: PASS");
