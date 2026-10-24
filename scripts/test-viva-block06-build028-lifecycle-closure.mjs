import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const headquarters = spawnSync("pnpm", ["run", "test:headquarters-lifecycle-block05"], { encoding: "utf8", shell: true, timeout: 360_000 });
assert.equal(headquarters.status, 0, `${headquarters.stdout ?? ""}\n${headquarters.stderr ?? headquarters.error ?? ""}`);
const intake = spawnSync(process.execPath, ["artifacts/api-server/node_modules/tsx/dist/cli.mjs", "artifacts/api-server/src/lib/job-intake-full-lifecycle.behavior.ts"], { encoding: "utf8", timeout: 240_000 });
assert.equal(intake.status, 0, `${intake.stdout ?? ""}\n${intake.stderr ?? intake.error ?? ""}`);
console.log("VIVA_BLOCK06_BUILD028=PASS headquarters_lifecycle=true intake_lifecycle=true retirement_review=true");
