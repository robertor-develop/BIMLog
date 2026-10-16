import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const run = (file, ts = false) => {
  const args = ts ? ["artifacts/api-server/node_modules/tsx/dist/cli.mjs", file] : [file];
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  assert.equal(result.status, 0, `${file} failed:\n${result.stdout}\n${result.stderr}`);
};

for (const file of [
  "artifacts/api-server/src/lib/ux-failure-journey.behavior.ts",
  "artifacts/api-server/src/lib/block22-build110-security-recovery-acceptance.behavior.ts",
  "artifacts/api-server/src/lib/block18-build090-integration-recovery.behavior.ts",
  "artifacts/bimlog/src/lib/deployment-module-recovery.behavior.ts",
]) run(file, true);
run("artifacts/api-server/src/lib/post-p17-build62-files-upload-storage.behavior.mjs");
console.log("GA-F05-B033 BOUNDED PASS: injected retry/tenant/integration/upload/recovery behaviors; full 18-scenario runtime matrix UNTESTED");
