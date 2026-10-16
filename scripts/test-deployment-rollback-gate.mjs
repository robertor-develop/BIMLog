import assert from "node:assert/strict";
import { validateDeploymentRollbackGate } from "./deployment-rollback-gate.mjs";

const receipt = {
  schemaVersion: "bimlog-deployment-rollback-gate-v1",
  candidate: { commit: "a".repeat(40), tree: "b".repeat(40), manifestSha256: "c".repeat(64), migrationLevel: "schema-current" },
  remote: { commit: "a".repeat(40), tree: "b".repeat(40) },
  deployment: { providerId: "deployment-123", manifestSha256: "c".repeat(64), migrationLevel: "schema-current" },
  previous: { commit: "d".repeat(40), manifestSha256: "e".repeat(64) },
  rollback: { targetCommit: "d".repeat(40), targetManifestSha256: "e".repeat(64), schemaAction: "NONE" },
  database: { schemaAction: "NONE", backupVerified: false },
};
assert.equal(validateDeploymentRollbackGate(receipt).ok, true);
for (const broken of [
  { remote: { ...receipt.remote, commit: "f".repeat(40) } },
  { deployment: { ...receipt.deployment, manifestSha256: "f".repeat(64) } },
  { rollback: { ...receipt.rollback, targetCommit: "f".repeat(40) } },
  { database: { schemaAction: "MIGRATE", backupVerified: false } },
]) assert.equal(validateDeploymentRollbackGate({ ...receipt, ...broken }).ok, false);
console.log("DEPLOYMENT_ROLLBACK_GATE=PASS");
