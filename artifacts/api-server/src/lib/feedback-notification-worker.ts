import { and, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { notificationsTable, usersTable } from "@workspace/db/schema";
import { feedbackAuditEventsTable, feedbackItemsTable } from "../../../../lib/db/src/schema/feedback-items";
import { FEEDBACK_RELEASE } from "./feedback-evidence-contract";

const DEFAULT_INTERVAL_MS = 60_000;
let workerTimer: NodeJS.Timeout | undefined;

export async function reconcileFeedbackNotificationsOnce(limit = 100): Promise<{ inspected: number; delivered: number; awaitingReviewer: number }> {
  const candidates = await db.select({ id: feedbackItemsTable.id }).from(feedbackItemsTable)
    .where(sql`NOT EXISTS (SELECT 1 FROM feedback_audit_events e WHERE e.feedback_id=${feedbackItemsTable.id} AND e.event_type='internal_reviewer_notifications_created')`)
    .orderBy(feedbackItemsTable.createdAt).limit(limit);
  let delivered = 0, awaitingReviewer = 0;
  for (const candidate of candidates) {
    const outcome = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`feedback-notify:${candidate.id}`},0))`);
      const [feedback] = await tx.select().from(feedbackItemsTable).where(eq(feedbackItemsTable.id, candidate.id)).limit(1); if (!feedback) return "missing" as const;
      const [settled] = await tx.select({ id: feedbackAuditEventsTable.id }).from(feedbackAuditEventsTable).where(and(eq(feedbackAuditEventsTable.feedbackId, feedback.id), eq(feedbackAuditEventsTable.eventType, "internal_reviewer_notifications_created"))).limit(1); if (settled) return "settled" as const;
      const reviewers = await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.isSuperAdmin, true));
      if (!reviewers.length) {
        const [prior] = await tx.select({ id: feedbackAuditEventsTable.id }).from(feedbackAuditEventsTable).where(and(eq(feedbackAuditEventsTable.feedbackId, feedback.id), eq(feedbackAuditEventsTable.eventType, "submission_reviewer_escalation_required"))).limit(1);
        if (!prior) await tx.insert(feedbackAuditEventsTable).values({ feedbackId: feedback.id, actorUserId: feedback.userId, eventType: "submission_reviewer_escalation_required", afterState: { state: "no-active-reviewer", release: FEEDBACK_RELEASE } });
        return "awaiting-reviewer" as const;
      }
      let [acknowledgment] = await tx.select({ id: feedbackAuditEventsTable.id }).from(feedbackAuditEventsTable).where(and(eq(feedbackAuditEventsTable.feedbackId, feedback.id), eq(feedbackAuditEventsTable.eventType, "submission_acknowledged"))).limit(1);
      if (!acknowledgment) [acknowledgment] = await tx.insert(feedbackAuditEventsTable).values({ feedbackId: feedback.id, actorUserId: feedback.userId, eventType: "submission_acknowledged", reason: "Your feedback was received and is ready for review.", afterState: { status: feedback.status, version: feedback.version, receiptId: feedback.stableId, release: FEEDBACK_RELEASE } }).returning({ id: feedbackAuditEventsTable.id });
      const [customerDelivery] = await tx.select({ id: feedbackAuditEventsTable.id }).from(feedbackAuditEventsTable).where(and(eq(feedbackAuditEventsTable.feedbackId, feedback.id), eq(feedbackAuditEventsTable.eventType, "customer_notification_delivery"), sql`${feedbackAuditEventsTable.afterState}->>'idempotencyKey'=${`ack:${feedback.id}`}`)).limit(1);
      if (!customerDelivery) { const [notification] = await tx.insert(notificationsTable).values({ userId: feedback.userId, projectId: feedback.projectId, type: "feedback_acknowledgment", title: `Feedback ${feedback.stableId} received`, message: "Your feedback was received and is ready for review.", actionUrl: "/feedback?view=mine" }).returning({ id: notificationsTable.id }); await tx.insert(feedbackAuditEventsTable).values({ feedbackId: feedback.id, actorUserId: feedback.userId, eventType: "customer_notification_delivery", afterState: { sourceEventId: acknowledgment.id, notificationId: notification.id, channel: "in_app", state: "created", idempotencyKey: `ack:${feedback.id}` } }); }
      const reviewerNotifications = await tx.insert(notificationsTable).values(reviewers.map(reviewer => ({ userId: reviewer.id, projectId: feedback.projectId, type: "feedback_review_requested", title: `New feedback ${feedback.stableId}`, message: `${feedback.feedbackType} feedback requires review.`, actionUrl: `/admin?tab=feedback&feedback=${encodeURIComponent(feedback.stableId)}` }))).returning({ id: notificationsTable.id });
      await tx.insert(feedbackAuditEventsTable).values({ feedbackId: feedback.id, actorUserId: feedback.userId, eventType: "internal_reviewer_notifications_created", afterState: { notificationIds: reviewerNotifications.map(item => item.id), reviewerCount: reviewerNotifications.length, state: "created", reconciled: true } });
      return "delivered" as const;
    });
    if (outcome === "delivered") delivered += 1; else if (outcome === "awaiting-reviewer") awaitingReviewer += 1;
  }
  return { inspected: candidates.length, delivered, awaitingReviewer };
}

export function startFeedbackNotificationWorker(intervalMs = DEFAULT_INTERVAL_MS): void {
  if (workerTimer) return;
  const run = () => { void reconcileFeedbackNotificationsOnce().catch(error => console.error("[feedback] reviewer notification reconciliation failed", error instanceof Error ? error.name : "unknown")); };
  run(); workerTimer = setInterval(run, intervalMs); workerTimer.unref?.();
}
