import assert from "node:assert/strict";
import fs from "node:fs";

const read = (relative: string) => fs.readFileSync(new URL(relative, import.meta.url), "utf8");
const route = read("../routes/feedback.ts");
const notifications = read("../routes/notifications.ts");
const backup = read("./feedback-backup-worker.ts");
const delivery = read("./feedback-telegram-worker.ts");
const app = read("../../../bimlog/src/App.tsx");
const composer = read("../../../bimlog/src/components/FeedbackWidget.tsx");
const reviewer = read("../../../bimlog/src/pages/AdminPanel.tsx");
const preferences = read("../../../bimlog/src/components/notifications/NotificationPreferenceCenter.tsx");

for (const token of [
  'router.post("/feedback"',
  'router.get("/feedback/mine"',
  'router.get("/feedback/:id/history"',
  'router.patch("/feedback/admin/:id"',
  'router.post("/feedback/:id/reopen"',
  "submission_acknowledged",
  "submission_notification_outbox_created",
  "submission_notification_outbox_settled",
  "FEEDBACK_STALE",
]) assert.ok(route.includes(token), `feedback-to-resolution contract missing: ${token}`);

for (const token of [
  'path="/feedback"',
  'path="/admin/feedback"',
  'path="/settings/notifications"',
]) assert.ok(app.includes(token), `published application route missing: ${token}`);

assert.match(composer, /\/feedback\/mine/);
assert.match(reviewer, /\/feedback\/admin/);
assert.match(route, /\/admin\/feedback\?feedback=/);
assert.match(notifications, /\/notifications\/read-all[\s\S]*isRead: true/);
assert.match(notifications, /\/notifications\/:id\/read[\s\S]*eq\(notificationsTable\.userId, req\.user!\.userId\)/);
for (const label of ["Quiet hours start", "Delivery frequency", "Next digest"]) {
  assert.ok(preferences.includes(label), `notification preference UI missing: ${label}`);
}

for (const token of [
  "restoreVerified(receipt)",
  "FEEDBACK_BACKUP_RESTORE_MISMATCH",
  "manual-review",
]) assert.ok(backup.includes(token), `recovery contract missing: ${token}`);

for (const token of [
  "eligibleFeedbackTelegramRecipientIds",
  "providerAcknowledgementId",
  "manualReview",
  "snapshotEventId",
  "recipientUserId",
]) assert.ok(delivery.includes(token), `governed delivery contract missing: ${token}`);

assert.doesNotMatch(`${delivery}\n${route}`, /chat_id\s*:\s*["']?\d+|sendMessage\([^)]*roberto/i);
console.log("PASS Build 080 production-safe feedback-to-resolution and notifications acceptance; no external delivery executed");
