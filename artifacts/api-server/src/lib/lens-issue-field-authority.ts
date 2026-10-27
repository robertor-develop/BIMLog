export type LensIssueFieldAuthority = {
  field: "trade" | "floor" | "responsibleCompany" | "reportType" | "priority" | "status" | "instruction" | "openItems" | "auditReason";
  authority: string;
  scope: "project" | "workflow" | "issue";
  governed: boolean;
  writePermission: "project_write" | "workflow_transition" | "issue_write";
};

export const lensIssueFieldAuthorities: readonly LensIssueFieldAuthority[] = Object.freeze([
  { field: "trade", authority: "BIMLog project trade catalog", scope: "project", governed: true, writePermission: "project_write" },
  { field: "floor", authority: "BIMLog project levels", scope: "project", governed: true, writePermission: "project_write" },
  { field: "responsibleCompany", authority: "BIMLog project directory and active project members", scope: "project", governed: true, writePermission: "project_write" },
  { field: "reportType", authority: "BIMLog Lens report-type policy", scope: "project", governed: true, writePermission: "project_write" },
  { field: "priority", authority: "BIMLog Lens priority policy", scope: "project", governed: true, writePermission: "project_write" },
  { field: "status", authority: "BIMLog Lens workflow transition policy", scope: "workflow", governed: true, writePermission: "workflow_transition" },
  { field: "instruction", authority: "BIMLog Issue record", scope: "issue", governed: false, writePermission: "issue_write" },
  { field: "openItems", authority: "BIMLog Issue record", scope: "issue", governed: false, writePermission: "issue_write" },
  { field: "auditReason", authority: "BIMLog immutable activity policy", scope: "workflow", governed: true, writePermission: "issue_write" },
]);

export type LensResponsibleCompanyOption = {
  id: number | null;
  label: string;
  historicalLabel: string;
  active: boolean;
  projectAuthorized: boolean;
  assignable: boolean;
  source: "project_directory" | "project_member" | "naming_convention" | "historical_issue";
  unavailabilityReason: "inactive" | "not_project_authorized" | "historical_only" | null;
};

export function uniqueLensResponsibleCompanyOptions(values: readonly LensResponsibleCompanyOption[]): LensResponsibleCompanyOption[] {
  const byIdentity = new Map<string, LensResponsibleCompanyOption>();
  for (const value of values) {
    const label = value.label.trim().replace(/\s+/g, " ");
    if (!label) continue;
    const key = value.id == null ? `label:${label.toLocaleLowerCase("en-US")}` : `id:${value.id}`;
    const normalized = { ...value, label, historicalLabel: value.historicalLabel.trim() || label };
    const prior = byIdentity.get(key);
    if (!prior || (!prior.assignable && normalized.assignable)) byIdentity.set(key, normalized);
  }
  return [...byIdentity.values()].sort((a, b) => a.label.localeCompare(b.label));
}
