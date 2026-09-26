import assert from "node:assert/strict";
import { workflowLifecycleLabel, workflowReadiness } from "./company-workflow-readiness";

const versions = [
  { versionId: "d", state: "draft" }, { versionId: "a", state: "approved" },
  { versionId: "p", state: "published" }, { versionId: "b", state: "published" },
  { versionId: "h", state: "superseded" }, { versionId: "r", state: "retired" },
  { versionId: "p", state: "published" },
];
const options = [
  { source: "company", versionId: "p", activationBlock: null },
  { source: "company", versionId: "b", activationBlock: { code: "POLICY_BLOCK" } },
  { source: "company", versionId: "h" }, { source: "company", versionId: "d" },
  { source: "bimlog", versionId: "default" }, { source: "company", versionId: "p" },
];
const original = JSON.stringify({ versions, options });
assert.deepEqual(workflowReadiness(versions, options), { drafts: 1, awaitingPublication: 1, selectable: 1, blocked: 1 });
assert.deepEqual(workflowReadiness(versions, []), { drafts: 1, awaitingPublication: 1, selectable: 0, blocked: 0 });
assert.deepEqual(workflowReadiness([], options), { drafts: 0, awaitingPublication: 0, selectable: 0, blocked: 0 });
assert.equal(JSON.stringify({ versions, options }), original);
assert.match(workflowLifecycleLabel("approved", true), /publicación pendiente/);
assert.match(workflowLifecycleLabel("published", false), /locked/);
assert.equal(workflowLifecycleLabel("future_state", true), "future_state");
console.log("C011 readiness PASS: visible company versions only, defaults excluded, blocked publication not selectable, unknown states preserved, no mutation");
