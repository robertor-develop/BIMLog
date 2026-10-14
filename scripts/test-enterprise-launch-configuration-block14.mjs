import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsx = path.join(root, "artifacts/api-server/node_modules/tsx/dist/cli.mjs");
for (const file of [
  "artifacts/api-server/src/lib/launch-owner-input-checklist.behavior.ts",
  "artifacts/api-server/src/routes/launch-owner-input-route.behavior.ts",
]) execFileSync(process.execPath, [tsx, path.join(root, file)], { stdio: "inherit" });
execFileSync("pnpm", ["run", "test:enterprise-launch-configuration-block13"], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
console.log("Builds 66-70 owner-input checklist block: PASS");
