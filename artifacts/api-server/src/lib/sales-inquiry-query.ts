import { SALES_INQUIRY_STATUSES, type SalesInquiryStatus } from "./sales-inquiry-operations";

export type SalesInquiryListQuery = Readonly<{
  status: "" | SalesInquiryStatus;
  search: string;
  limit: number;
  offset: number;
}>;

export function parseSalesInquiryListQuery(query: Record<string, unknown>): SalesInquiryListQuery {
  const status = typeof query.status === "string" ? query.status.trim() : "";
  if (status && !SALES_INQUIRY_STATUSES.includes(status as SalesInquiryStatus)) throw new Error("SALES_INQUIRY_STATUS_INVALID");
  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search.length > 120) throw new Error("SALES_INQUIRY_SEARCH_INVALID");
  const limit = query.limit === undefined ? 25 : Number(query.limit);
  const offset = query.offset === undefined ? 0 : Number(query.offset);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("SALES_INQUIRY_LIMIT_INVALID");
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) throw new Error("SALES_INQUIRY_OFFSET_INVALID");
  return Object.freeze({ status: status as "" | SalesInquiryStatus, search, limit, offset });
}
