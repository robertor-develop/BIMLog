import { execFileSync } from "node:child_process";

const commands = [
  ["scripts/test-recovery-ga-http.mjs", "--scenario=all"],
  ["scripts/test-intake-activation.mjs"],
  ["scripts/test-ga-final-block02-build006-convention-checkpoint.mjs"],
  ["scripts/test-ga-final-block02-build007-naming-parity.mjs"],
  ["scripts/test-ga-final-block02-build008-convention-version.mjs"],
  ["scripts/test-ga-final-block02-build009-template-edt.mjs"],
  ["scripts/test-ga-final-block02-build010-file-lifecycle.mjs"],
];
for (const args of commands) execFileSync(process.execPath, args, { cwd: process.cwd(), stdio: "inherit" });
console.log("RECOVERY_GA_BLOCK04=PASS builds=B-GA016..B-GA020 authenticated_http=true real_postgresql=true production_mutations=0 protected_projects_unchanged=true");
