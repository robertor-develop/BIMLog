export type RfiRegisterDateField = "created" | "requested" | "required" | "answered";
export type RfiRegisterSort = "created_asc" | "created_desc" | "required_asc" | "required_desc" | "number_asc" | "number_desc" | "status_asc";
export type RfiRegisterFilters = {
  status: string;
  search: string;
  rfiType: string;
  ballInCourt: string;
  sentToCompany: string;
  dateField: RfiRegisterDateField;
  dateFrom: Date | null;
  dateTo: Date | null;
  sort: RfiRegisterSort;
};

export type RfiQueryRecord = {
  number: string;
  subject: string;
  status: string;
  rfiType?: string | null;
  ballInCourt?: string | null;
  submittedByCompany?: string | null;
  submittedByContact?: string | null;
  submittedToCompany?: string | null;
  submittedToPerson?: string | null;
  sendStatus?: string | null;
  sentAt?: Date | string | null;
  createdAt: Date | string;
  dateRequested?: Date | string | null;
  dateRequired?: Date | string | null;
  dueDate?: Date | string | null;
  dateAnswered?: Date | string | null;
  respondedAt?: Date | string | null;
  createdById: number;
};

export class RfiQueryValidationError extends Error {
  readonly status = 400;
}

function textQuery(value: unknown, fallback = ""): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.trim().slice(0, 160) : fallback;
}

function parseDateQuery(value: unknown, label: string): Date | null {
  const raw = textQuery(value);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new RfiQueryValidationError(`Invalid ${label}.`);
  const parsed = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) throw new RfiQueryValidationError(`Invalid ${label}.`);
  return parsed;
}

export function rfiRegisterDateValue(rfi: RfiQueryRecord, field: RfiRegisterDateField) {
  if (field === "requested") return rfi.dateRequested || rfi.createdAt;
  if (field === "required") return rfi.dateRequired || rfi.dueDate;
  if (field === "answered") return rfi.dateAnswered || rfi.respondedAt;
  return rfi.createdAt;
}

export function rfiRegisterBallInCourt(rfi: RfiQueryRecord, creatorNames: ReadonlyMap<number, string>) {
  if (rfi.status === "closed") return "Closed";
  if (rfi.sendStatus !== "sent" && !rfi.sentAt) return `${rfi.submittedByCompany || creatorNames.get(rfi.createdById) || "Author"} — to send`;
  const storedResponsibility = rfi.ballInCourt?.trim();
  if (storedResponsibility) return storedResponsibility;
  if (rfi.status === "responded") return rfi.submittedByCompany || creatorNames.get(rfi.createdById) || "Unassigned";
  return rfi.submittedToCompany || rfi.submittedToPerson || "Unassigned";
}

export function parseRfiRegisterFilters(query: Record<string, unknown>): RfiRegisterFilters {
  const dateField = textQuery(query.date_field, "required");
  const sort = textQuery(query.sort, "created_asc");
  if (!["created", "requested", "required", "answered"].includes(dateField)) throw new RfiQueryValidationError("Invalid RFI date field.");
  if (!["created_asc", "created_desc", "required_asc", "required_desc", "number_asc", "number_desc", "status_asc"].includes(sort)) throw new RfiQueryValidationError("Invalid RFI sort.");
  const dateFrom = parseDateQuery(query.date_from, "date_from");
  const dateTo = parseDateQuery(query.date_to, "date_to");
  if (dateFrom && dateTo && dateFrom > dateTo) throw new RfiQueryValidationError("date_from must be on or before date_to.");
  return {
    status: textQuery(query.status, "all") || "all",
    search: textQuery(query.search),
    rfiType: textQuery(query.rfi_type, "all") || "all",
    ballInCourt: textQuery(query.ball_in_court, "all") || "all",
    sentToCompany: textQuery(query.sent_to_company, "all") || "all",
    dateField: dateField as RfiRegisterDateField,
    dateFrom,
    dateTo,
    sort: sort as RfiRegisterSort,
  };
}

export function filterRfisForRegister<T extends RfiQueryRecord>(rfis: T[], filters: RfiRegisterFilters, creatorNames: ReadonlyMap<number, string>): T[] {
  const q = filters.search.trim().toLowerCase();
  return rfis.filter(rfi => filters.status === "all" || rfi.status === filters.status)
    .filter(rfi => filters.rfiType === "all" || (rfi.rfiType || "") === filters.rfiType)
    .filter(rfi => filters.ballInCourt === "all" || rfiRegisterBallInCourt(rfi, creatorNames) === filters.ballInCourt)
    .filter(rfi => filters.sentToCompany === "all" || (rfi.submittedToCompany || rfi.submittedToPerson || "") === filters.sentToCompany)
    .filter(rfi => {
      if (!filters.dateFrom && !filters.dateTo) return true;
      const value = rfiRegisterDateValue(rfi, filters.dateField);
      if (!value) return false;
      const date = new Date(value);
      if (filters.dateFrom && date < filters.dateFrom) return false;
      if (filters.dateTo) { const end = new Date(filters.dateTo); end.setHours(23, 59, 59, 999); if (date > end) return false; }
      return true;
    })
    .filter(rfi => !q || [rfi.number, rfi.subject, rfi.rfiType, rfiRegisterBallInCourt(rfi, creatorNames), rfi.submittedByCompany, rfi.submittedByContact, rfi.submittedToCompany, rfi.submittedToPerson].some(value => String(value || "").toLowerCase().includes(q)))
    .sort((left, right) => {
      if (filters.sort === "created_desc") return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      if (filters.sort === "required_asc" || filters.sort === "required_desc") {
        const l = new Date(left.dateRequired || left.dueDate || "9999-12-31").getTime();
        const r = new Date(right.dateRequired || right.dueDate || "9999-12-31").getTime();
        return filters.sort === "required_desc" ? r - l : l - r;
      }
      if (filters.sort === "number_asc" || filters.sort === "number_desc") {
        const result = left.number.localeCompare(right.number, undefined, { numeric: true, sensitivity: "base" });
        return filters.sort === "number_desc" ? -result : result;
      }
      if (filters.sort === "status_asc") return `${left.status}-${left.number}`.localeCompare(`${right.status}-${right.number}`, undefined, { numeric: true, sensitivity: "base" });
      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    });
}
