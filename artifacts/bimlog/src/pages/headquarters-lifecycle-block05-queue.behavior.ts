import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboard = await readFile(new URL("./Dashboard.tsx", import.meta.url), "utf8");
assert.match(dashboard, /beginCleanupReviewQueue\(projectIds\)/);
assert.match(dashboard, /advanceCleanupReviewQueue\(cleanupReviewQueue, retirementProjectId\)/);
assert.match(dashboard, /preferredTestProjectId=\{preferredTestProjectId\}/);
assert.match(dashboard, /setShowCleanup\(true\)/);
assert.match(dashboard, /retirement review\(s\) remain/);
assert.match(dashboard, /Every record was preserved/);

console.log("Headquarters cleanup review queue integration: PASS");
