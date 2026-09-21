import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const matrixPath = path.join(root, "evidence/stabilization-program-20260919/ENDPOINT_AUTHORITY_MATRIX.json");
const generated = spawnSync(process.execPath, [path.join(root, "scripts/endpoint-authority-matrix.mjs")], { cwd: root, encoding: "utf8" });
assert.equal(generated.status, 0, generated.stderr || generated.stdout);
const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
assert.ok(matrix.endpointCount >= 500, "complete API route inventory required");
assert.equal(matrix.missingAuthentication.length, 0);
assert.equal(matrix.missingProjectAuthority.length, 0);
for (const surface of ["files.ts", "reports.ts", "clash_reports.ts", "feedback.ts", "ai-control-plane.ts"]) {
  assert.ok(matrix.endpoints.some((entry) => entry.file === surface), `missing sensitive surface ${surface}`);
}
const sensitive = spawnSync(process.execPath, [path.join(root, "scripts/test-post120-build209-sensitive-operations.mjs")], { cwd: root, encoding: "utf8" });
assert.equal(sensitive.status, 0, sensitive.stderr || sensitive.stdout);
console.log(`POST120_BLOCK42=PASS endpoints=${matrix.endpointCount} auth=complete project=complete sensitive=5`);
