import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = resolve(root, "artifacts/api-server/node_modules/tsx/dist/cli.mjs");
for (const name of [
  "folder-wizard-request-validation",
  "folder-wizard-request-lifetime",
  "folder-wizard-publish-options",
  "folder-wizard-confirmed-refresh",
  "folder-wizard-graph-upload", "folder-wizard-publish-candidate",
  "folder-wizard-publish-candidate-route", "folder-wizard-publish-submission",
  "folder-wizard-publish-status", "folder-wizard-publish-lease",
  "folder-wizard-publish-worker",
]) {
  const directory = ["folder-wizard-request-lifetime", "folder-wizard-publish-options", "folder-wizard-confirmed-refresh"].includes(name)
    ? "artifacts/bimlog/src/pages/project" : "artifacts/api-server/src/lib";
  const file = resolve(root, `${directory}/${name}.behavior.ts`);
  const result = spawnSync(process.execPath, [cli, file], { cwd: root, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Folder Wizard publication block 06 source behavior: PASS");
