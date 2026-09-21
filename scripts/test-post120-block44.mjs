import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const json = (relative) => JSON.parse(read(relative));

for (const relative of [
  "evidence/stabilization-program-20260919/BUILD_216_REPOSITORY_CENSUS.md",
  "evidence/stabilization-program-20260919/BUILD_217_FINAL_RECONCILIATION.md",
  "evidence/stabilization-program-20260919/BUILD_218_COMPLETE_GATES.md",
  "evidence/stabilization-program-20260919/BUILD_219_PUBLICATION_CANDIDATE.md",
  "evidence/stabilization-program-20260919/BUILD_220_FINAL_FREEZE_CANDIDATE.md",
]) assert.match(read(relative), /Status: `PASS(?:_SOURCE_CANDIDATE)?`/, `${relative} is not a passing Build 44 record`);

for (const test of ["test-build217-final-reconciliation.mjs", "test-build219-publication-candidate.mjs"]) {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", test)], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

const ledger = json("evidence/stabilization-program-20260919/POST_120_BUILD_LEDGER.json");
assert.equal(ledger.range.completedThrough, 220);
assert.equal(ledger.currentBlock.number, 44);
assert.equal(ledger.currentBlock.builds, "216-220");
assert.equal(ledger.currentBlock.status, "SOURCE_ACCEPTED_AWAITING_PUSH_PUBLICATION");
assert.equal(ledger.remainingBuilds, 0);
assert.equal(ledger.unpublishedBuilds, 10);
assert.equal(ledger.nextBlock, "NONE — stabilization program source complete");
assert.equal(ledger.nextPush, 220);
assert.equal(ledger.nextPublication, 220);
assert.equal(ledger.nativeOrInstallerChanged, false);
assert.equal(ledger.databaseOrSchemaChanged, false);

const openLoop = read("living-brief/OPEN_LOOP.md");
assert.equal((openLoop.match(/CURRENT_OPEN_LOOP_AUTHORITY/g) ?? []).length, 1);
assert.match(openLoop, /Build 220 must pass the exact complete gate, push both authoritative refs, publish/);

console.log("POST120_BLOCK44=PASS completed=220 remaining=0 unpublished=10 publication=Build220 nativeInstallerChanged=false");
