import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
const read = file => readFileSync(file, "utf8");
const tsx = path.resolve("artifacts/api-server/node_modules/tsx/dist/cli.mjs");
for (const file of [
  "artifacts/api-server/src/lib/submittal-review-tracking.behavior.ts",
  "artifacts/bimlog/src/lib/post120-block36-submittals.behavior.ts",
]) execFileSync(process.execPath, [tsx, path.resolve(file)], { stdio: "inherit" });
const routes = read("artifacts/api-server/src/routes/submittals.ts");
for (const contract of [
  /router\.get\("\/projects\/:projectId\/submittals", authMiddleware, requireProjectMember\(\)/,
  /router\.post\("\/projects\/:projectId\/submittals", authMiddleware, requirePermission\("admin", "write"\)/,
  /router\.patch\("\/projects\/:projectId\/submittals\/:submittalId", authMiddleware, requirePermission\("admin", "write"\)/,
  /router\.post\("\/projects\/:projectId\/submittals\/:submittalId\/respond", authMiddleware, requirePermission\("admin", "write"\)/,
  /router\.get\("\/projects\/:projectId\/submittals\/export-excel", authMiddleware, requireProjectMember\(\)/,
  /router\.get\("\/projects\/:projectId\/submittals\/tracker-pdf", authMiddleware, requireProjectMember\(\)/,
]) assert.match(routes, contract);
for (const field of ["revisionNumber", "reviewDecision", "attachmentsJson", "dateSubmitted", "dateRequired", "dueDate"]) assert.ok(routes.includes(field), `Submittal lifecycle is missing ${field}`);
const ui = read("artifacts/bimlog/src/pages/project/SubmittalsTab.tsx");
for (const status of ["Required", "Received", "Submitted", "Approved", "Rejected", "Revise and Resubmit"]) assert.ok(ui.toLowerCase().includes(status.toLowerCase()), `Submittal UI is missing ${status}`);
const statusPresentation = read("artifacts/bimlog/src/lib/submittal-status-presentation.ts");
assert.match(statusPresentation, /under_review:[\s\S]*label: "Under Review"/);
assert.match(statusPresentation, /approved_as_noted:[\s\S]*label: "Approved as Noted"/);
console.log("GA-F03-B022 submittal package and revision lifecycle: PASS");
