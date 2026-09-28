export type DailyObservationKind = "weather" | "delivery" | "constraint";
export type DailyObservationSource = "manual" | "provider";

export interface DailySiteObservation {
  observationId: string;
  projectId: number;
  dailyRecordId: string;
  kind: DailyObservationKind;
  source: DailyObservationSource;
  sourceLabel: string;
  providerRecordId: string | null;
  detail: string;
  observedAt: string;
  recordedBy: string;
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

export function recordDailySiteObservation(input: DailySiteObservation): DailySiteObservation {
  if (!Number.isSafeInteger(input.projectId) || input.projectId <= 0) throw new Error("A valid project is required.");
  if (Number.isNaN(Date.parse(input.observedAt))) throw new Error("A valid observation time is required.");
  const sourceLabel = required(input.sourceLabel, "Observation source label");
  if (input.source === "provider" && !input.providerRecordId?.trim()) throw new Error("Provider observations require a provider record identity.");
  if (input.source === "manual" && input.providerRecordId !== null) throw new Error("Manual observations cannot claim a provider record.");
  return { ...input, observationId: required(input.observationId, "Observation identity"), dailyRecordId: required(input.dailyRecordId, "Daily record identity"), sourceLabel, detail: required(input.detail, "Observation detail"), recordedBy: required(input.recordedBy, "Recorder identity") };
}

export function mergeDailyObservations(input: { projectId: number; manual: readonly DailySiteObservation[]; provider: readonly DailySiteObservation[] | null }) {
  const manual = input.manual.filter(item => item.projectId === input.projectId);
  const provider = (input.provider ?? []).filter(item => item.projectId === input.projectId);
  return {
    rows: [...manual, ...provider].sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.observationId.localeCompare(b.observationId)),
    providerState: input.provider === null ? "unavailable" as const : "available" as const,
    providerNotice: input.provider === null ? "Provider observations are unavailable; manual observations remain preserved." : null,
  };
}
