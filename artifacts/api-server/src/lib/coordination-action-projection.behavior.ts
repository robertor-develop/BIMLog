import assert from "node:assert/strict";
import { projectDesignCommentAction } from "./coordination-action-projection";

const base = { commentId: "comment-1", commentRevision: 1, projectId: 7, companyId: 3, tradeId: 9, title: "Resolve clearance", text: "Coordinate the mechanical clearance.", disposition: "open", owner: { kind: "user", id: "11", displayName: "Owner", email: null }, assignee: { kind: "contact", id: "30", displayName: "Trade contact", email: "trade@example.com" }, dueAt: "2026-09-12T17:00:00Z", sourceSnapshotDigest: "a".repeat(64), createdAt: "2026-09-09T14:00:00Z", updatedAt: "2026-09-09T14:00:00Z" } as const;
const action = projectDesignCommentAction(base);
assert.equal(action.actionId, "coordination:module_action:comment-1");
assert.equal(action.status, "open");
assert.equal(action.companyId, 3);
assert.equal(projectDesignCommentAction({ ...base, disposition: "resolved" }).status, "completed");
assert.equal(projectDesignCommentAction({ ...base, disposition: "rejected" }).status, "cancelled");
console.log("coordination action projection behavior: PASS");
