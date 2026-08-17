import assert from "node:assert/strict";
import { ensureFeedbackSchema, FEEDBACK_SCHEMA_ADVISORY_LOCK } from "./feedback-schema-migration";

const queries: string[] = [];
let released = false;
await ensureFeedbackSchema({ connect: async () => ({ query: async (sql: string) => { queries.push(sql); }, release: () => { released = true; } }) });
assert.equal(queries[0], "BEGIN");
assert.equal(queries[1], `SELECT pg_advisory_xact_lock(${FEEDBACK_SCHEMA_ADVISORY_LOCK})`);
assert.equal(queries.at(-1), "COMMIT");
assert.equal(released, true);
const ddl = queries.join("\n");
for (const table of ["feedback_relay_jobs", "feedback_relay_custody_events", "feedback_relay_nonces", "feedback_relay_receipts", "feedback_relay_holds", "feedback_relay_temporary_objects", "feedback_relay_deletion_proofs"]) assert.match(ddl, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
assert.doesNotMatch(ddl, /DROP\s+(?:TABLE|COLUMN)\b/i);
for (const invariant of ["feedback_relay_derive_job_scope", "feedback_relay_guard_job_fence", "feedback_relay_initial_custody_event", "feedback_relay_validate_custody_event", "feedback_relay_validate_nonce", "feedback_relay_validate_receipt", "feedback_relay_validate_temporary_object", "feedback_relay_validate_deletion_proof", "feedback_relay_transition_job", "feedback_relay_record_receipt", "feedback_relay_mark_temporary_deleted", "feedback_relay_record_deletion_proof", "feedback_relay_reject_mutation"]) assert.match(ddl, new RegExp(invariant));
for (const predicate of ["direct lifecycle mutation denied", "clean scanned asset required", "canonical tenant authority mismatch", "illegal state transition", "verified receipt required", "active hold prevents transition", "direct insertion denied", "receipt-verified", "scope_id", "FOR UPDATE"]) assert.match(ddl, new RegExp(predicate));
for (const identity of ["relay_mode", "idempotency_key", "request_hash", "source_byte_count", "source_sha256", "receipt_id", "deletion_proof_id", "expiry_outcome", "lineage_id"]) assert.match(ddl, new RegExp(identity));
for (const upgrade of ["ADD COLUMN IF NOT EXISTS", "606-catalog-preserved", "authority_version='legacy'", "verification_state='unverified'", "DROP CONSTRAINT IF EXISTS feedback_relay_jobs_state_chk", "feedback_relay_nonces_legacy_authority_idx", "guarded expiry prerequisites missing", "lease_expires_at<=now()"] ) assert.match(ddl,new RegExp(upgrade.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
assert.doesNotMatch(ddl, /j\.state='transferring' AND p_to_state IN \('delivered'/);
assert.doesNotMatch(ddl, /j\.state='delivered' AND p_to_state IN \('receipt-verified'/);
for (const recovery of ["j.state='transferring' AND p_to_state IN ('queued','receipt-verified','held','manual-review')", "j.state='delivered' AND p_to_state IN ('held','manual-review')", "j.state='held' AND p_to_state IN ('queued','manual-review')", "delete_started_at IS NOT NULL AND deleted_at IS NULL", "deleted_at IS NOT NULL"]) assert.ok(ddl.includes(recovery), recovery);

const failed: string[] = []; let failureReleased = false;
await assert.rejects(() => ensureFeedbackSchema({ connect: async () => ({ query: async (sql: string) => { failed.push(sql); if (sql.includes("CREATE TABLE IF NOT EXISTS feedback_relay_nonces")) throw new Error("forced migration failure"); }, release: () => { failureReleased = true; } }) }));
assert.equal(failed.at(-1), "ROLLBACK");
assert.equal(failureReleased, true);
console.log("feedback relay schema source assertions: 53/53 passed (runtime PostgreSQL not exercised)");
