export type SubmittalListRecord = {
  id: number;
  projectId: number;
  title: string;
  number: string;
  status: string;
  submittalCategory?: string | null;
  submittalType?: string | null;
  specSection?: string | null;
  manufacturer?: string | null;
  createdAt: string;
};

export type SubmittalListQuery = {
  search: string;
  status: string;
  type: string;
};

export const EMPTY_SUBMITTAL_LIST_QUERY: SubmittalListQuery = {
  search: "",
  status: "",
  type: "",
};

export function normalizeSubmittalListQuery(query: Partial<SubmittalListQuery>): SubmittalListQuery {
  return {
    search: String(query.search ?? "").trim(),
    status: String(query.status ?? "").trim(),
    type: String(query.type ?? "").trim(),
  };
}

export function filterSubmittals<T extends SubmittalListRecord>(records: T[], rawQuery: Partial<SubmittalListQuery>): T[] {
  const query = normalizeSubmittalListQuery(rawQuery);
  const search = query.search.toLocaleLowerCase();
  return records.filter((record) => {
    const searchable = [record.title, record.number, record.specSection, record.manufacturer]
      .map((value) => String(value ?? "").toLocaleLowerCase());
    const matchesSearch = !search || searchable.some((value) => value.includes(search));
    const matchesStatus = !query.status || record.status === query.status;
    const matchesType = !query.type
      || record.submittalCategory === query.type
      || record.submittalType === query.type;
    return matchesSearch && matchesStatus && matchesType;
  });
}

export function countSubmittalStates<T extends SubmittalListRecord>(records: T[], now = new Date()) {
  const pending = records.filter((record) => !["approved", "approved_as_noted", "rejected"].includes(record.status)).length;
  const approved = records.filter((record) => ["approved", "approved_as_noted"].includes(record.status)).length;
  const actionNeeded = records.filter((record) => {
    if (!["submitted", "under_review"].includes(record.status)) return false;
    const createdAt = new Date(record.createdAt);
    if (Number.isNaN(createdAt.getTime())) return false;
    return Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000) > 14;
  }).length;
  return { pending, approved, actionNeeded };
}

export function resolveSubmittalDeepLink<T extends SubmittalListRecord>(records: T[], value: string | null): T | null {
  const requestedId = Number(value);
  if (!Number.isInteger(requestedId) || requestedId <= 0) return null;
  return records.find((record) => record.id === requestedId) ?? null;
}
