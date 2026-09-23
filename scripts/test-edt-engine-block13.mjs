import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const route = readFileSync("artifacts/api-server/src/routes/edt-engine.ts", "utf8");
const operations = readFileSync("artifacts/bimlog/src/pages/JobOperationsWorkspace.tsx", "utf8");
assert.match(route, /edt-engine\/intakes\/:intakeId\/activation-candidate/);
assert.match(route, /previewEdtActivationCandidate\(\{ companyId: actor\.actorCompanyId, projectId, intakeId \}\)/);
assert.match(route, /ACTIVATION_PLAN_NOT_SERVER_RESOLVED/);
assert.match(route, /ECONOMIC_PLAN_NOT_SERVER_RESOLVED/);
assert.match(route, /TIME_AMOUNT_NOT_SERVER_RESOLVED/);
assert.match(operations, /edt-engine\/intakes\/\$\{encodeURIComponent\(String\(data\.identity\.intakeId\)\)\}\/activation-candidate/);
const matrix = JSON.parse(readFileSync("evidence/stabilization-program-20260919/ENDPOINT_AUTHORITY_MATRIX.json", "utf8"));
const candidate = matrix.endpoints.find(entry => entry.path === "/projects/:projectId/edt-engine/intakes/:intakeId/activation-candidate");
assert.equal(candidate?.authenticated, true);
assert.equal(candidate?.projectScoped, true);
assert.notEqual(candidate?.projectAuthority, "missing");

run("pnpm", ["--filter", "@workspace/api-server", "run", "test:edt-engine-build321"]);
run("pnpm", ["--filter", "@workspace/api-server", "run", "test:edt-engine-build337"]);
run("pnpm", ["--filter", "@workspace/api-server", "run", "test:edt-engine-build335"]);
run("pnpm", ["--filter", "@workspace/bimlog", "run", "test:edt-engine-build334"]);
run("node", ["scripts/endpoint-authority-matrix.mjs"]);
console.log("EDT_ENGINE_BLOCK13_RESULT=PASS read-only candidate, schema, UI and guarded mutations");
