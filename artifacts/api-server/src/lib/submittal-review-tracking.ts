export type SubmittalTrackingState = "required" | "received" | "reviewed" | "overdue";

export interface PlannedSubmittalRequirement {
  id: string;
  projectId: number;
  number: string;
  title: string;
  requiredAt: Date | string | null;
  reviewerCompany: string | null;
}

export interface ReceivedSubmittalPackage {
  id: number;
  projectId: number;
  requirementId: string | null;
  number: string;
  title: string;
  revisionNumber: number | null;
  submittedAt: Date | string | null;
  reviewedAt: Date | string | null;
  reviewerCompany: string | null;
}

export interface SubmittalTrackingRow {
  identity: string;
  requirementId: string | null;
  projectId: number;
  number: string;
  title: string;
  reviewerCompany: string | null;
  requiredAt: string | null;
  state: SubmittalTrackingState;
  currentPackageId: number | null;
  currentRevisionNumber: number | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  packageIds: number[];
  sourceLinks: string[];
}

function iso(value: Date | string | null): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function companyKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

export function submittalReviewTracking(input: {
  projectId: number;
  now: Date | string;
  requirements: readonly PlannedSubmittalRequirement[];
  packages: readonly ReceivedSubmittalPackage[];
  reviewerCompany?: string | null;
}) {
  const now = new Date(input.now);
  if (!Number.isFinite(now.getTime())) throw new Error("Submittal tracking requires a valid now instant");
  const filterKey = companyKey(input.reviewerCompany);
  const packageById = new Map<number, ReceivedSubmittalPackage>();
  for (const item of input.packages) {
    if (item.projectId !== input.projectId) continue;
    packageById.set(item.id, item);
  }

  const requirementById = new Map<string, PlannedSubmittalRequirement>();
  for (const requirement of input.requirements) {
    if (requirement.projectId !== input.projectId) continue;
    requirementById.set(requirement.id, requirement);
  }

  const rows: SubmittalTrackingRow[] = [...requirementById.values()].map(requirement => {
    const packages = [...packageById.values()]
      .filter(item => item.requirementId === requirement.id)
      .sort((a, b) => (a.revisionNumber ?? 0) - (b.revisionNumber ?? 0) || a.id - b.id);
    const currentPackage = packages.at(-1) ?? null;
    const requiredAt = iso(requirement.requiredAt);
    const reviewedAt = currentPackage ? iso(currentPackage.reviewedAt) : null;
    const submittedAt = currentPackage ? iso(currentPackage.submittedAt) : null;
    const overdue = Boolean(requiredAt && new Date(requiredAt).getTime() < now.getTime() && !reviewedAt);
    const state: SubmittalTrackingState = reviewedAt ? "reviewed" : overdue ? "overdue" : submittedAt ? "received" : "required";
    return {
      identity: `requirement:${requirement.id}`,
      requirementId: requirement.id,
      projectId: requirement.projectId,
      number: requirement.number,
      title: requirement.title,
      reviewerCompany: requirement.reviewerCompany,
      requiredAt,
      state,
      currentPackageId: currentPackage?.id ?? null,
      currentRevisionNumber: currentPackage?.revisionNumber ?? null,
      submittedAt,
      reviewedAt,
      packageIds: packages.map(item => item.id),
      sourceLinks: [
        `/projects/${requirement.projectId}/submittals/register?requirement=${encodeURIComponent(requirement.id)}`,
        ...packages.map(item => `/projects/${item.projectId}/submittals/${item.id}`),
      ],
    };
  });

  for (const item of packageById.values()) {
    if (item.requirementId && requirementById.has(item.requirementId)) continue;
    const submittedAt = iso(item.submittedAt);
    const reviewedAt = iso(item.reviewedAt);
    rows.push({
      identity: `unmatched-package:${item.id}`,
      requirementId: item.requirementId,
      projectId: item.projectId,
      number: item.number,
      title: item.title,
      reviewerCompany: item.reviewerCompany,
      requiredAt: null,
      state: reviewedAt ? "reviewed" : "received",
      currentPackageId: item.id,
      currentRevisionNumber: item.revisionNumber,
      submittedAt,
      reviewedAt,
      packageIds: [item.id],
      sourceLinks: [`/projects/${item.projectId}/submittals/${item.id}`],
    });
  }

  const filtered = filterKey
    ? rows.filter(row => companyKey(row.reviewerCompany) === filterKey)
    : rows;
  return filtered.sort((a, b) => a.number.localeCompare(b.number) || a.identity.localeCompare(b.identity));
}
