import { execFileSync } from "node:child_process";

for (const script of [
  "test-release-source-identity.mjs",
  "test-sealed-web-package.mjs",
  "test-runtime-release-identity.mjs",
  "test-migration-catalog-truth.mjs",
  "test-deployment-rollback-gate.mjs",
]) execFileSync(process.execPath, [`scripts/${script}`], { stdio: "inherit" });
console.log("RELEASE_INTEGRITY_BLOCK01=PASS builds=5 production_mutations=0");
