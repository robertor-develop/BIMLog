import assert from "node:assert/strict";
import { lensNextCaptureKey, lensNextImageStatus } from "./lens-next-image-state";
import type { LensNextIssue } from "./lens-next-types";

const issue = {
  identity: { projectId: 26, serverId: 41 }, mutationVersion: 2, screenshotUrl: "/capture/41.png",
} as LensNextIssue;
const key = lensNextCaptureKey(issue);
assert.equal(lensNextImageStatus(null, key, issue.screenshotUrl), "loading");
assert.equal(lensNextImageStatus({ key, status: "loaded" }, key, issue.screenshotUrl), "loaded");
assert.equal(lensNextImageStatus({ key, status: "error" }, key, issue.screenshotUrl), "error");
assert.equal(lensNextImageStatus({ key, status: "loaded" }, key, null), "missing");
const changedIssue = { ...issue, mutationVersion: 3 };
const changedKey = lensNextCaptureKey(changedIssue);
assert.notEqual(changedKey, key);
assert.equal(lensNextImageStatus({ key, status: "loaded" }, changedKey, changedIssue.screenshotUrl), "loading");
assert.equal(lensNextImageStatus({ key, status: "error" }, lensNextCaptureKey(issue, 1), issue.screenshotUrl), "loading");
console.log("Lens Next capture image lifecycle: PASS");
