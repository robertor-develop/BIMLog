export type SchedulePlacement = {
  commitmentId: string;
  sourceKind: string;
  sourceId: string;
  sourceVersion: number;
  contractualDueDate?: string;
  plannedStart: string;
  plannedFinish: string;
  placementVersion: number;
};

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("SCHEDULE_PLACEMENT_DATE_INVALID");
  return value;
}

export function placeMeetingCommitment(input: Omit<SchedulePlacement, "placementVersion"> & { prior?: SchedulePlacement }): SchedulePlacement {
  validDate(input.plannedStart);
  validDate(input.plannedFinish);
  if (input.plannedFinish < input.plannedStart) throw new Error("SCHEDULE_PLACEMENT_RANGE_INVALID");
  if (input.prior) {
    if (input.prior.commitmentId !== input.commitmentId || input.prior.sourceKind !== input.sourceKind || input.prior.sourceId !== input.sourceId) throw new Error("SCHEDULE_PLACEMENT_IDENTITY_MISMATCH");
    if (input.prior.contractualDueDate !== input.contractualDueDate) throw new Error("SOURCE_CONTRACTUAL_DATE_IMMUTABLE");
    if (input.sourceVersion < input.prior.sourceVersion) throw new Error("SCHEDULE_SOURCE_VERSION_STALE");
  }
  return Object.freeze({ commitmentId: input.commitmentId, sourceKind: input.sourceKind, sourceId: input.sourceId, sourceVersion: input.sourceVersion, contractualDueDate: input.contractualDueDate, plannedStart: input.plannedStart, plannedFinish: input.plannedFinish, placementVersion: (input.prior?.placementVersion ?? 0) + 1 });
}
