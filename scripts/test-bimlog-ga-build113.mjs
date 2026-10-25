import fs from "node:fs";
import assert from "node:assert/strict";
import { runNodeGate } from "./lib/observable-gate-runner.mjs";

for (const artifact of ["artifacts/api-server/dist/index.cjs", "artifacts/api-server/dist/app.mjs", "artifacts/bimlog/dist/public/index.html"]) {
  assert.ok(fs.statSync(artifact).size > 0, `${artifact} must exist and be non-empty`);
}
runNodeGate("scripts/test-local-production-artifact.mjs", { timeout: 300_000 });
console.log("BIMLog GA Build 113: PASS deterministic production artifact and packaged runtime integrity");
