import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

export const DEFAULT_GATE_TIMEOUT_MS = 180_000;

export function runObservableGate(label, command, args = [], options = {}) {
  const timeout = options.timeout ?? DEFAULT_GATE_TIMEOUT_MS;
  const started = Date.now();
  console.log(`GATE_START ${label} timeoutMs=${timeout}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    stdio: "inherit",
    timeout,
    windowsHide: true,
  });
  const elapsedMs = Date.now() - started;
  if (result.error?.code === "ETIMEDOUT") {
    assert.fail(`GATE_TIMEOUT ${label} elapsedMs=${elapsedMs} timeoutMs=${timeout}`);
  }
  assert.equal(result.status, 0, `GATE_FAIL ${label} exit=${result.status} signal=${result.signal ?? "none"} elapsedMs=${elapsedMs}${result.error ? ` error=${result.error.message}` : ""}`);
  console.log(`GATE_PASS ${label} exit=0 elapsedMs=${elapsedMs}`);
}

export function runNodeGate(file, options) {
  runObservableGate(file, process.execPath, [file], options);
}

export function runTsGate(file, options) {
  runObservableGate(file, process.execPath, ["artifacts/api-server/node_modules/tsx/dist/cli.mjs", file], options);
}
