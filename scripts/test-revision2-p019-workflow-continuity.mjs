import { spawnSync } from "node:child_process";
import process from "node:process";

const runner = "artifacts/api-server/node_modules/tsx/dist/cli.mjs";
const gates = [
  ["RFI identity and isolation", "artifacts/api-server/src/lib/post-p17-build26-rfi-identity-scope.behavior.mjs"],
  ["RFI lifecycle and reopen history", "artifacts/api-server/src/lib/post-p17-build27-rfi-lifecycle-history.behavior.mjs"],
  ["RFI evidence integrity", "artifacts/api-server/src/lib/post-p17-build28-rfi-attachment-integrity.behavior.mjs"],
  ["RFI create/edit workflow UI", "artifacts/api-server/src/lib/post-p17-build29-rfi-workflow-ui.behavior.mjs"],
  ["Submittal identity and isolation", "artifacts/api-server/src/lib/post-p17-build31-submittal-identity-scope.behavior.mjs"],
  ["Submittal lifecycle and reopen history", "artifacts/api-server/src/lib/post-p17-build32-submittal-lifecycle-history.behavior.mjs"],
  ["Submittal evidence integrity", "artifacts/api-server/src/lib/post-p17-build33-submittal-attachment-integrity.behavior.mjs"],
  ["Submittal create/edit workflow UI", "artifacts/api-server/src/lib/post-p17-build34-submittal-workflow-ui.behavior.mjs"],
  ["Report and export scope", "artifacts/api-server/src/lib/post-p17-build23-report-export-scope.behavior.mjs"],
  ["Pending lifecycle error/reentry guidance", "artifacts/bimlog/src/lib/pending-item-lifecycle.behavior.ts"],
  ["Dashboard record continuity", "artifacts/bimlog/src/lib/dashboard-card-actions.behavior.ts"],
];

for (const [name, file] of gates) {
  const result = spawnSync(process.execPath, [runner, file], { cwd: process.cwd(), encoding: "utf8", stdio: "pipe" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${name} failed (${result.status ?? "no exit"})`);
  console.log(`P019_GATE=PASS ${name}`);
}
console.log(`PRINCIPAL_WORKFLOW_CONTINUITY_P019=PASS gates=${gates.length}`);
