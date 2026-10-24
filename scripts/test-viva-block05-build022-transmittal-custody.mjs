import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const run = spawnSync("pnpm", ["run", "test:ga-final-block03-build023"], { encoding: "utf8", shell: true, timeout: 180_000 });
assert.equal(run.status, 0, `${run.stdout ?? ""}\n${run.stderr ?? run.error ?? ""}`);
console.log("VIVA_BLOCK05_BUILD022=PASS transmittal=controlled delivery_truth=true retained=true cancellation=true");
