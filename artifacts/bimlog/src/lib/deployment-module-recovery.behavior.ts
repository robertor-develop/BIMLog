import assert from "node:assert/strict";
import {
  isStaleDeploymentModuleError,
  shouldReloadStaleDeploymentModule,
} from "./deployment-module-recovery";

assert.equal(isStaleDeploymentModuleError(new TypeError("Failed to fetch dynamically imported module: /assets/old.js")), true);
assert.equal(isStaleDeploymentModuleError(new Error("ChunkLoadError: Loading chunk 42 failed")), true);
assert.equal(isStaleDeploymentModuleError(new Error("permission denied")), false);
assert.equal(shouldReloadStaleDeploymentModule(null, 100_000), true);
assert.equal(shouldReloadStaleDeploymentModule("not-a-number", 100_000), true);
assert.equal(shouldReloadStaleDeploymentModule("50000", 100_000), false);
assert.equal(shouldReloadStaleDeploymentModule("1", 100_002), true);

console.log("PASS stale deployment-module failures are detected without swallowing unrelated errors");
console.log("PASS recovery permits one reload per bounded window and then fails closed");
console.log("SUMMARY 2/2 PASS");
