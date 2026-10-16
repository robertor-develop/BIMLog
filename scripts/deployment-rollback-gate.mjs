const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const TOKEN = /^[A-Za-z0-9._:-]{1,200}$/;

export function validateDeploymentRollbackGate(receipt) {
  const errors = [];
  const require = (condition, field) => { if (!condition) errors.push(field); };
  require(receipt?.schemaVersion === "bimlog-deployment-rollback-gate-v1", "schemaVersion");
  require(HEX40.test(receipt?.candidate?.commit ?? ""), "candidate.commit");
  require(HEX40.test(receipt?.candidate?.tree ?? ""), "candidate.tree");
  require(HEX64.test(receipt?.candidate?.manifestSha256 ?? ""), "candidate.manifestSha256");
  require(TOKEN.test(receipt?.candidate?.migrationLevel ?? ""), "candidate.migrationLevel");
  require(receipt?.candidate?.commit === receipt?.remote?.commit, "remote.commit");
  require(receipt?.candidate?.tree === receipt?.remote?.tree, "remote.tree");
  require(receipt?.candidate?.manifestSha256 === receipt?.deployment?.manifestSha256, "deployment.manifestSha256");
  require(receipt?.candidate?.migrationLevel === receipt?.deployment?.migrationLevel, "deployment.migrationLevel");
  require(TOKEN.test(receipt?.deployment?.providerId ?? ""), "deployment.providerId");
  require(receipt?.rollback?.targetCommit === receipt?.previous?.commit, "rollback.targetCommit");
  require(receipt?.rollback?.targetManifestSha256 === receipt?.previous?.manifestSha256, "rollback.targetManifestSha256");
  require(receipt?.rollback?.schemaAction === "NONE", "rollback.schemaAction");
  require(receipt?.database?.schemaAction === "NONE" || receipt?.database?.backupVerified === true, "database.backupVerified");
  return { ok: errors.length === 0, errors };
}

export function assertDeploymentRollbackGate(receipt) {
  const result = validateDeploymentRollbackGate(receipt);
  if (!result.ok) throw new Error(`deployment/rollback gate failed: ${result.errors.join(", ")}`);
  return result;
}
