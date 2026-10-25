import { FinancialControlError } from "./financial-control-contract";

function scaled(value: string) { const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(String(value).trim()); if (!match) throw new Error("Planned hours must be a positive decimal."); return BigInt(match[1]) * 1_000_000n + BigInt((match[2] ?? "").padEnd(6, "0")); }
function decimal(value: bigint) { const fraction = String(value % 1_000_000n).padStart(6, "0").replace(/0+$/, ""); return fraction ? `${value / 1_000_000n}.${fraction}` : String(value / 1_000_000n); }
export function allocateWorkflowPhaseHours(plannedHours: string, phases: Array<{ id: string; code: string; name: string }>, allocation?: Array<{ phaseId: string; code: string; workflowPercent: string }>) {
  const total = scaled(plannedHours);
  if (!phases.length) return [];
  if (phases.length === 1 && !allocation) return [{ ...phases[0], plannedHours: decimal(total) }];
  if (!allocation || allocation.length !== phases.length) throw new Error("A verified workflow economic allocation is required for every phase.");
  const weights = phases.map((phase, index) => {
    const row = allocation[index];
    if (row.phaseId !== phase.id || row.code !== phase.code) throw new Error("Workflow allocation phase identity does not match the selected workflow.");
    return scaled(row.workflowPercent);
  });
  const weightTotal = weights.reduce((sum, value) => sum + value, 0n);
  if (weightTotal !== 100_000_000n) throw new Error("Workflow economic allocation must total 100 percent.");
  let used = 0n;
  return phases.map((phase, index) => { const hours = index === phases.length - 1 ? total - used : total * weights[index] / weightTotal; used += hours; return { ...phase, plannedHours: decimal(hours) }; });
}
export function requireWorkflowPhaseHours(
  plannedHours: string,
  phases: Array<{ id: string; code: string; name: string }>,
  allocation?: Array<{ phaseId: string; code: string; workflowPercent: string }>,
) {
  try {
    return allocateWorkflowPhaseHours(plannedHours, phases, allocation);
  } catch (error) {
    throw new FinancialControlError(
      409,
      "JOB_INTAKE_WORKFLOW_ALLOCATION_REQUIRED",
      error instanceof Error
        ? error.message
        : "A verified workflow economic allocation is required before activation.",
    );
  }
}
