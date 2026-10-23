import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function run(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, env: process.env, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed (${result.status}).`);
}

run("scripts/check-current-state-contract.mjs", ["--self-test"]);
run("scripts/test-source-history-reconciliation.mjs");
run("scripts/platform-audit.mjs", ["--output", "tmp/viva-block01-platform-audit.json"]);
const audit = JSON.parse(fs.readFileSync(path.join(root, "tmp/viva-block01-platform-audit.json"), "utf8"));
if (audit.counts.P0 !== 0 || audit.counts.P1 !== 0 || audit.counts.P2 !== 0) throw new Error(`Platform findings remain: ${JSON.stringify(audit.counts)}`);
run("scripts/check-tracked-secret-exposure.mjs", ["--self-test"]);
run("scripts/check-tracked-secret-exposure.mjs");
run("scripts/test-database-safety.mjs");
run("scripts/test-release-integrity-block01.mjs");
run("scripts/test-block-release-manifest.mjs");
run("scripts/test-workflow-database-fixture.mjs");
run("scripts/test-recovery-ga-http.mjs");
console.log("VIVA_BLOCK01_CLOSURE=PASS history=454 platform=P0:0,P1:0,P2:0 security=PASS recovery=PASS release=PASS");
