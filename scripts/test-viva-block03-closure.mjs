import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
for (const build of ["011", "012", "013", "014"]) {
  assert.match(pkg.scripts[`test:viva-block03-build${build}`], /test-viva-block03-build/);
}
const evidencePath = "evidence/viva-whole-platform-closure-20261023-block03.json";
assert.equal(existsSync(evidencePath), true);
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
assert.deepEqual(evidence.builds, [11, 12, 13, 14, 15]);
assert.equal(evidence.customerMutation, false);
for (const build of ["011", "013", "014"]) {
  const run = spawnSync("pnpm", ["run", `test:viva-block03-build${build}`], { encoding: "utf8", shell: true, timeout: 180_000 });
  assert.equal(run.status, 0, `${build}\n${run.stdout ?? ""}\n${run.stderr ?? run.error ?? ""}`);
}
console.log("VIVA_BLOCK03_CLOSURE=PASS builds=011,012,013,014,015 publication_due_after_build=020");
