import assert from "node:assert/strict";
import { createReportingBaseline, reportingBaselineMetadata } from "./reporting-baseline";

const mutable = [{ dataset: "rfi" as const, recordId: "RFI-1", version: 2, status: "open", sourceUpdatedAt: "2026-09-28T12:00:00Z" }];
const baseline = createReportingBaseline({ id: "weekly-2026-40", tenantId: 31, projectId: 26, capturedAt: "2026-09-28T13:00:00Z", capturedByUserId: 7, sources: mutable });
mutable[0].status = "closed";
assert.equal(baseline.sources[0].status, "open", "captured source identity must not change after source edits");
assert.deepEqual(reportingBaselineMetadata(baseline), {
  id: "weekly-2026-40", tenantId: 31, projectId: 26, capturedAt: "2026-09-28T13:00:00Z", capturedByUserId: 7, sourceCount: 1, sourceFingerprint: baseline.sourceFingerprint,
});
assert.throws(() => createReportingBaseline({ id: "bad", tenantId: 0, projectId: 26, capturedAt: "2026-09-28T13:00:00Z", capturedByUserId: 7, sources: [] }), /TENANT_REQUIRED/);
console.log("C041 immutable reporting baseline metadata and source identity: PASS");
