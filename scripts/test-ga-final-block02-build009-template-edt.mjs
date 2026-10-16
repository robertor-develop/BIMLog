import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const tsx = path.resolve("artifacts/api-server/node_modules/tsx/dist/cli.mjs");
for (const file of [
  "artifacts/api-server/src/lib/delivery-workflow-template-contract.behavior.ts",
  "artifacts/api-server/src/lib/delivery-workflow-economic-allocation.behavior.ts",
  "artifacts/api-server/src/lib/edt-engine-block02-acceptance.behavior.ts",
]) execFileSync(process.execPath, [tsx, path.resolve(file)], { stdio: "inherit" });

const workflowRoutes = readFileSync("artifacts/api-server/src/routes/workflow-governance-policies.ts", "utf8");
const edtRoutes = readFileSync("artifacts/api-server/src/routes/edt-engine.ts", "utf8");
assert.match(workflowRoutes, /router\.post\("\/company\/workflow-governance-policies\/:id\/versions\/:versionId\/publish", authMiddleware/);
assert.match(edtRoutes, /router\.get\("\/projects\/:projectId\/edt-engine\/intakes\/:intakeId\/plan-preview", authMiddleware/);
assert.match(edtRoutes, /router\.post\("\/projects\/:projectId\/edt-engine\/activation-requests", authMiddleware/);
assert.match(edtRoutes, /router\.post\("\/projects\/:projectId\/edt-engine\/change-requests", authMiddleware/);
console.log("GA-F02-B009 governed templates and EDT lifecycle: PASS");
