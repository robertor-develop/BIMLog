import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
for (const build of ["016", "017", "018", "019"]) assert.match(pkg.scripts[`test:viva-block04-build${build}`], /test-viva-block04-build/);
const evidence = JSON.parse(readFileSync("evidence/viva-whole-platform-closure-20261023-block04.json", "utf8"));
assert.deepEqual(evidence.builds, [16, 17, 18, 19, 20]);
assert.equal(evidence.externalConfiguration.length, 9);
assert.equal(evidence.customerMutation, false);
for (const build of ["016", "017", "018", "019"]) {
  const run = spawnSync("pnpm", ["run", `test:viva-block04-build${build}`], { encoding: "utf8", shell: true, timeout: 180_000 });
  assert.equal(run.status, 0, `${build}\n${run.stdout ?? ""}\n${run.stderr ?? run.error ?? ""}`);
}
console.log("VIVA_BLOCK04_CLOSURE=PASS builds=016,017,018,019,020 external_configuration=9 publication_required=true");
