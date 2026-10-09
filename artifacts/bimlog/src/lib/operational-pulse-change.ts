import type { OperationalPulseCounts } from "./operational-pulse";

export type OperationalPulseChange = {
  total: number;
  rfis: number;
  submittals: number;
  files: number;
  direction: "increased" | "decreased" | "unchanged";
  queues: OperationalPulseQueueChange[];
  largestMovement: OperationalPulseQueueChange | null;
};

export type OperationalPulseQueueChange = {
  key: "rfis" | "submittals" | "files";
  delta: number;
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
  const queues: OperationalPulseQueueChange[] = [
    { key: "rfis", delta: rfis, direction: rfis > 0 ? "increased" : rfis < 0 ? "decreased" : "unchanged" },
    { key: "submittals", delta: submittals, direction: submittals > 0 ? "increased" : submittals < 0 ? "decreased" : "unchanged" },
    { key: "files", delta: files, direction: files > 0 ? "increased" : files < 0 ? "decreased" : "unchanged" },
  ];
  const changedQueues = queues.filter(queue => queue.delta !== 0);
  const largestMovement = changedQueues.length === 0
    ? null
    : changedQueues.reduce((largest, queue) => Math.abs(queue.delta) > Math.abs(largest.delta) ? queue : largest);
  return {
    total,
    rfis,
    submittals,
    files,
    direction: total > 0 ? "increased" : total < 0 ? "decreased" : "unchanged",
    queues,
    largestMovement,
  };
}
