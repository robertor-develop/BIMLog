import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const run = file => {
  const result = spawnSync(process.execPath, [file], { encoding: "utf8" });
  assert.equal(result.status, 0, `${file} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
};

const cleanup = run("scripts/test-ga-final-block05-build034-temp-cleanup-readiness.mjs");
assert.match(cleanup, /BLOCKED-SAFE/);

const status = readFileSync("living-brief/STATUS.md", "utf8");
const openLoop = readFileSync("living-brief/OPEN_LOOP.md", "utf8");
const acceptance = JSON.parse(readFileSync("evidence/ga-final-20261015/BLOCK02_GAUNTLET_ACCEPTANCE.json", "utf8"));
const protectedInventory = JSON.parse(readFileSync("evidence/ga-recovery-20261016/protected-file-inventory.json", "utf8"));

assert.equal(protectedInventory.files.length, 16);
assert.match(openLoop, /B-GA034: temporary-project deletion depends on completed lifecycle evidence and verified synthetic-only ownership/);
assert.match(openLoop, /B-GA035: final GA remains blocked by incomplete program acceptance including protected-file recovery/);
assert.match(acceptance.blockedExternalGate, /Thirteen protected legacy binaries/);

const verdict = Object.freeze({
  build: "B-GA035",
  verdict: "BLOCKED",
  gaReady: false,
  blockers: Object.freeze([
    "sixteen protected file records lack portable custody; authoritative original recovery and independent checksum verification remain incomplete",
    "temporary Gauntlet deletion lacks complete synthetic ownership and lifecycle evidence",
    "exact-three final production acceptance cannot be claimed before those gates close",
  ]),
});

assert.equal(verdict.gaReady, false);
assert.equal(verdict.blockers.length, 3);
console.log(`GA-F05-B035 ${verdict.verdict}: final GA remains fail-closed; ${verdict.blockers.join("; ")}`);
