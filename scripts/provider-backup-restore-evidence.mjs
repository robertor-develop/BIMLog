const HEX64 = /^[0-9a-f]{64}$/;

export function validateBackupRestoreEvidence(evidence) {
  const errors = [];
  const require = (condition, code) => { if (!condition) errors.push(code); };
  require(evidence?.schemaVersion === "bimlog-provider-recovery-evidence-v1", "EVIDENCE_SCHEMA_INVALID");
  require(evidence?.receipt?.schemaVersion === "bimlog-database-restore-receipt-v1", "RESTORE_RECEIPT_INVALID");
  require(HEX64.test(evidence?.receipt?.backupSha256 ?? ""), "BACKUP_HASH_INVALID");
  require(evidence?.receipt?.backupSha256 === evidence?.observedBackupSha256, "BACKUP_HASH_MISMATCH");
  require(Number.isSafeInteger(evidence?.receipt?.backupBytes) && evidence.receipt.backupBytes > 0, "BACKUP_MISSING");
  require(evidence?.receipt?.backupBytes === evidence?.observedBackupBytes, "BACKUP_SIZE_MISMATCH");
  require(evidence?.receipt?.schemaExact === true, "SCHEMA_MISMATCH");
  require(evidence?.receipt?.recordCountsExact === true, "RECORD_COUNT_MISMATCH");
  require(evidence?.receipt?.sourceRecordCountManifestSha256 === evidence?.receipt?.restoredRecordCountManifestSha256, "RECORD_COUNT_MISMATCH");
  require(evidence?.target?.disposable === true && evidence?.target?.production === false, "TARGET_NOT_DISPOSABLE");
  require(evidence?.productionMutation === false, "PRODUCTION_MUTATION_DETECTED");
  require(evidence?.cleanup?.restoredTargetRemoved === true, "DISPOSABLE_TARGET_NOT_REMOVED");
  return { ok: errors.length === 0, errors };
}
