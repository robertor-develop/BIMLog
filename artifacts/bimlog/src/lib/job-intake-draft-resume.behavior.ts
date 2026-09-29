import assert from "node:assert/strict";
import { preserveJobIntakeActiveItem, readJobIntakeActiveItem, resolveJobIntakeRecovery } from "./job-intake-workspace-state";

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

const stored = new Map<string, string>();
(globalThis as any).window = {
  location: { search: "" },
  localStorage: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  },
};
preserveJobIntakeActiveItem(41, "ji-contract");
assert.equal(readJobIntakeActiveItem(41), "ji-contract");
(globalThis as any).window.location.search = "?stage=delivery&item=ji-delivery";
assert.equal(readJobIntakeActiveItem(41), "ji-delivery");
console.log("job intake draft resume behavior: PASS");
