export type SalesInquiryAssignmentHistoryQuery=Readonly<{limit:number;offset:number}>;

export function parseSalesInquiryAssignmentHistoryQuery(value:Record<string,unknown>):SalesInquiryAssignmentHistoryQuery{
  const rawLimit=value.limit??"25",rawOffset=value.offset??"0";
  if(typeof rawLimit!=="string"||typeof rawOffset!=="string"||!/^(0|[1-9]\d*)$/.test(rawLimit)||!/^(0|[1-9]\d*)$/.test(rawOffset))throw new Error("SALES_INQUIRY_HISTORY_QUERY_INVALID");
  const limit=Number(rawLimit),offset=Number(rawOffset);
  if(!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(offset)||offset<0||offset>1_000_000)throw new Error("SALES_INQUIRY_HISTORY_QUERY_INVALID");
  return Object.freeze({limit,offset});
}
