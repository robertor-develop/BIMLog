import assert from "node:assert/strict";
import { ReportingBaselineCaptureStore } from "./reporting-baseline-capture";

const actor = { userId: 7, tenantId: 31, projectId: 26, canCaptureReportingBaselines: true };
const sources = [{ dataset: "rfi" as const, recordId: "1", version: 1, status: "open", sourceUpdatedAt: "2026-09-28T12:00:00Z" }];
const store = new ReportingBaselineCaptureStore();
const first = store.capture({ actor, idempotencyKey: "capture:31:26:2026-W40", baselineId: "2026-W40", capturedAt: "2026-09-28T13:00:00Z", sources });
const repeated = store.capture({ actor, idempotencyKey: "capture:31:26:2026-W40", baselineId: "different", capturedAt: "2026-09-28T14:00:00Z", sources: [] });
assert.equal(first, repeated, "repeated capture must resolve to the single reserved result");
assert.equal(store.records().length, 1);

const failed = store.capture({ actor, idempotencyKey: "capture:31:26:2026-W41", baselineId: "2026-W41", capturedAt: "2026-10-05T13:00:00Z", sources, failAfterReserve: true });
assert.equal(failed.state, "failed");
assert.equal(failed.baseline, null, "incomplete capture must never be labeled complete");
const restored = new ReportingBaselineCaptureStore();
restored.restore(store.records());
assert.equal(restored.capture({ actor, idempotencyKey: "capture:31:26:2026-W40", baselineId: "ignored", capturedAt: "2026-09-28T15:00:00Z", sources }).baseline?.id, "2026-W40");
assert.throws(() => store.capture({ actor: { ...actor, canCaptureReportingBaselines: false }, idempotencyKey: "denied", baselineId: "x", capturedAt: "2026-09-28T13:00:00Z", sources }), /CAPTURE_DENIED/);
console.log("C042 authorized restart-safe idempotent baseline capture: PASS");
