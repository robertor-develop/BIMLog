import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const tsx = "artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for (const file of [
  "artifacts/api-server/src/lib/consolidation-build116-role-isolation.behavior.ts",
  "artifacts/api-server/src/lib/gauntlet-role-matrix.behavior.ts",
  "artifacts/api-server/src/lib/post120-build208-authorization-negative-matrix.behavior.ts",
]) {
  const run = spawnSync(process.execPath, [tsx, file], { encoding: "utf8", timeout: 180_000 });
  assert.equal(run.status, 0, `${file}\n${run.stdout ?? ""}\n${run.stderr ?? run.error ?? ""}`);
}
console.log("VIVA_BLOCK06_BUILD026=PASS role_isolation=true persona_matrix=true negative_authorization=true");
