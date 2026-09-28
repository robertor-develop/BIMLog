import { createReportingBaseline, type ReportingBaseline, type ReportingBaselineSource } from "./reporting-baseline";

export type BaselineCaptureActor = { userId: number; tenantId: number; projectId: number; canCaptureReportingBaselines: boolean };
export type BaselineCaptureRecord = {
  idempotencyKey: string;
  state: "capturing" | "complete" | "failed";
  baseline: ReportingBaseline | null;
  failureCode: string | null;
};

export class ReportingBaselineCaptureStore {
  private readonly captures = new Map<string, BaselineCaptureRecord>();

  capture(input: { actor: BaselineCaptureActor; idempotencyKey: string; baselineId: string; capturedAt: string; sources: readonly ReportingBaselineSource[]; failAfterReserve?: boolean }) {
    if (!input.actor.canCaptureReportingBaselines) throw new Error("REPORTING_BASELINE_CAPTURE_DENIED");
    if (!input.idempotencyKey.trim()) throw new Error("REPORTING_BASELINE_IDEMPOTENCY_KEY_REQUIRED");
    const existing = this.captures.get(input.idempotencyKey);
    if (existing) return existing;

    const reserved: BaselineCaptureRecord = { idempotencyKey: input.idempotencyKey, state: "capturing", baseline: null, failureCode: null };
    this.captures.set(input.idempotencyKey, reserved);
    if (input.failAfterReserve) {
      const failed: BaselineCaptureRecord = { ...reserved, state: "failed", failureCode: "SOURCE_CAPTURE_FAILED" };
      this.captures.set(input.idempotencyKey, failed);
      return failed;
    }

    const baseline = createReportingBaseline({
      id: input.baselineId,
      tenantId: input.actor.tenantId,
      projectId: input.actor.projectId,
      capturedAt: input.capturedAt,
      capturedByUserId: input.actor.userId,
      sources: input.sources,
    });
    const complete: BaselineCaptureRecord = { ...reserved, state: "complete", baseline, failureCode: null };
    this.captures.set(input.idempotencyKey, complete);
    return complete;
  }

  restore(records: readonly BaselineCaptureRecord[]) {
    for (const record of records) this.captures.set(record.idempotencyKey, record);
  }

  records() { return [...this.captures.values()]; }
}
