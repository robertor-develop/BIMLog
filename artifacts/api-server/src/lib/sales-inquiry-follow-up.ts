export type SalesInquiryFollowUpInput=Readonly<{note:string;expectedUpdatedAt:Date}>;
export function parseSalesInquiryFollowUp(value:unknown):SalesInquiryFollowUpInput{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("SALES_INQUIRY_FOLLOW_UP_INVALID");
  const row=value as Record<string,unknown>;
  if(typeof row.note!=="string"||typeof row.expectedUpdatedAt!=="string")throw new Error("SALES_INQUIRY_FOLLOW_UP_INVALID");
  const note=row.note.trim(),expectedUpdatedAt=new Date(row.expectedUpdatedAt);
  if(note.length<2||note.length>4000||Number.isNaN(expectedUpdatedAt.getTime())||expectedUpdatedAt.toISOString()!==row.expectedUpdatedAt)throw new Error("SALES_INQUIRY_FOLLOW_UP_INVALID");
  return Object.freeze({note,expectedUpdatedAt});
}
