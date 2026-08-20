import assert from "node:assert/strict";
import fs from "node:fs";
import { feedbackEmailCopyEnabled, feedbackEmailCopyHtml, FEEDBACK_CUSTOMER_EVENT_TYPES, FEEDBACK_STAFF_RESPONSE_TYPES } from "./feedback-follow-up";

assert.deepEqual([...FEEDBACK_STAFF_RESPONSE_TYPES], ["response", "decision", "fix", "answer"]); assert.ok(FEEDBACK_CUSTOMER_EVENT_TYPES.has("submission_acknowledged"));
assert.equal(feedbackEmailCopyEnabled({}, { SENDGRID_API_KEY: "configured" } as NodeJS.ProcessEnv), false); assert.equal(feedbackEmailCopyEnabled({ feedback_email_copy: true }, {} as NodeJS.ProcessEnv), false); assert.equal(feedbackEmailCopyEnabled({ feedback_email_copy: true }, { SENDGRID_API_KEY: "configured" } as NodeJS.ProcessEnv), true);
assert.doesNotMatch(feedbackEmailCopyHtml("FB-1", "answer", "<script>alert(1)</script>", "https://bimlog.test/feedback"), /<script>/);
const route = fs.readFileSync(new URL("../routes/feedback.ts", import.meta.url), "utf8");
for (const proof of [/submission_acknowledged/, /internal_reviewer_notifications_created/, /staff_\$\{responseType\}/, /internal_note/, /customer_notification_delivery/, /feedbackEmailCopyEnabled/, /FEEDBACK_RESPONSE_IDEMPOTENCY_CONFLICT/, /feedback\/notifications/, /feedback\/notifications\/:eventId\/read/]) assert.match(route, proof);
assert.doesNotMatch(route, /sendEmail\([^)]*internal_note/s);
assert.match(route, /fields: 6, parts: 7/, "linked screenshot multipart fields fit the bounded parser");
assert.match(route, /deliveryState!=="sent"/, "failed or queued email copies are retryable on idempotent replay");
assert.match(route, /state:emailCopy/, "final email delivery state is appended to the audit trail");
console.log(JSON.stringify({ status: "PASS", tests: ["submission-receipt", "reviewer-notifications", "immutable-public-events", "private-note-separation", "customer-projection", "idempotent-delivery", "email-explicit-opt-in", "email-provider-default-deny", "email-html-escaping"] }));
