import { FEEDBACK_AGENT_MAX_ATTEMPTS } from './feedback-agent-wire';
const time=(value:unknown):string|null=>{if(!value)return null;const date=new Date(String(value));return Number.isFinite(date.getTime())?date.toISOString():null;};
export function customerFeedbackQueueProgress(row:Record<string,unknown>,now=new Date()){
  const attempts=Number(row.attempts),state=String(row.state),leaseUntil=time(row.lease_expires_at),nextAttemptAt=time(row.next_attempt_at);
  return {
    phase:state==='delivered'?'delivered':['blocked','dead-letter'].includes(state)?'needs_attention':state==='claimed'?(leaseUntil&&new Date(leaseUntil)<=now?'awaiting_recovery':'processing'):state==='retry-required'?'retry_scheduled':state==='pending'?'queued':'status_unavailable',
    attempts:Number.isSafeInteger(attempts)&&attempts>=0?attempts:0,maxAttempts:FEEDBACK_AGENT_MAX_ATTEMPTS,
    processingUntil:state==='claimed'?leaseUntil:null,nextAttemptAt:['pending','retry-required'].includes(state)?nextAttemptAt:null,observedAt:now.toISOString(),
  };
}
