import assert from "node:assert/strict";
import { lensNextSelectionTarget } from "./lens-next-selection-navigation.ts";
import type { LensNextIssue } from "./lens-next-types";

const issues = Array.from({ length: 45 }, (_, index) => ({
  identity: {
    projectId: 7,
    serverId: index + 1,
    viewpointId: `VIEW-${index + 1}`,
    lifecycleStatus: "active",
    revisionNumber: 1,
  },
} as LensNextIssue));

assert.equal(lensNextSelectionTarget(issues, 1, "previous", 20), null);
assert.equal(lensNextSelectionTarget(issues, 45, "next", 20), null);
assert.equal(lensNextSelectionTarget(issues, 99, "next", 20), null);
assert.equal(lensNextSelectionTarget(issues, 1, "next", 0), null);

const nextPage = lensNextSelectionTarget(issues, 20, "next", 20);
assert.equal(nextPage?.issue.identity.serverId, 21);
assert.equal(nextPage?.page, 2);
assert.equal(nextPage?.position, 21);
assert.equal(nextPage?.total, 45);

const previousPage = lensNextSelectionTarget(issues, 41, "previous", 20);
assert.equal(previousPage?.issue.identity.serverId, 40);
assert.equal(previousPage?.page, 2);

console.log("Lens Next selection navigation: PASS");
