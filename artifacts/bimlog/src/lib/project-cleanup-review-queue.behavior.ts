import assert from "node:assert/strict";
import { advanceCleanupReviewQueue, beginCleanupReviewQueue, cancelCleanupReviewQueue } from "./project-cleanup-review-queue";

const queue = beginCleanupReviewQueue([8, 8, -1, 0, 9, 10]);
assert.deepEqual(queue, { projectIds: [8, 9, 10], currentProjectId: 8, completedCount: 0 });
assert.equal(advanceCleanupReviewQueue(queue, 9), queue);
const second = advanceCleanupReviewQueue(queue, 8);
assert.deepEqual(second, { projectIds: [9, 10], currentProjectId: 9, completedCount: 1 });
assert.deepEqual(advanceCleanupReviewQueue(advanceCleanupReviewQueue(second, 9), 10), { projectIds: [], currentProjectId: null, completedCount: 3 });
assert.deepEqual(cancelCleanupReviewQueue(), { projectIds: [], currentProjectId: null, completedCount: 0 });

console.log("Headquarters guided retirement review queue: PASS");
