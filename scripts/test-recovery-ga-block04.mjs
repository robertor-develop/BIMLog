import { runObservableGate } from "./lib/observable-gate-runner.mjs";
import { RECOVERY_GA_BLOCK04_SCENARIO_COUNT, RECOVERY_GA_BLOCK04_SCENARIO_TIMEOUT_MS } from "./lib/ga-timeout-contract.mjs";

const commands = [
  ["scripts/test-recovery-ga-http.mjs", "--scenario=project"],
  ["scripts/test-recovery-ga-http.mjs", "--scenario=catalog"],
  ["scripts/test-recovery-ga-http.mjs", "--scenario=directory"],
  ["scripts/test-recovery-ga-http.mjs", "--scenario=roles"],
  ["scripts/test-recovery-ga-http.mjs", "--scenario=convention"],
  ["scripts/test-recovery-ga-http.mjs", "--scenario=convention-integrity"],
  ["scripts/test-recovery-ga-http.mjs", "--scenario=versions"],
  ["scripts/test-recovery-ga-http.mjs", "--scenario=files"],
  ["scripts/test-intake-activation.mjs"],
  ["scripts/test-ga-final-block02-build006-convention-checkpoint.mjs"],
  ["scripts/test-ga-final-block02-build007-naming-parity.mjs"],
  ["scripts/test-ga-final-block02-build008-convention-version.mjs"],
  ["scripts/test-ga-final-block02-build009-template-edt.mjs"],
  ["scripts/test-ga-final-block02-build010-file-lifecycle.mjs"],
];
if (commands.length !== RECOVERY_GA_BLOCK04_SCENARIO_COUNT) throw new Error(`Recovery GA timeout contract expects ${RECOVERY_GA_BLOCK04_SCENARIO_COUNT} scenarios; received ${commands.length}`);
for (const args of commands) runObservableGate(args.join(" "), process.execPath, args, { timeout: RECOVERY_GA_BLOCK04_SCENARIO_TIMEOUT_MS });
console.log("RECOVERY_GA_BLOCK04=PASS builds=B-GA016..B-GA020 authenticated_http=true real_postgresql=true production_mutations=0 protected_projects_unchanged=true");
