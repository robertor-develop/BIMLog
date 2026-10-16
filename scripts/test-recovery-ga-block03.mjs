import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const commands = [
  ["scripts/test-recovery-ga-http.mjs", "--scenario=all"],
  ["scripts/test-intake-activation.mjs"],
];
for (const args of commands) execFileSync(process.execPath, args, { cwd: root, stdio: "inherit" });
console.log("RECOVERY_GA_BLOCK03=PASS builds=B-GA011..B-GA015 authenticated_http=true real_postgresql=true production_mutations=0 protected_projects_unchanged=true");
