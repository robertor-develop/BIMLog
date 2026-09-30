export const PROJECT_DATA_CLASSES = ["customer", "synthetic", "demo", "training"] as const;
export type ProjectDataClass = (typeof PROJECT_DATA_CLASSES)[number];

export type ProjectClassification = Readonly<{
  projectId: number;
  dataClass: ProjectDataClass;
  explicitlyClassified: true;
  classifiedBy: string;
  classifiedAt: string;
  reason: string;
}>;

export type RolloutEnrollment = Readonly<{
  projectId: number;
  cohortId: string;
  reviewedBy: string;
  reviewedAt: string;
  reason: string;
}>;

export type PreparedRolloutCohort = Readonly<{
  cohortId: string;
  eligibleProjectIds: readonly number[];
  excluded: readonly Readonly<{ projectId: number; reason: string }>[];
  writesPerformed: 0;
}>;

function validEvidence(actor: string, at: string, reason: string) {
  return actor.trim() && reason.trim() && !Number.isNaN(Date.parse(at));
}

export function prepareRolloutCohort(
  cohortId: string,
  classifications: readonly ProjectClassification[],
  enrollments: readonly RolloutEnrollment[],
): PreparedRolloutCohort {
  if (!cohortId.trim()) throw new Error("COHORT_ID_REQUIRED");
  const byProject = new Map<number, ProjectClassification>();
  for (const item of classifications) {
    if (!Number.isSafeInteger(item.projectId) || item.projectId <= 0 || item.explicitlyClassified !== true || !PROJECT_DATA_CLASSES.includes(item.dataClass) || !validEvidence(item.classifiedBy, item.classifiedAt, item.reason)) throw new Error("EXPLICIT_PROJECT_CLASSIFICATION_REQUIRED");
    if (byProject.has(item.projectId)) throw new Error("DUPLICATE_PROJECT_CLASSIFICATION");
    byProject.set(item.projectId, item);
  }

  const eligibleProjectIds: number[] = [];
  const excluded: Array<{ projectId: number; reason: string }> = [];
  for (const enrollment of enrollments.filter((item) => item.cohortId === cohortId)) {
    const classification = byProject.get(enrollment.projectId);
    if (!classification) {
      excluded.push({ projectId: enrollment.projectId, reason: "classification_missing" });
      continue;
    }
    if (!validEvidence(enrollment.reviewedBy, enrollment.reviewedAt, enrollment.reason)) {
      excluded.push({ projectId: enrollment.projectId, reason: "enrollment_review_missing" });
      continue;
    }
    eligibleProjectIds.push(enrollment.projectId);
  }
  return Object.freeze({ cohortId, eligibleProjectIds: [...new Set(eligibleProjectIds)].sort((a, b) => a - b), excluded: excluded.sort((a, b) => a.projectId - b.projectId), writesPerformed: 0 });
}

export function inferProjectClassificationFromName(_name: string): never {
  throw new Error("NAME_BASED_PROJECT_CLASSIFICATION_PROHIBITED");
}
