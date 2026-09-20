import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "../..");
const evidenceRoot = path.join(root, "evidence/stabilization-program-20260919");
for (let build = 111; build <= 115; build += 1) {
  const found = fs.readdirSync(evidenceRoot).find((name) => name.startsWith(`BUILD_${build}_`));
  assert.ok(found, `missing Build ${build} evidence`);
}
const acceptance = fs.readFileSync(path.join(evidenceRoot, "BUILD_115_RELEASE_CANDIDATE_ACCEPTANCE.md"), "utf8");
assert.match(acceptance, /P0=0/);
assert.match(acceptance, /P1=0/);
assert.match(acceptance, /Build 119/);
assert.match(acceptance, /push-only/i);
console.log("block23 build115 frozen release-candidate acceptance: PASS p0=0 p1=0");

