import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
for (const build of ["021", "022", "023", "024"]) assert.match(pkg.scripts[`test:viva-block05-build${build}`], /test-viva-block05-build/);
const evidence = JSON.parse(readFileSync("evidence/viva-whole-platform-closure-20261023-block05.json", "utf8"));
assert.deepEqual(evidence.builds, [21, 22, 23, 24, 25]);
assert.equal(evidence.customerMutation, false);
assert.equal(evidence.publicationDue, false);
for (const build of ["021", "022", "023", "024"]) {
  const run = spawnSync("pnpm", ["run", `test:viva-block05-build${build}`], { encoding: "utf8", shell: true, timeout: 240_000 });
  assert.equal(run.status, 0, `${build}\n${run.stdout ?? ""}\n${run.stderr ?? run.error ?? ""}`);
}
console.log("VIVA_BLOCK05_CLOSURE=PASS builds=021,022,023,024,025 unpublished_builds=5 publication_due=false");
