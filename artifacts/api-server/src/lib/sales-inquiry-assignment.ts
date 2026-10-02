export type SalesInquiryAssignmentInput=Readonly<{expectedUpdatedAt:Date;assigned:boolean}>;

export function parseSalesInquiryAssignment(value:unknown):SalesInquiryAssignmentInput{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("SALES_INQUIRY_ASSIGNMENT_INVALID");
  const row=value as Record<string,unknown>;
  if(typeof row.assigned!=="boolean"||typeof row.expectedUpdatedAt!=="string")throw new Error("SALES_INQUIRY_ASSIGNMENT_INVALID");
  const expectedUpdatedAt=new Date(row.expectedUpdatedAt);
  if(Number.isNaN(expectedUpdatedAt.getTime())||expectedUpdatedAt.toISOString()!==row.expectedUpdatedAt)throw new Error("SALES_INQUIRY_ASSIGNMENT_INVALID");
  return Object.freeze({expectedUpdatedAt,assigned:row.assigned});
}
