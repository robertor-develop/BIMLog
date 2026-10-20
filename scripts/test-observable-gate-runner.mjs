import assert from "node:assert/strict";
import { runObservableGate } from "./lib/observable-gate-runner.mjs";

runObservableGate("observable-pass", process.execPath, ["-e", "process.exit(0)"], { timeout: 2_000 });
assert.throws(
  () => runObservableGate("observable-exit", process.execPath, ["-e", "process.exit(7)"], { timeout: 2_000 }),
  /GATE_FAIL observable-exit exit=7/,
);
assert.throws(
  () => runObservableGate("observable-timeout", process.execPath, ["-e", "setInterval(()=>{},1000)"], { timeout: 100 }),
  /GATE_TIMEOUT observable-timeout/,
);
console.log("OBSERVABLE_GATE_RUNNER_PASS exitCodes=true timeout=true progress=true");
