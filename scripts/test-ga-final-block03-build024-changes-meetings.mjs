import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
const read = file => readFileSync(file, "utf8");
const tsx = path.resolve("artifacts/api-server/node_modules/tsx/dist/cli.mjs");
for (const file of [
  "artifacts/api-server/src/lib/commercial-change-order-draft.behavior.ts",
  "artifacts/api-server/src/lib/commercial-change-approval.behavior.ts",
  "artifacts/api-server/src/lib/post120-build166-meeting-contracts.behavior.ts",
  "artifacts/api-server/src/lib/post120-build167-meeting-identities.behavior.ts",
  "artifacts/api-server/src/lib/post120-build168-meeting-view-scope.behavior.ts",
  "artifacts/api-server/src/lib/post120-build169-meeting-concurrency.behavior.ts",
]) execFileSync(process.execPath, [tsx, path.resolve(file)], { stdio: "inherit" });
const changes = read("artifacts/api-server/src/routes/change_orders.ts");
for (const token of ["contractValueImpact", "scheduleImpactDays", "linkedRfiIds", "linkedSubmittalIds", 'actionType: action', 'entityType: "change_order"']) assert.ok(changes.includes(token), `Change lifecycle is missing ${token}`);
assert.match(changes, /for \(const action of \["submit", "approve", "reject"\]/);
assert.match(changes, /current-view\/pdf/);
const meetings = read("artifacts/api-server/src/routes/meeting_minutes.ts");
// Meeting decisions are preserved in the governed minutes notes while owned
// follow-up work is represented by actionItemsTable; do not invent a second
// decision store that could diverge from the signed minutes artifact.
for (const token of ["meetingAttendeesTable", "actionItemsTable", "meetingRfiLinksTable", "meetingSubmittalLinksTable", "meetingLensViewpointLinksTable", "meetingScheduleBucketLinksTable", "meetingScheduleTaskLinksTable", "agenda", "notes"]) assert.ok(meetings.includes(token), `Meeting lifecycle is missing ${token}`);
assert.match(meetings, /schedule-bucket\/preview/);
assert.match(meetings, /pg_advisory_xact_lock/);
console.log("GA-F03-B024 changes and meetings relationship lifecycle: PASS");
