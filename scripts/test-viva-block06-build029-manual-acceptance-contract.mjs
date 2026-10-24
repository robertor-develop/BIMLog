import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

for (const target of ["test:ga-final-block05-build032", "test:authenticated-release-acceptance"]) {
  const run = spawnSync("pnpm", ["run", target], { encoding: "utf8", shell: true, timeout: 300_000 });
  assert.equal(run.status, 0, `${target}\n${run.stdout ?? ""}\n${run.stderr ?? run.error ?? ""}`);
}
console.log("VIVA_BLOCK06_BUILD029=PASS manual_acceptance_contract=true responsive_matrix=true live_receipt_required_after_publish=true");
