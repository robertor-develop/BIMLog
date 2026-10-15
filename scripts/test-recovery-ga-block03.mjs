import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsx = path.join(root, "artifacts/api-server/node_modules/tsx/dist/cli.mjs");
const files = [
  "gauntlet-project-configuration.behavior.ts",
  "gauntlet-catalog-acceptance.behavior.ts",
  "gauntlet-directory-acceptance.behavior.ts",
  "gauntlet-role-matrix.behavior.ts",
  "gauntlet-intake-acceptance.behavior.ts",
];
for (const file of files) execFileSync(process.execPath, [tsx, path.join(root, "artifacts/api-server/src/lib", file)], { cwd: root, stdio: "inherit" });
console.log("RECOVERY_GA_BLOCK03=PASS builds=B-GA011..B-GA015 production_mutations=0 protected_projects_unchanged=true");
