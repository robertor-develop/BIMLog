import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tsx = "artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for (const file of [
  "artifacts/api-server/src/lib/ga-protected-file-inventory.behavior.ts",
  "artifacts/api-server/src/lib/ga-recovery-candidate-match.behavior.ts",
  "artifacts/api-server/src/lib/ga-recovery-source-assessment.behavior.ts",
  "artifacts/api-server/src/lib/ga-recovery-restoration-plan.behavior.ts",
]) {
  const result = spawnSync(process.execPath, [tsx, file], { encoding: "utf8", stdio: "inherit" });
  assert.equal(result.status, 0, `${file} failed`);
}
const finalGate = spawnSync(process.execPath, ["scripts/test-ga-final-block05-build035-final-ga-verdict.mjs"], { encoding: "utf8" });
assert.equal(finalGate.status, 0, finalGate.stderr);
assert.match(finalGate.stdout, /sixteen protected file records/);
const sources = JSON.parse(readFileSync("evidence/ga-recovery-20261016/recovery-source-receipts.json", "utf8"));
assert.equal(sources.sources.filter(source => source.state === "not_visible").length, 2);
console.log("GA RECOVERY CLOSURE BLOCK 01 PASS: five builds committed; 16 protected records remain fail-closed and provider sources remain unresolved");
