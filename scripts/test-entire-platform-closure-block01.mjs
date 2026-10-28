import { runNodeGate, runObservableGate } from "./lib/observable-gate-runner.mjs";
import { GA_FINAL_BUILD031_TIMEOUT_MS } from "./lib/ga-timeout-contract.mjs";

const runPnpmGate = script => process.platform === "win32"
  ? runObservableGate(`pnpm run ${script}`, process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `pnpm run ${script}`])
  : runObservableGate(`pnpm run ${script}`, "pnpm", ["run", script]);

runNodeGate("scripts/test-deepmerge-security-backport.mjs");
runPnpmGate("check:dependency-provenance");
runObservableGate("scripts/consolidation-recovery-inventory.mjs --self-test", process.execPath, ["scripts/consolidation-recovery-inventory.mjs", "--self-test"]);
runNodeGate("scripts/consolidation-recovery-inventory.mjs");
runNodeGate("scripts/test-ga-timeout-contract.mjs");
runNodeGate("scripts/test-ga-final-block05-build031-security-isolation.mjs", { timeout: GA_FINAL_BUILD031_TIMEOUT_MS });
runPnpmGate("check:living-brief");
runPnpmGate("test:living-brief");
console.log("ENTIRE_PLATFORM_CLOSURE_BLOCK01=PASS builds=5 publicationRequired=false");
