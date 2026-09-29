import assert from "node:assert/strict";
import { resolveJobIntakeRecovery } from "./job-intake-workspace-state";

const server = { identity: { jobName: "Server" } };
const draft = { identity: { jobName: "Browser draft" } };
assert.deepEqual(resolveJobIntakeRecovery(7, server, { revision: 7, data: draft }), {
  resume: true, data: draft, discardStale: false, retainNewer: false, reason: "same_revision_draft",
});
const stale = resolveJobIntakeRecovery(8, server, { revision: 7, data: draft });
assert.equal(stale.resume, false);
assert.equal(stale.discardStale, true);
assert.deepEqual(stale.data, server);
const newer = resolveJobIntakeRecovery(7, server, { revision: 8, data: draft });
assert.equal(newer.resume, false);
assert.equal(newer.retainNewer, true);
assert.deepEqual(newer.data, server);
console.log("job intake draft resume behavior: PASS");
