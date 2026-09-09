import assert from "node:assert/strict";
import { recordForRecordReceipt } from "./for-record-receipt";

const receipt = { id: "receipt-1", issuanceId: "issuance-1", projectId: 7, companyId: 3, recipientContactId: 30, recipientCompanyId: 20, channel: "email", providerDeliveryId: "delivery-1", contentSha256: "a".repeat(64), outcome: "delivered", occurredAt: "2026-09-09T16:05:00Z", failureCode: null } as const;
assert.equal(recordForRecordReceipt(receipt, null).result, "recorded");
assert.equal(recordForRecordReceipt(receipt, receipt).result, "idempotent");
assert.throws(() => recordForRecordReceipt({ ...receipt, contentSha256: "b".repeat(64) }, receipt));
assert.throws(() => recordForRecordReceipt({ ...receipt, outcome: "failed", failureCode: null }, null));
assert.equal(recordForRecordReceipt({ ...receipt, outcome: "failed", failureCode: "PROVIDER_REJECTED" }, null).receipt.outcome, "failed");
console.log("for record receipt behavior: PASS");
