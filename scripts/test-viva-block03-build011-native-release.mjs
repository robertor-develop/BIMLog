import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const run = spawnSync("pnpm", ["run", "check:lens-next-native-release"], { encoding: "utf8", shell: true });
assert.equal(run.status, 0, `${run.stdout ?? ""}\n${run.stderr ?? run.error ?? ""}`);
assert.match(run.stdout, /Lens Next Native release identity PASS: v1\.05\.N18-P37 \/ 1\.5\.18\.37/);
console.log("VIVA_BLOCK03_BUILD011=PASS native_years=2021,2025 deterministic_packages=true install_performed=false");
