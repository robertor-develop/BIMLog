import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const tsx = "artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for (const file of ["artifacts/api-server/src/lib/commercial-platform-readiness.behavior.ts", "scripts/check-commercial-launch-readiness.behavior.ts"]) {
  const run = spawnSync(process.execPath, [tsx, file], { encoding: "utf8", timeout: 120_000 });
  assert.equal(run.status, 0, `${file}\n${run.stdout ?? ""}\n${run.stderr ?? run.error ?? ""}`);
}
console.log("VIVA_BLOCK04_BUILD017=PASS configuration=9_keys fail_closed=true secrets_redacted=true");
