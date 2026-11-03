import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const route = readFileSync("artifacts/api-server/src/routes/repairs.ts", "utf8");
const service = readFileSync("artifacts/api-server/src/lib/repair-authority.ts", "utf8");
const ui = readFileSync("artifacts/bimlog/src/components/layout/PageAssistant.tsx", "utf8");

const claim = route.indexOf('router.post("/repair-execution/claim"');
const progress = route.indexOf('router.post("/repair-execution/:id/progress"');
const human = route.indexOf('router.use("/repairs", authMiddleware)');
assert.ok(claim >= 0 && progress > claim && human > progress, "machine execution routes must remain distinct from authenticated human repair routes");
for (const contract of [
  'req.get("x-bimlog-repair-bridge-key")', "BIMLOG_ORION_BRIDGE_KEY", "timingSafeEqual",
  "FOR UPDATE SKIP LOCKED", "scope_digest=$5", "REPAIR_EXECUTION_CONFLICT",
  "state IN ('implementing','testing','deployed','verified','failed')",
]) assert.ok(`${route}\n${service}`.includes(contract), `${contract} must remain in the machine-only execution boundary`);

for (const contract of [
  'api("/api/v1/repairs")', 'api("/api/v1/repairs",{method:"POST"',
  'api(`/api/v1/repairs/${repair.id}/authorize`', "Exact scope digest", "Huella del alcance exacto",
  "Authorize exact repair", "Autorizar reparación exacta", "Status", "Estado",
  'role="alert"', "executionConnected",
]) assert.ok(ui.includes(contract), `${contract} must remain visible through the authenticated human repair surface`);

assert.doesNotMatch(ui, /\/repair-execution\//, "browser users must not receive the bridge credential or call machine execution routes");

const tsx = path.resolve("artifacts/api-server/node_modules/tsx/dist/cli.mjs");
execFileSync(process.execPath, [tsx, path.resolve("artifacts/api-server/src/lib/repair-authority.behavior.ts")], { stdio: "inherit", windowsHide: true });
console.log("P206 repair execution machine boundary, bridge authentication, atomic claim, scoped progress, conflict denial, and separate bilingual human authorization/status UI gates passed.");
