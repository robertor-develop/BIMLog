import assert from "node:assert/strict";
import fs from "node:fs";
const read = (relative: string) => fs.readFileSync(new URL(relative, import.meta.url), "utf8");
const telegram = read("./feedback-telegram-worker.ts");
const policy = read("./feedback-telegram-policy.ts");
const route = read("../routes/feedback.ts");
const notifications = read("./feedback-notification-worker.ts");

for (const token of [
  "eligibleFeedbackTelegramRecipientIds", "is_super_admin=true", "notification_channels", "consent_records",
  "module_key='feedback'", "providerAcknowledgementId", "manualReview", "snapshotEventId", "recipientUserId",
  "artifactKind", "pg_advisory_xact_lock", "attemptId",
]) assert.ok(telegram.includes(token), `protected Telegram contract missing: ${token}`);
assert.match(telegram, /feedback-telegram:\$\{candidate\.snapshot_event_id\}:\$\{candidate\.recipient_user_id\}:\$\{artifactKind\}/);
assert.match(policy, /sent[\s\S]*failed[\s\S]*unknown[\s\S]*missing/s);
assert.match(route, /feedbackEmailCopyEnabled[\s\S]*email_copy[\s\S]*approved-sendgrid/s);
assert.match(route, /submission_notification_delivery_failed[\s\S]*retry-required/s);
assert.match(notifications, /submission_notification_outbox_settled/);
assert.doesNotMatch(`${telegram}\n${route}`, /sendMessage\([^)]*roberto|chat_id\s*:\s*["']?\d+/i);
console.log("PASS Build 079 protected email/Telegram delivery, idempotency, and safe-failure contracts; no send executed");
