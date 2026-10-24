import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const run = spawnSync("pnpm", ["run", "test:headquarters-daily-clarity-block08"], { encoding: "utf8", shell: true });
assert.equal(run.status, 0, `${run.stdout ?? ""}\n${run.stderr ?? run.error ?? ""}`);
const pulse = readFileSync("artifacts/bimlog/src/lib/operational-pulse.ts", "utf8");
const refresh = readFileSync("artifacts/bimlog/src/lib/operational-pulse-refresh.ts", "utf8");
assert.match(pulse, /export function operationalPulse/);
assert.match(refresh, /export function operationalPulseRefreshState/);
console.log("VIVA_BLOCK03_BUILD013=PASS surface=headquarters_pulse refresh=true movement=true responsive=true");
