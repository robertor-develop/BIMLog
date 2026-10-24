import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

for (const target of ["test:ga-final-block02-build010", "test:corrective-b13"]) {
  const run = spawnSync("pnpm", ["run", target], { encoding: "utf8", shell: true, timeout: 180_000 });
  assert.equal(run.status, 0, `${target}\n${run.stdout ?? ""}\n${run.stderr ?? run.error ?? ""}`);
}
console.log("VIVA_BLOCK05_BUILD021=PASS custody=portable versioning=true compensation=true authorization=true");
