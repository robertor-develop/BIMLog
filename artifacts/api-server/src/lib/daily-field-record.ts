export type DailyRecordState = "draft" | "in_review" | "approved";

export interface DailyRecordRevision {
  revisionId: string;
  projectId: number;
  recordDate: string;
  locationId: string;
  authorId: string;
  state: DailyRecordState;
  recordedAt: string;
}

export interface DailyFieldRecord {
  recordId: string;
  projectId: number;
  recordDate: string;
  locationId: string;
  revisions: DailyRecordRevision[];
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function dateOnly(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error("A valid daily record date is required.");
  }
  return value;
}

export function createDailyFieldRecord(input: {
  recordId: string;
  projectId: number;
  recordDate: string;
  locationId: string;
  authorId: string;
  existing: readonly DailyFieldRecord[];
  duplicatePolicy: "reject" | "allow_separate_record";
  recordedAt: string;
}): DailyFieldRecord {
  if (!Number.isSafeInteger(input.projectId) || input.projectId <= 0) throw new Error("A valid project is required.");
  if (Number.isNaN(Date.parse(input.recordedAt))) throw new Error("A valid record time is required.");
  const recordDate = dateOnly(input.recordDate);
  const locationId = required(input.locationId, "Location identity");
  const duplicate = input.existing.some(record => record.projectId === input.projectId && record.recordDate === recordDate && record.locationId === locationId);
  if (duplicate && input.duplicatePolicy === "reject") throw new Error("A daily record already exists for this project, date and location.");
  const recordId = required(input.recordId, "Daily record identity");
  const revision: DailyRecordRevision = {
    revisionId: `${recordId}:r1`, projectId: input.projectId, recordDate, locationId,
    authorId: required(input.authorId, "Author identity"), state: "draft", recordedAt: input.recordedAt,
  };
  return { recordId, projectId: input.projectId, recordDate, locationId, revisions: [revision] };
}

export function addDailyRecordRevision(record: DailyFieldRecord, revision: Omit<DailyRecordRevision, "projectId" | "recordDate" | "locationId">): DailyFieldRecord {
  if (record.revisions.some(existing => existing.revisionId === revision.revisionId)) throw new Error("Duplicate daily record revision.");
  if (Number.isNaN(Date.parse(revision.recordedAt))) throw new Error("A valid revision time is required.");
  return { ...record, revisions: [...record.revisions, { ...revision, projectId: record.projectId, recordDate: record.recordDate, locationId: record.locationId, authorId: required(revision.authorId, "Author identity") }] };
}

export function dailyRecordsForProject(records: readonly DailyFieldRecord[], projectId: number): DailyFieldRecord[] {
  return records.filter(record => record.projectId === projectId);
}
