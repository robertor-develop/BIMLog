import assert from "node:assert/strict";
import { summarizeLensNextIssues } from "./lens-next-issue-summary";
import type { LensNextIssue } from "./lens-next-types";

const issue = (serverId: number, status: LensNextIssue["status"], screenshotUrl: string | null, visualStateAvailable: boolean) => ({
  identity: { serverId }, status, screenshotUrl, visualStateAvailable,
}) as LensNextIssue;
const loaded = [issue(1, "open", "/capture/1", true), issue(2, "follow_up", null, true), issue(3, "resolved", null, false)];
const summary = summarizeLensNextIssues(loaded);
assert.equal(summary.total, 3);
assert.deepEqual(summary.byStatus, { open: 1, follow_up: 1, waiting_design: 0, approved: 0, resolved: 1 });
assert.equal(summary.withImageReference, 1);
assert.equal(summary.withVisualPackage, 2);
const filtered = summarizeLensNextIssues(loaded.filter(item => item.status === "open"));
assert.equal(filtered.total, 1);
assert.equal(filtered.withImageReference, 1);
assert.deepEqual(summarizeLensNextIssues([]).byStatus, { open: 0, follow_up: 0, waiting_design: 0, approved: 0, resolved: 0 });
console.log("Lens Next issue record summary: PASS");
