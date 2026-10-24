import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
for (const build of ["026", "027", "028", "029"]) assert.match(pkg.scripts[`test:viva-block06-build${build}`], /test-viva-block06-build/);
const evidence = JSON.parse(readFileSync("evidence/viva-whole-platform-closure-20261023-block06.json", "utf8"));
assert.deepEqual(evidence.builds, [26, 27, 28, 29, 30]);
assert.equal(evidence.publicationDue, true);
assert.equal(evidence.unpublishedBuildsBeforePublication, 10);
for (const build of ["026", "027", "028", "029"]) {
  const run = spawnSync("pnpm", ["run", `test:viva-block06-build${build}`], { encoding: "utf8", shell: true, timeout: 420_000 });
  assert.equal(run.status, 0, `${build}\n${run.stdout ?? ""}\n${run.stderr ?? run.error ?? ""}`);
}
const finalAcceptance = spawnSync("pnpm", ["--dir", "artifacts/api-server", "exec", "tsx", "src/lib/block23-build115-final-acceptance.behavior.ts"], { encoding: "utf8", shell: true, timeout: 180_000 });
assert.equal(finalAcceptance.status, 0, `${finalAcceptance.stdout ?? ""}\n${finalAcceptance.stderr ?? finalAcceptance.error ?? ""}`);
console.log("VIVA_BLOCK06_CLOSURE=PASS builds=026,027,028,029,030 program_builds=30 publication_required=true");
