export type FeedbackScanAuditEvent = { id:number; eventType:string; afterState:unknown; createdAt:Date };

const SAFE_SCAN_REASONS:Record<string,string>={
  FEEDBACK_SCAN_SOURCE_MISMATCH:"Stored evidence did not match its recorded authority and remains quarantined.",
  FEEDBACK_SCANNER_UNAVAILABLE:"The governed scanner could not complete; retry is required and evidence remains quarantined.",
};
export function reviewerScanFailureProjection(event:FeedbackScanAuditEvent){
  if(event.eventType!=="evidence_scan_failed"||!event.afterState||typeof event.afterState!=="object"||Array.isArray(event.afterState))return null;
  const state=event.afterState as Record<string,unknown>,assetId=Number(state.assetId);if(!Number.isSafeInteger(assetId)||assetId<1)return null;
  const candidate=String(state.errorCode||"");const errorCode=/^FEEDBACK_[A-Z0-9_]{1,72}$/.test(candidate)?candidate:"FEEDBACK_SCANNER_UNAVAILABLE";
  return {eventId:event.id,assetId,state:"retry-required" as const,errorCode,reason:SAFE_SCAN_REASONS[errorCode]||"The governed scanner failed closed; retry is required and evidence remains quarantined.",retryable:true,createdAt:event.createdAt};
}
