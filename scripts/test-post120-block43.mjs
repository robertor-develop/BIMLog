import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateBackupRestoreEvidence } from "./provider-backup-restore-evidence.mjs";
import { decideIsolatedRollback, rehearseIsolatedRollback } from "./isolated-release-rollback.mjs";
import { advanceProviderAttempt, PROVIDER_RECOVERY_STOP_CONDITIONS } from "./provider-release-retry.mjs";

const root = path.resolve(import.meta.dirname, "..");
const evidence = JSON.parse(fs.readFileSync(path.join(root, "evidence/stabilization-program-20260919/BUILD_211_PROVIDER_RECOVERY_EVIDENCE.json"), "utf8"));
assert.deepEqual(validateBackupRestoreEvidence(evidence), { ok: true, errors: [] });
for (const mutate of [
  value => { value.observedBackupSha256 = "0".repeat(64); },
  value => { value.receipt.schemaExact = false; },
  value => { value.receipt.recordCountsExact = false; },
  value => { value.target.disposable = false; },
  value => { value.productionMutation = true; },
]) {
  const candidate = structuredClone(evidence); mutate(candidate);
  assert.equal(validateBackupRestoreEvidence(candidate).ok, false);
}

const candidate = "a".repeat(40), previous = "b".repeat(40);
assert.deepEqual(decideIsolatedRollback({ target: { disposable: true, production: false }, candidate: { commit: candidate, healthy: true }, previous: { commit: previous, healthy: true }, observedCommit: candidate }), { action: "KEEP_CANDIDATE", commit: candidate });
assert.deepEqual(decideIsolatedRollback({ target: { disposable: true, production: false }, candidate: { commit: candidate, healthy: false }, previous: { commit: previous, healthy: true }, observedCommit: candidate }), { action: "ROLLBACK", commit: previous });
assert.equal(decideIsolatedRollback({ target: { disposable: false, production: true }, candidate: { commit: candidate, healthy: false }, previous: { commit: previous, healthy: true }, observedCommit: candidate }).code, "TARGET_NOT_DISPOSABLE");
const rehearsalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bimlog-release-rollback-"));
try {
  const rehearsal = rehearseIsolatedRollback(rehearsalRoot, { target: { disposable: true, production: false }, candidate: { commit: candidate, healthy: false }, previous: { commit: previous, healthy: true }, observedCommit: candidate });
  assert.equal(rehearsal.action, "ROLLBACK");
  assert.equal(rehearsal.observed, previous);
} finally {
  fs.rmSync(rehearsalRoot, { recursive: true, force: true });
}

const initial = { candidate, stage: "BUILD", status: "RUNNING", attempt: 1, maxAttempts: 3 };
const retry = advanceProviderAttempt(initial, { type: "INTERRUPTED", candidate, promotionObserved: false });
assert.equal(retry.status, "RETRY");
assert.equal(retry.attempt, 2);
assert.equal(advanceProviderAttempt(initial, { type: "INTERRUPTED", candidate, promotionObserved: true }).code, "PROMOTION_STATE_AMBIGUOUS");
assert.equal(advanceProviderAttempt(initial, { type: "INTERRUPTED", candidate: previous, promotionObserved: false }).code, "CANDIDATE_IDENTITY_CHANGED");
assert.ok(PROVIDER_RECOVERY_STOP_CONDITIONS.includes("PROMOTION_STATE_AMBIGUOUS"));

console.log("POST120_BLOCK43=PASS backup_restore=verified rollback=isolated session=bound provider_retry=fail_closed");
