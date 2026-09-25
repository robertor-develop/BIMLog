import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = resolve(root, "artifacts/api-server/node_modules/tsx/dist/cli.mjs");
for (const name of [
  "folder-wizard-publish-source", "folder-wizard-graph-upload", "folder-wizard-publish-plan",
  "folder-wizard-publish-candidate", "folder-wizard-publish-job", "folder-wizard-publish-queue",
  "folder-wizard-publish-lease", "folder-wizard-publish-settlement", "folder-wizard-publish-worker",
]) {
  const file = resolve(root, `artifacts/api-server/src/lib/${name}.behavior.ts`);
  const result = spawnSync(process.execPath, [cli, file], { cwd: root, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Folder Wizard publication block 05: PASS");
