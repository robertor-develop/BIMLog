export const feedbackTelegramConfigurationDecision = (configured: boolean, optedInReviewerCount: number) => !configured ? "provider-not-configured" : optedInReviewerCount < 1 ? "no-opted-in-reviewer" : "ready";

export const FEEDBACK_TELEGRAM_MAX_ATTEMPTS = 3;
export const FEEDBACK_TELEGRAM_STALE_SENDING_MS = 10 * 60_000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000] as const;

export type FeedbackTelegramAttemptState = "sending" | "sent" | "failed" | "skipped" | "unknown";
export type FeedbackTelegramAttempt = {
  state: FeedbackTelegramAttemptState;
  attemptNumber: number;
  createdAt: Date;
  nextAttemptAt?: Date | null;
};

export function feedbackTelegramAttemptDecision(previous: FeedbackTelegramAttempt | null, now: Date):
  | { action: "send"; attemptNumber: number }
  | { action: "wait" }
  | { action: "mark-unknown"; attemptNumber: number }
  | { action: "manual-review" } {
  if (!previous) return { action: "send", attemptNumber: 1 };
  if (previous.state === "sent" || previous.state === "skipped" || previous.state === "unknown") return { action: "manual-review" };
  if (previous.state === "sending") {
    return now.getTime() - previous.createdAt.getTime() >= FEEDBACK_TELEGRAM_STALE_SENDING_MS
      ? { action: "mark-unknown", attemptNumber: previous.attemptNumber }
      : { action: "wait" };
  }
  if (previous.attemptNumber >= FEEDBACK_TELEGRAM_MAX_ATTEMPTS) return { action: "manual-review" };
  if (previous.nextAttemptAt && previous.nextAttemptAt.getTime() > now.getTime()) return { action: "wait" };
  return { action: "send", attemptNumber: previous.attemptNumber + 1 };
}

export function feedbackTelegramNextAttemptAt(attemptNumber: number, now: Date): Date | null {
  const delay = RETRY_DELAYS_MS[attemptNumber - 1];
  return delay ? new Date(now.getTime() + delay) : null;
}

export const FEEDBACK_TELEGRAM_REQUIRED_ARTIFACTS = ["docx", "xlsx"] as const;
export type FeedbackTelegramEvent = { id: number; snapshotEventId: number; recipientUserId: number | null; artifactKind: string; state: string; reasonCode?: string | null };
export type FeedbackTelegramOutcome = { recipientUserId: number | null; artifactKind: typeof FEEDBACK_TELEGRAM_REQUIRED_ARTIFACTS[number]; state: "sent" | "failed" | "skipped" | "sending" | "unknown" | "missing"; reasonCode: string | null; eventId: number | null };

export function aggregateFeedbackTelegramDelivery(snapshotEventId: number | null, requiredRecipientIds: number[], events: FeedbackTelegramEvent[]) {
  if (!snapshotEventId) return { snapshotEventId: null, overallState: "not-requested" as const, outcomes: [] as FeedbackTelegramOutcome[] };
  const recipients = [...new Set(requiredRecipientIds.filter(id => Number.isSafeInteger(id) && id > 0))].sort((a,b)=>a-b);
  const expectedRecipients: Array<number | null> = recipients.length ? recipients : [null];
  const latest = new Map<string,FeedbackTelegramEvent>();
  for(const event of events) {
    if(event.snapshotEventId!==snapshotEventId || !FEEDBACK_TELEGRAM_REQUIRED_ARTIFACTS.some(kind=>kind===event.artifactKind)) continue;
    if(recipients.length ? !recipients.includes(Number(event.recipientUserId)) : event.recipientUserId!==null) continue;
    const key=`${event.recipientUserId ?? "none"}:${event.artifactKind}`,prior=latest.get(key);if(!prior||event.id>prior.id)latest.set(key,event);
  }
  const outcomes: FeedbackTelegramOutcome[]=[];
  for(const recipientUserId of expectedRecipients) for(const artifactKind of FEEDBACK_TELEGRAM_REQUIRED_ARTIFACTS) {
    const event=latest.get(`${recipientUserId ?? "none"}:${artifactKind}`),state=event&&["sent","failed","skipped","sending","unknown"].includes(event.state)?event.state as FeedbackTelegramOutcome["state"]:"missing";
    outcomes.push({recipientUserId,artifactKind,state,reasonCode:typeof event?.reasonCode==="string"?event.reasonCode:null,eventId:event?.id??null});
  }
  const states=outcomes.map(item=>item.state);
  const overallState = states.every(state=>state==="sent") ? "sent" : states.some(state=>state==="unknown") ? "manual-review" : states.some(state=>state==="failed") ? "failed" : states.every(state=>state==="skipped") ? "skipped" : states.some(state=>state==="sent"||state==="skipped") ? "partial" : states.some(state=>state==="sending") ? "pending" : "not-requested";
  return { snapshotEventId, overallState, outcomes };
}
