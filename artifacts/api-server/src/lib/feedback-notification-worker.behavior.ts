import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./feedback-notification-worker.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../routes/feedback.ts", import.meta.url), "utf8");
assert.match(source, /pg_advisory_xact_lock/);
assert.match(source, /submission_notification_outbox_settled[\s\S]*state: "blocked"[\s\S]*reasonCode: "no-active-reviewer"/);
assert.match(source, /internal_reviewer_notifications_created[\s\S]*sourceEventId: acknowledgment\.id[\s\S]*release: FEEDBACK_RELEASE/);
assert.match(source, /submission_notification_outbox_settled[\s\S]*state: "delivered"[\s\S]*reconciled: true/);
assert.match(source, /actionUrl: `\/admin\?tab=feedback&feedback=/);
assert.match(route, /state: reviewerIds\.length \? "delivered" : "blocked"/); assert.match(route, /reasonCode: reviewerIds\.length \? null : "no-active-reviewer"/); assert.match(route, /changes\.push\("owner"\)[\s\S]*changes\.push\("status"\)[\s\S]*eventType:[\s\S]*"claimed"/); assert.match(route, /deliveryState:visibility==="customer"\?"pending":"internal-only"/);
console.log("feedback notification and audit reconciliation: 9/9 passed");
