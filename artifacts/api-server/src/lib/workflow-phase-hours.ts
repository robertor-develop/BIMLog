const WEIGHTS: Record<string, bigint> = { PRE: 45n, COORD: 35n, COO: 35n, FR: 15n, FOR: 15n, AB: 5n, ASB: 5n };
function scaled(value: string) { const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(String(value).trim()); if (!match) throw new Error("Planned hours must be a positive decimal."); return BigInt(match[1]) * 1_000_000n + BigInt((match[2] ?? "").padEnd(6, "0")); }
function decimal(value: bigint) { const fraction = String(value % 1_000_000n).padStart(6, "0").replace(/0+$/, ""); return fraction ? `${value / 1_000_000n}.${fraction}` : String(value / 1_000_000n); }
export function allocateWorkflowPhaseHours(plannedHours: string, phases: Array<{ id: string; code: string; name: string }>) {
  const total = scaled(plannedHours), weights = phases.map(phase => WEIGHTS[String(phase.code).toUpperCase()] ?? 0n), weightTotal = weights.reduce((sum, value) => sum + value, 0n);
  if (!phases.length || weightTotal <= 0n) return [];
  let used = 0n;
  return phases.map((phase, index) => { const hours = index === phases.length - 1 ? total - used : total * weights[index] / weightTotal; used += hours; return { ...phase, plannedHours: decimal(hours) }; });
}
