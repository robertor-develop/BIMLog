import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsx = path.join(root, "artifacts/api-server/node_modules/tsx/dist/cli.mjs");
for (const file of [
  "artifacts/api-server/src/lib/launch-completion-dossier.behavior.ts",
  "artifacts/api-server/src/routes/launch-completion-dossier-route.behavior.ts",
  "artifacts/bimlog/src/components/admin/launch-configuration-panel.behavior.ts",
  "artifacts/api-server/src/lib/launch-owner-input-checklist.behavior.ts",
  "artifacts/api-server/src/routes/launch-owner-input-route.behavior.ts",
]) execFileSync(process.execPath, [tsx, path.join(root, file)], { stdio: "inherit" });
console.log("Builds 71-75 launch completion dossier block: PASS");
