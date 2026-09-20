import assert from "node:assert/strict";
import { recordIntegrationRecovery } from "./block18-build090-integration-recovery";

const failed = { eventKey: "sync:9:26:42", provider: "sharepoint", companyId: 9, projectId: 26, operation: "delta_reconcile", payloadSha256: "a".repeat(64), providerAcknowledgementId: null, failureCode: "PROVIDER_UNAVAILABLE", occurredAt: "2026-09-20T12:00:00Z" } as const;
const failure = recordIntegrationRecovery(failed, null);
assert.equal(failure.outcome, "failed");
assert.equal(failure.auditAppended, true);
assert.equal(recordIntegrationRecovery(failed, failure.event).outcome, "failed_replay");

const recovered = { ...failed, providerAcknowledgementId: "graph-ack-42", failureCode: null, occurredAt: "2026-09-20T12:05:00Z" } as const;
const recovery = recordIntegrationRecovery(recovered, failure.event);
assert.equal(recovery.outcome, "recovered");
assert.equal(recovery.previousFailureCode, "PROVIDER_UNAVAILABLE");
assert.equal(recordIntegrationRecovery(recovered, recovery.event).outcome, "replay");
assert.throws(() => recordIntegrationRecovery({ ...recovered, payloadSha256: "b".repeat(64) }, recovery.event), /DIVERGENT_REPLAY/);
assert.throws(() => recordIntegrationRecovery({ ...recovered, providerAcknowledgementId: "different-ack" }, recovery.event), /ACK_CONFLICT/);
assert.throws(() => recordIntegrationRecovery({ ...failed, providerAcknowledgementId: null, failureCode: null }, null));
assert.throws(() => recordIntegrationRecovery({ ...failed, providerAcknowledgementId: "fake-success", failureCode: "PROVIDER_UNAVAILABLE" }, null));
console.log("block18 build090 integration outage recovery: PASS");
