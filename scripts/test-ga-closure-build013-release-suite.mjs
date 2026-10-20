import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runObservableGate } from "./lib/observable-gate-runner.mjs";

const contract = JSON.parse(readFileSync("evidence/ga-closure-20261020/release-suite-contract.json", "utf8"));
const expected = [
  "test:ga-closure-build011",
  "test:ga-closure-build012",
  "test:release-integrity-block02",
  "test:corrective-b17",
  "test:corrective-b18",
  "test:corrective-b35",
  "test:ga-final-block05",
  "test:ga-typechecks",
];

assert.equal(contract.bounded, true);
assert.equal(contract.perGateTimeoutMs, 300_000);
assert.equal(contract.unexplainedSkips, 0);
assert.deepEqual(contract.gates, expected);
assert.equal(contract.gaCertification, "independent_review_required");

for (const gate of contract.gates) {
  if (process.platform === "win32") {
    runObservableGate(gate, process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `pnpm ${gate}`], { timeout: contract.perGateTimeoutMs });
  } else {
    runObservableGate(gate, "pnpm", [gate], { timeout: contract.perGateTimeoutMs });
  }
}

console.log(`GA-CLOSURE-B013 PASS: ${contract.gates.length} bounded release gates passed with zero unexplained skips`);
