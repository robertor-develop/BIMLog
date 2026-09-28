export interface ProcurementCalendar { id: string; version: number; workingWeekdays: readonly number[]; holidays: readonly string[]; }
export interface ProcurementLeadTimeInput { requiredOnSiteDate: string; forecastStartDate: string; leadTimeWorkingDays: number | null; calendar: ProcurementCalendar | null; contractualMilestoneDate: string | null; }
export interface ProcurementLeadTimeRisk { state: "unknown" | "on_track" | "at_risk"; forecastArrivalDate: string | null; requiredOnSiteDate: string; contractualMilestoneDate: string | null; reason: string; }

function dateOnly(value: string, label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must be a date-only value.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) throw new Error(`${label} is invalid.`);
  return parsed;
}
function key(date: Date): string { return date.toISOString().slice(0, 10); }

export function assessProcurementLeadTime(input: ProcurementLeadTimeInput): ProcurementLeadTimeRisk {
  const required = dateOnly(input.requiredOnSiteDate, "Required-on-site date");
  dateOnly(input.forecastStartDate, "Forecast start date");
  if (input.contractualMilestoneDate) dateOnly(input.contractualMilestoneDate, "Contractual milestone date");
  if (input.leadTimeWorkingDays === null || !input.calendar) return { state: "unknown", forecastArrivalDate: null, requiredOnSiteDate: input.requiredOnSiteDate, contractualMilestoneDate: input.contractualMilestoneDate, reason: "Lead time or calendar is missing." };
  if (!Number.isSafeInteger(input.leadTimeWorkingDays) || input.leadTimeWorkingDays < 0 || input.calendar.version <= 0 || !input.calendar.id.trim()) throw new Error("A valid versioned calendar and non-negative lead time are required.");
  const weekdays = new Set(input.calendar.workingWeekdays);
  const holidays = new Set(input.calendar.holidays);
  const cursor = dateOnly(input.forecastStartDate, "Forecast start date");
  let remaining = input.leadTimeWorkingDays;
  while (remaining > 0) { cursor.setUTCDate(cursor.getUTCDate() + 1); if (weekdays.has(cursor.getUTCDay()) && !holidays.has(key(cursor))) remaining--; }
  const arrival = key(cursor);
  return { state: cursor > required ? "at_risk" : "on_track", forecastArrivalDate: arrival, requiredOnSiteDate: input.requiredOnSiteDate, contractualMilestoneDate: input.contractualMilestoneDate, reason: cursor > required ? "Forecast arrival is after the required-on-site date." : "Forecast arrival is on or before the required-on-site date." };
}
