export type GovernedApuRateChoice = { id: string; label: string; unitRate: string; unit: string; currency: string; apuPlanVersion: number | null };

/** Resource roles describe delivery responsibility; they never price a contract item. */
export function applyAssignmentRole(data: any, assignmentIndex: number, role: string) {
  if (!data.team?.assignments?.[assignmentIndex]) return data;
  return { ...data, team: { ...data.team, assignments: data.team.assignments.map((item: any, index: number) => index === assignmentIndex ? { ...item, role } : item) } };
}

export function governedApuRateChoices(value: unknown): GovernedApuRateChoice[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry: any) => entry && entry.id && entry.unitRate && entry.currency).map((entry: any) => ({ id: String(entry.id), label: String(entry.label || entry.id), unitRate: String(entry.unitRate), unit: String(entry.unit || "Hours"), currency: String(entry.currency), apuPlanVersion: Number.isSafeInteger(Number(entry.apuPlanVersion)) && Number(entry.apuPlanVersion) > 0 ? Number(entry.apuPlanVersion) : null }));
}

/** @deprecated Kept for older callers. Rate is deliberately ignored. */
export function applyAssignmentApuRate(data: any, assignmentIndex: number, _rate: string, role?: string) { return role ? applyAssignmentRole(data, assignmentIndex, role) : data; }
export function rateForApuProfile(_profile: string) { return null; }
export function profileForApuRate(_rate: unknown) { return ""; }
