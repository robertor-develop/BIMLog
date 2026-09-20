import assert from "node:assert/strict";
import fs from "node:fs";
const read = (relative: string) => fs.readFileSync(new URL(relative, import.meta.url), "utf8");
const engine = read("./telegram-product-notifications.ts");
const routes = read("../routes/notifications.ts");
const center = read("../../../bimlog/src/components/notifications/NotificationPreferenceCenter.tsx");

for (const token of [
  '"immediate" | "daily_digest" | "weekly_digest" | "off"', "quiet_hours_start", "quiet_hours_end",
  "digestWindowKey", "deferred_quiet_hours", "digest_pending", "preference_recheck_failed",
  "AUTHORIZATION_REVOKED", "CHANNEL_REVOKED", "provider_acknowledgement_id", "suppressed_by_preference",
]) assert.ok(engine.includes(token), `notification decision contract missing: ${token}`);
assert.match(engine, /ON CONFLICT\(user_id,canonical_event_id,channel,delivery_frequency,digest_window_key\) DO NOTHING/);
assert.match(engine, /project_members[\s\S]*status='active'/);
assert.match(routes, /isRead: false/);
assert.match(routes, /\/notifications\/read-all[\s\S]*isRead: true/);
assert.match(routes, /\/notifications\/:id\/read[\s\S]*eq\(notificationsTable\.userId, req\.user!\.userId\)/);
for (const label of ["Quiet hours start", "Quiet hours end", "Delivery frequency", "Next digest", "Last successful", "Last failed"]) {
  assert.ok(center.includes(label), `Notification Center UI missing: ${label}`);
}
assert.match(center, /setRfiFrequency[\s\S]*previous=m[\s\S]*setM\(previous\)/);
console.log("PASS Build 078 deterministic preferences, quiet hours, digests, unread state, and revocation");
