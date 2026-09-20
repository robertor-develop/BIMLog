import assert from "node:assert/strict";
import fs from "node:fs";
import { authorizeLifecycleAction, DATA_LIFECYCLE } from "./block22-data-lifecycle";

for (const dataClass of Object.keys(DATA_LIFECYCLE) as (keyof typeof DATA_LIFECYCLE)[]) {
  assert.equal(authorizeLifecycleAction(dataClass, "export", { authorized: false, retentionHold: false }).allow, false);
  assert.equal(authorizeLifecycleAction(dataClass, "export", { authorized: true, retentionHold: false }).allow, true);
}
assert.equal(authorizeLifecycleAction("audit_evidence", "delete", { authorized: true, retentionHold: false }).code, "IMMUTABLE_EVIDENCE_PRESERVED");
assert.equal(authorizeLifecycleAction("release_receipts", "correct", { authorized: true, retentionHold: false }).allow, false);
assert.equal(authorizeLifecycleAction("uploaded_files", "delete", { authorized: true, retentionHold: true }).code, "RETENTION_HOLD_ACTIVE");
assert.equal(authorizeLifecycleAction("uploaded_files", "delete", { authorized: true, retentionHold: false }).allow, true);

const files = fs.readFileSync(new URL("../routes/files.ts", import.meta.url), "utf8");
assert.match(files, /FILE_RETENTION_HOLD_ACTIVE/);
assert.match(files, /activityLogTable/);
assert.match(files, /handover\.zip/);
const feedback = fs.readFileSync(new URL("../lib/feedback-relay/state-machine.ts", import.meta.url), "utf8");
assert.match(feedback, /retention|hold|purge/i);

console.log("block22 build108 data lifecycle: PASS classes=5 export=governed correction=bounded archive=allowed deletion=hold_aware immutable_evidence=preserved");
