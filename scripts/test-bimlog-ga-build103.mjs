import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";

const contract = JSON.parse(fs.readFileSync("evidence/ga-final-closure-20261024/build103-production-artifact-contract.json", "utf8"));
assert.equal(contract.schemaVersion, "bimlog-ga-build103-production-artifact-contract-v1");
assert.match(contract.publishedBaseline, /^[0-9a-f]{40}$/);
assert.doesNotThrow(() => execFileSync("git", ["merge-base", "--is-ancestor", contract.publishedBaseline, "HEAD"]));
assert.deepEqual(contract.requiredAssertions, {
  isolatedProductionArtifact: true,
  workspaceLinksResolved: true,
  apiRootHealthy: true,
  readinessHealthy: true,
  packagedLivingBriefDocuments: 11,
  feedbackStorageAuthorityFailClosed: true,
  productionMutations: 0,
});
const result = spawnSync("pnpm", ["--filter", "@workspace/api-server", "run", "test:production-artifact"], { encoding: "utf8", shell: true, timeout: 900_000 });
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
if (result.status !== 0) process.exit(result.status ?? 1);
assert.match(result.stdout, /"isolatedProductionArtifact":true/);
assert.match(result.stdout, /"workspaceLinksPresent":true/);
assert.match(result.stdout, /"apiRootStatus":200/);
assert.match(result.stdout, /"readinessStatus":200/);
assert.match(result.stdout, /"packagedLivingBriefDocuments":11/);
assert.match(result.stdout, /"invalidStorageAuthorityDenied":true/);
console.log("BIMLog GA Build 103: PASS isolated production artifact and fail-closed storage authority");
