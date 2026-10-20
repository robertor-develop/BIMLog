import assert from "node:assert/strict";
import { runNodeGate, runTsGate } from "./lib/observable-gate-runner.mjs";
const run = (file, ts = false) => ts ? runTsGate(file) : runNodeGate(file);

for (const file of [
  "artifacts/api-server/src/lib/ux-failure-journey.behavior.ts",
  "artifacts/api-server/src/lib/operational-failure.behavior.ts",
  "artifacts/api-server/src/lib/transaction-rollback-observability.behavior.ts",
  "artifacts/api-server/src/lib/ga-build005-provider-recovery.behavior.ts",
  "artifacts/api-server/src/lib/ux140-activation-retry.behavior.ts",
  "artifacts/api-server/src/lib/block22-build110-security-recovery-acceptance.behavior.ts",
  "artifacts/api-server/src/lib/block18-build090-integration-recovery.behavior.ts",
  "artifacts/api-server/src/routes/commercial-portal-recovery-route.behavior.ts",
  "artifacts/bimlog/src/lib/deployment-module-recovery.behavior.ts",
  "artifacts/bimlog/src/pages/commercial-portal-recovery-ui.behavior.ts",
]) run(file, true);
run("artifacts/api-server/src/lib/post-p17-build08-autosave-recovery.behavior.mjs");
run("artifacts/api-server/src/lib/post-p17-build62-files-upload-storage.behavior.mjs");
console.log("GA-F05-B033 PASS: retry, rollback, provider, tenant, integration, upload, autosave, deployment and commercial recovery behaviors");
