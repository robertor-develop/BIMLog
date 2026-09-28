export interface DailyWorkforceObservation {
  observationId: string;
  projectId: number;
  dailyRecordId: string;
  assignmentId: string;
  companyId: number;
  activity: string;
  observedHeadcount: number;
  observedHours: number | null;
  observedAt: string;
  observerId: string;
  financialAuthority: "none";
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

export function recordWorkforceObservation(input: Omit<DailyWorkforceObservation, "financialAuthority">): DailyWorkforceObservation {
  if (!Number.isSafeInteger(input.projectId) || input.projectId <= 0) throw new Error("A valid project is required.");
  if (!Number.isSafeInteger(input.companyId) || input.companyId <= 0) throw new Error("A valid company is required.");
  if (!Number.isSafeInteger(input.observedHeadcount) || input.observedHeadcount < 0) throw new Error("Observed headcount must be a non-negative integer.");
  if (input.observedHours !== null && (!Number.isFinite(input.observedHours) || input.observedHours < 0)) throw new Error("Observed hours must be non-negative when recorded.");
  if (Number.isNaN(Date.parse(input.observedAt))) throw new Error("A valid observation time is required.");
  return {
    ...input,
    observationId: required(input.observationId, "Observation identity"),
    dailyRecordId: required(input.dailyRecordId, "Daily record identity"),
    assignmentId: required(input.assignmentId, "Existing assignment identity"),
    activity: required(input.activity, "Observed activity"),
    observerId: required(input.observerId, "Observer identity"),
    financialAuthority: "none",
  };
}

export function workforceObservationSummary(input: { projectId: number; observations: readonly DailyWorkforceObservation[] }) {
  const rows = input.observations.filter(observation => observation.projectId === input.projectId);
  return {
    observations: rows.length,
    observedHeadcount: rows.reduce((total, row) => total + row.observedHeadcount, 0),
    observedHours: rows.some(row => row.observedHours === null) ? null : rows.reduce((total, row) => total + (row.observedHours ?? 0), 0),
    notice: "Observed workforce information is a field observation only. It is not an approved time entry, payroll record, payable quantity or financial posting.",
  };
}
