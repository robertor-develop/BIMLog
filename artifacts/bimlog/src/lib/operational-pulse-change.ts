import type { OperationalPulseCounts } from "./operational-pulse";

export type OperationalPulseChange = {
  total: number;
  rfis: number;
  submittals: number;
  files: number;
  direction: "increased" | "decreased" | "unchanged";
};

function safeCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function operationalPulseChange(previous: OperationalPulseCounts, current: OperationalPulseCounts): OperationalPulseChange {
  const rfis = safeCount(current.openRfis) - safeCount(previous.openRfis);
  const submittals = safeCount(current.pendingSubmittals) - safeCount(previous.pendingSubmittals);
  const files = safeCount(current.filesNeedingAttention) - safeCount(previous.filesNeedingAttention);
  const total = rfis + submittals + files;
  return {
    total,
    rfis,
    submittals,
    files,
    direction: total > 0 ? "increased" : total < 0 ? "decreased" : "unchanged",
  };
}
