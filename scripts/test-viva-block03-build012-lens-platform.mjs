import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const run = spawnSync("pnpm", ["--filter", "@workspace/api-server", "run", "test:block14-lens-next-acceptance"], {
  encoding: "utf8",
  shell: true,
  timeout: 180_000,
});
assert.equal(run.status, 0, `${run.stdout ?? ""}\n${run.stderr ?? run.error ?? ""}`);
const app = readFileSync("artifacts/bimlog/src/App.tsx", "utf8");
assert.match(app, /LensNextWorkspace/);
console.log("VIVA_BLOCK03_BUILD012=PASS product=lens_next platform_route=true responsive_acceptance=true");
