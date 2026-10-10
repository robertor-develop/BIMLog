import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsx = path.join(root, "artifacts/api-server/node_modules/tsx/dist/cli.mjs");
for (const file of [
  "artifacts/api-server/src/lib/public-legal-identity.behavior.ts",
  "artifacts/api-server/src/routes/public-legal-identity.behavior.ts",
  "artifacts/bimlog/src/lib/public-legal-identity-client.behavior.ts",
  "artifacts/bimlog/src/pages/legal-supplier-identity.behavior.ts",
  "artifacts/bimlog/src/pages/legal-information-path.behavior.ts",
]) execFileSync(process.execPath, [tsx, path.join(root, file)], { stdio: "inherit" });
console.log("LR006-LR010 Launch Readiness Block 2 public legal identity: PASS");
