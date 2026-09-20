import assert from "node:assert/strict";
import {
  cleanupWithOperationalEvidence,
  parseJsonWithOperationalEvidence,
  rollbackWithOperationalEvidence,
  type OperationalFailureEvent,
} from "./operational-failure";

const events: OperationalFailureEvent[] = [];
const reporter = (event: OperationalFailureEvent) => events.push(event);

assert.equal(await cleanupWithOperationalEvidence(async () => undefined, "FEEDBACK_PACKAGE_PDF_CLEANUP_FAILED", reporter), true);
assert.equal(events.length, 0);
assert.equal(await cleanupWithOperationalEvidence(async () => { throw new Error("private cleanup detail"); }, "FEEDBACK_PACKAGE_PDF_CLEANUP_FAILED", reporter), false);
assert.deepEqual(events.pop(), { event: "bimlog_operational_failure", code: "FEEDBACK_PACKAGE_PDF_CLEANUP_FAILED" });

assert.deepEqual(await parseJsonWithOperationalEvidence({ json: async () => ({ ok: true }) }, "TELEGRAM_DOCUMENT_RESPONSE_INVALID", reporter), { ok: true });
assert.equal(await parseJsonWithOperationalEvidence({ json: async () => { throw new Error("private provider body"); } }, "TELEGRAM_DOCUMENT_RESPONSE_INVALID", reporter), null);
assert.deepEqual(events.pop(), { event: "bimlog_operational_failure", code: "TELEGRAM_DOCUMENT_RESPONSE_INVALID" });

await rollbackWithOperationalEvidence({ query: async () => { throw new Error("private database detail"); } }, "JOB_INTAKE_IMPORT_ROLLBACK_FAILED", reporter);
assert.deepEqual(events.pop(), { event: "bimlog_operational_failure", code: "JOB_INTAKE_IMPORT_ROLLBACK_FAILED" });
assert.equal(events.length, 0);

console.log("OPERATIONAL_FAILURE_NEGATIVE_PATHS=PASS diagnostics=code-only");
