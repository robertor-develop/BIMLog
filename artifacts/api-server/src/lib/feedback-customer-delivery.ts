export function customerFeedbackDeliveryReceipt(row: Record<string,unknown>): {receiptId:string;caseRevision:number;settledAt:string}|null {
  if(row.state!=='delivered'||typeof row.receipt_id!=='string'||!/^bimlog-feedback-[a-f0-9]{64}$/.test(row.receipt_id)||!Number.isSafeInteger(Number(row.receipt_revision))||Number(row.receipt_revision)<=0||!row.settled_at)return null;
  const timestamp=new Date(String(row.settled_at));if(!Number.isFinite(timestamp.getTime()))return null;
  return {receiptId:row.receipt_id,caseRevision:Number(row.receipt_revision),settledAt:timestamp.toISOString()};
}
