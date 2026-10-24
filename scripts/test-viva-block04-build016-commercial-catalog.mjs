import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

for (const target of ["test:commercial-packaging-block01", "test:commercial-catalog-block02"]) {
  const run = spawnSync("pnpm", ["run", target], { encoding: "utf8", shell: true, timeout: 120_000 });
  assert.equal(run.status, 0, `${target}\n${run.stdout ?? ""}\n${run.stderr ?? run.error ?? ""}`);
}
console.log("VIVA_BLOCK04_BUILD016=PASS catalog=authoritative buyer_guidance=true pricing_truth=true");
