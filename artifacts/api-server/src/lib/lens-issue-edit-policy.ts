export const LENS_ISSUE_STATUSES = ["open", "follow_up", "waiting_design", "approved", "resolved"] as const;
export type LensIssueStatus = typeof LENS_ISSUE_STATUSES[number];
export const LENS_ISSUE_REPORT_TYPES = ["SHOP", "SLEEVE", "COORDINATION", "FIELD", "OTHER"] as const;
export const LENS_ISSUE_BASE_TRADES = ["Architectural", "Electrical", "Fire Protection", "General Contractor", "Geothermal", "HVAC", "Mechanical", "Owner", "Plumbing", "Pool", "Structural", "Other"] as const;

const transitions: Record<LensIssueStatus, readonly LensIssueStatus[]> = {
  open: ["follow_up", "waiting_design", "approved", "resolved"],
  follow_up: ["open", "waiting_design", "approved", "resolved"],
  waiting_design: ["open", "follow_up", "approved", "resolved"],
  approved: ["open", "resolved"],
  resolved: ["open"],
};

export function assertLensIssueStatusTransition(from: string, to: string): void {
  if (from === to) return;
  if (!(LENS_ISSUE_STATUSES as readonly string[]).includes(from) || !(LENS_ISSUE_STATUSES as readonly string[]).includes(to)
    || !transitions[from as LensIssueStatus].includes(to as LensIssueStatus)) {
    throw new Error(`LENS_ISSUE_STATUS_TRANSITION_INVALID:${from}:${to}`);
  }
}

export function normalizeGovernedLabel(value: unknown, field: string, max = 256): string {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > max) throw new Error(`LENS_ISSUE_FIELD_INVALID:${field}`);
  return normalized;
}

export function assertCatalogLabel(value: string, allowed: readonly string[], field: string): string {
  const match = allowed.find(option => option.localeCompare(value, "en-US", { sensitivity: "base" }) === 0);
  if (!match) throw new Error(`LENS_ISSUE_CATALOG_VALUE_FORBIDDEN:${field}`);
  return match;
}
