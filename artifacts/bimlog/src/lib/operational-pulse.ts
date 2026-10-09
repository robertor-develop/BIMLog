export type OperationalPulseCounts = {
  openRfis: number;
  pendingSubmittals: number;
  filesNeedingAttention: number;
};

export type OperationalPulseQueue = {
  key: "rfis" | "submittals" | "files";
  count: number;
  share: number;
  href: string;
};

function safeCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function operationalPulse(counts: OperationalPulseCounts): { total: number; queues: OperationalPulseQueue[] } {
  const normalized = {
    openRfis: safeCount(counts.openRfis),
    pendingSubmittals: safeCount(counts.pendingSubmittals),
    filesNeedingAttention: safeCount(counts.filesNeedingAttention),
  };
  const total = normalized.openRfis + normalized.pendingSubmittals + normalized.filesNeedingAttention;
  const queues: OperationalPulseQueue[] = [
    { key: "rfis", count: normalized.openRfis, share: 0, href: "/pending?type=rfis" },
    { key: "submittals", count: normalized.pendingSubmittals, share: 0, href: "/pending?type=submittals" },
    { key: "files", count: normalized.filesNeedingAttention, share: 0, href: "/pending?type=files" },
  ];
  return { total, queues: queues.map(queue => ({ ...queue, share: total === 0 ? 0 : Math.round((queue.count / total) * 100) })) };
}
