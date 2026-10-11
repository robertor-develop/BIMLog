export type DataRequestFulfillmentReceipt={receiptReference:string;summary:string;decisionState:"approved"|"partially_approved";fulfilledAt:string};
const reference=/^[A-Z0-9][A-Z0-9._\/-]{5,79}$/i;
export function parseDataRequestFulfillmentReceipt(value:unknown):DataRequestFulfillmentReceipt{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Invalid fulfillment receipt response");
  const item=(value as Record<string,unknown>).item;
  if(!item||typeof item!=="object"||Array.isArray(item))throw new Error("Invalid fulfillment receipt response");
  const row=item as Record<string,unknown>,receiptReference=typeof row.receiptReference==="string"?row.receiptReference.trim():"",summary=typeof row.summary==="string"?row.summary.trim():"",decisionState=row.decisionState,fulfilledAt=typeof row.fulfilledAt==="string"&&Number.isFinite(Date.parse(row.fulfilledAt))?new Date(row.fulfilledAt).toISOString():"";
  if(!reference.test(receiptReference)||summary.length<10||summary.length>2000||(decisionState!=="approved"&&decisionState!=="partially_approved")||!fulfilledAt)throw new Error("Invalid fulfillment receipt response");
  return Object.freeze({receiptReference,summary,decisionState,fulfilledAt});
}
