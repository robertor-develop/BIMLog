import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

for (const target of ["test:corrective-b17", "test:corrective-b18", "test:live-journey-build008", "test:live-journey-build009"]) {
  const run = spawnSync(`pnpm run ${target}`, { encoding: "utf8", shell: true });
  assert.equal(run.status, 0, `${target}\n${run.stdout ?? ""}\n${run.stderr ?? run.error ?? ""}`);
  if (target.startsWith("test:live-journey")) assert.match(run.stdout, /liveAcceptance=false/);
}
const route = readFileSync("artifacts/api-server/src/routes/rfis.ts", "utf8");
assert.match(route, /procore-rfi-import/i);
assert.match(route, /requireProjectMember/);
assert.doesNotMatch(route, /liveAcceptance\s*=\s*true/);
console.log("VIVA_BLOCK02_BUILD008=PASS connector=procore structural=PASS provider_round_trip=UNTESTED_EXPLICIT");
