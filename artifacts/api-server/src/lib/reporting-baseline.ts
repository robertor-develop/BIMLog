import crypto from "node:crypto";

export type ReportingBaselineSource = {
  dataset: "rfi" | "submittal";
  recordId: string;
  version: number;
  status: string;
  sourceUpdatedAt: string;
};

export type ReportingBaseline = {
  id: string;
  tenantId: number;
  projectId: number;
  capturedAt: string;
  capturedByUserId: number;
  sources: ReadonlyArray<Readonly<ReportingBaselineSource>>;
  sourceFingerprint: string;
};

function canonicalSources(sources: readonly ReportingBaselineSource[]) {
  return sources
    .map(source => ({ ...source }))
    .sort((a, b) => `${a.dataset}:${a.recordId}:v${a.version}`.localeCompare(`${b.dataset}:${b.recordId}:v${b.version}`));
}

export function createReportingBaseline(input: Omit<ReportingBaseline, "sources" | "sourceFingerprint"> & { sources: readonly ReportingBaselineSource[] }): ReportingBaseline {
  if (!input.id.trim()) throw new Error("REPORTING_BASELINE_ID_REQUIRED");
  if (!Number.isInteger(input.tenantId) || input.tenantId <= 0) throw new Error("REPORTING_BASELINE_TENANT_REQUIRED");
  if (!Number.isInteger(input.projectId) || input.projectId <= 0) throw new Error("REPORTING_BASELINE_PROJECT_REQUIRED");
  if (!Number.isFinite(Date.parse(input.capturedAt))) throw new Error("REPORTING_BASELINE_CAPTURE_TIME_INVALID");
  const sources = canonicalSources(input.sources);
  const sourceFingerprint = crypto.createHash("sha256").update(JSON.stringify(sources)).digest("hex");
  return Object.freeze({ ...input, sources: Object.freeze(sources.map(source => Object.freeze(source))), sourceFingerprint });
}

export function reportingBaselineMetadata(baseline: ReportingBaseline) {
  return {
    id: baseline.id,
    tenantId: baseline.tenantId,
    projectId: baseline.projectId,
    capturedAt: baseline.capturedAt,
    capturedByUserId: baseline.capturedByUserId,
    sourceCount: baseline.sources.length,
    sourceFingerprint: baseline.sourceFingerprint,
  };
}
