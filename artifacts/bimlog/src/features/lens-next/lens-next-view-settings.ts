import type { LensNextIssue, LensNextStatus } from "./lens-next-types";

export const LENS_NEXT_VIEW_DIMENSIONS = [
  "status",
  "floor",
  "trade",
  "responsibleCompany",
  "priority",
  "phase",
  "reportType",
] as const;

export type LensNextViewDimension = (typeof LENS_NEXT_VIEW_DIMENSIONS)[number];
export type LensNextViewScope = "personal" | "project" | "published";
export type LensNextViewPresetId =
  | "status_only"
  | "floor_trade_company"
  | "floor_company_trade"
  | "company_floor_trade"
  | "company_trade_floor"
  | "trade_floor_company"
  | "trade_company_floor"
  | "custom";

export interface LensNextViewSettings {
  id: string;
  name: string;
  scope: LensNextViewScope;
  preset: LensNextViewPresetId;
  groupBy: readonly LensNextViewDimension[];
  hideResolved: boolean;
  statuses: readonly LensNextStatus[];
  priorityMaximum: number | null;
  ownerUserId: string | null;
  projectId: number;
  updatedAt: string;
}

export interface LensNextIssueWithPhase extends LensNextIssue {
  phase?: string | null;
}

export interface LensNextIssueGroupNode {
  key: string;
  label: string;
  dimension: LensNextViewDimension | null;
  issues: readonly LensNextIssueWithPhase[];
  children: readonly LensNextIssueGroupNode[];
}

const PRESETS: Readonly<Record<Exclude<LensNextViewPresetId, "custom">, readonly LensNextViewDimension[]>> = Object.freeze({
  status_only: ["status"],
  floor_trade_company: ["floor", "trade", "responsibleCompany"],
  floor_company_trade: ["floor", "responsibleCompany", "trade"],
  company_floor_trade: ["responsibleCompany", "floor", "trade"],
  company_trade_floor: ["responsibleCompany", "trade", "floor"],
  trade_floor_company: ["trade", "floor", "responsibleCompany"],
  trade_company_floor: ["trade", "responsibleCompany", "floor"],
});

export const LENS_NEXT_VIEW_PRESETS = PRESETS;

function nonEmpty(value: string | null | undefined, fallback: string): string {
  const normalized = (value ?? "").trim();
  return normalized || fallback;
}

function dimensionValue(issue: LensNextIssueWithPhase, dimension: LensNextViewDimension): string {
  switch (dimension) {
    case "status":
      return issue.status;
    case "floor":
      return nonEmpty(issue.floor, "Unassigned floor");
    case "trade":
      return nonEmpty(issue.trade, "Unassigned trade");
    case "responsibleCompany":
      return nonEmpty(issue.responsibleCompany, "Unassigned company");
    case "priority":
      return issue.priority === null ? "No priority" : `P${issue.priority}`;
    case "phase":
      return nonEmpty(issue.phase, "Unassigned phase");
    case "reportType":
      return nonEmpty(issue.reportType, "Unassigned type");
  }
}

export function resolveLensNextGrouping(settings: LensNextViewSettings): readonly LensNextViewDimension[] {
  if (settings.preset === "custom") {
    const unique = [...new Set(settings.groupBy)];
    if (unique.length === 0 || unique.length > 4) throw new Error("CUSTOM_GROUPING_INVALID");
    if (unique.some((value) => !LENS_NEXT_VIEW_DIMENSIONS.includes(value))) {
      throw new Error("CUSTOM_GROUPING_UNKNOWN_DIMENSION");
    }
    return unique;
  }
  return PRESETS[settings.preset];
}

export function validateLensNextViewSettings(settings: LensNextViewSettings): LensNextViewSettings {
  if (!Number.isSafeInteger(settings.projectId) || settings.projectId <= 0) {
    throw new Error("VIEW_PROJECT_INVALID");
  }
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(settings.id)) throw new Error("VIEW_ID_INVALID");
  if (!settings.name.trim() || settings.name.length > 96) throw new Error("VIEW_NAME_INVALID");
  if (settings.scope === "personal" && !settings.ownerUserId) throw new Error("PERSONAL_VIEW_OWNER_REQUIRED");
  if (settings.scope !== "personal" && settings.ownerUserId !== null) throw new Error("SHARED_VIEW_OWNER_FORBIDDEN");
  if (settings.priorityMaximum !== null && (!Number.isInteger(settings.priorityMaximum) || settings.priorityMaximum < 1 || settings.priorityMaximum > 5)) {
    throw new Error("VIEW_PRIORITY_INVALID");
  }
  resolveLensNextGrouping(settings);
  return Object.freeze({ ...settings, groupBy: Object.freeze([...settings.groupBy]), statuses: Object.freeze([...settings.statuses]) });
}

export function filterIssuesForLensNextView(
  issues: readonly LensNextIssueWithPhase[],
  settings: LensNextViewSettings,
): readonly LensNextIssueWithPhase[] {
  validateLensNextViewSettings(settings);
  const statusSet = new Set(settings.statuses);
  return issues.filter((issue) => {
    if (issue.identity.projectId !== settings.projectId) return false;
    if (settings.hideResolved && issue.status === "resolved") return false;
    if (statusSet.size > 0 && !statusSet.has(issue.status)) return false;
    if (settings.priorityMaximum !== null && issue.priority !== null && issue.priority > settings.priorityMaximum) return false;
    return true;
  });
}

function groupLevel(
  issues: readonly LensNextIssueWithPhase[],
  dimensions: readonly LensNextViewDimension[],
  depth: number,
): readonly LensNextIssueGroupNode[] {
  if (depth >= dimensions.length) return [];
  const dimension = dimensions[depth];
  const buckets = new Map<string, LensNextIssueWithPhase[]>();
  for (const issue of issues) {
    const label = dimensionValue(issue, dimension);
    const key = `${dimension}:${label.toLocaleLowerCase("en-US")}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(issue);
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .sort((left, right) => left[0].localeCompare(right[0], "en-US"))
    .map(([key, bucket]) => ({
      key,
      label: dimensionValue(bucket[0], dimension),
      dimension,
      issues: depth === dimensions.length - 1 ? Object.freeze([...bucket]) : Object.freeze([]),
      children: Object.freeze(groupLevel(bucket, dimensions, depth + 1)),
    }));
}

export function buildLensNextIssueGroups(
  issues: readonly LensNextIssueWithPhase[],
  settings: LensNextViewSettings,
): readonly LensNextIssueGroupNode[] {
  const filtered = filterIssuesForLensNextView(issues, settings);
  const grouping = resolveLensNextGrouping(settings);
  return Object.freeze(groupLevel(filtered, grouping, 0));
}

export function defaultLensNextPersonalView(projectId: number, userId: string, nowIso: string): LensNextViewSettings {
  return validateLensNextViewSettings({
    id: `personal:${projectId}:${userId}`,
    name: "My coordination view",
    scope: "personal",
    preset: "status_only",
    groupBy: ["status"],
    hideResolved: false,
    statuses: [],
    priorityMaximum: null,
    ownerUserId: userId,
    projectId,
    updatedAt: nowIso,
  });
}

export const LENS_NEXT_VIEW_INVARIANTS = Object.freeze({
  folderOrGroupingControlsIdentity: false,
  personalViewMayChangeOtherUsers: false,
  projectViewChangesIssueData: false,
  publishedViewChangesIssueIdentity: false,
  maximumGroupingDepth: 4,
  legacySevenLayoutsRepresented: true,
});
