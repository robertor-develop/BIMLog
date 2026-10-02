import { SALES_INQUIRY_STATUSES, type SalesInquiryStatus } from "./sales-inquiry-operations";

export type SalesInquiryListQuery = Readonly<{
  status: "" | SalesInquiryStatus;
  search: string;
  overdue: boolean;
  assignment: "" | "mine" | "unassigned";
  limit: number;
  offset: number;
}>;

export function parseSalesInquiryListQuery(query: Record<string, unknown>): SalesInquiryListQuery {
  const status = typeof query.status === "string" ? query.status.trim() : "";
  if (status && !SALES_INQUIRY_STATUSES.includes(status as SalesInquiryStatus)) throw new Error("SALES_INQUIRY_STATUS_INVALID");
  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search.length > 120) throw new Error("SALES_INQUIRY_SEARCH_INVALID");
  const overdue=query.overdue===undefined||query.overdue===""?false:query.overdue==="true";
  if(query.overdue!==undefined&&query.overdue!==""&&query.overdue!=="true"&&query.overdue!=="false")throw new Error("SALES_INQUIRY_OVERDUE_INVALID");
  const assignment=typeof query.assignment==="string"?query.assignment.trim():"";
  if(assignment!==""&&assignment!=="mine"&&assignment!=="unassigned")throw new Error("SALES_INQUIRY_ASSIGNMENT_SCOPE_INVALID");
  const limit = query.limit === undefined ? 25 : Number(query.limit);
  const offset = query.offset === undefined ? 0 : Number(query.offset);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("SALES_INQUIRY_LIMIT_INVALID");
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) throw new Error("SALES_INQUIRY_OFFSET_INVALID");
  return Object.freeze({ status: status as "" | SalesInquiryStatus, search, overdue, assignment:assignment as ""|"mine"|"unassigned", limit, offset });
}
