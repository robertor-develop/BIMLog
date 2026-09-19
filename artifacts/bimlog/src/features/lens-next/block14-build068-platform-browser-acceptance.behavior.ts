import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { lensNextCaptureKey, lensNextImageStatus } from "./lens-next-image-state";

const root = fileURLToPath(new URL("../../../../..", import.meta.url));
const view = readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("./LensNextPanel.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./lens-next-panel.css", import.meta.url), "utf8");
const contract = JSON.parse(readFileSync(`${root}/contracts/lens-next-platform-capabilities.json`, "utf8"));

assert.equal(contract.product, "Lens Next");
assert.equal(contract.threeDimensionalState.productionInteractive3dAvailable, false);
assert.deepEqual(contract.evidence.sameProjectLinks, ["rfi", "submittal"]);
for (const label of ["Overview", "BIMLog issue", "Properties", "Activity", "Link RFI", "Link Submittal", "Reference attachments"]) {
  assert.ok(view.includes(label), `missing Lens Next detail capability: ${label}`);
}
for (const token of ["issueGroups", "filteredIssues", "filterCompanies", "filterReportTypes", "capturedFrom", "capturedTo", "screenshot"]) {
  assert.ok(view.includes(token) || panel.includes(token), `missing browser/filter contract: ${token}`);
}
assert.match(view, /This image is a capture, not interactive 3D/);
assert.doesNotMatch(view, /<LensNextAreaPreview/);
assert.match(view, /aria-label="BIMLog issues"/);
assert.match(view, /aria-label="Issue detail views"/);
assert.match(view, /aria-label="Add Reference Attachment"/);
assert.match(css, /@media \(max-width: 760px\)/);
assert.match(css, /:focus-visible/);
assert.match(css, /prefers-reduced-motion/);

const issue = { identity: { projectId: 29, serverId: 7 }, mutationVersion: 4, screenshotUrl: "/capture/7.png" } as any;
const key = lensNextCaptureKey(issue);
assert.equal(lensNextImageStatus(null, key, issue.screenshotUrl), "loading");
assert.equal(lensNextImageStatus({ key, status: "loaded" }, key, issue.screenshotUrl), "loaded");
assert.equal(lensNextImageStatus({ key, status: "error" }, key, issue.screenshotUrl), "error");
assert.equal(lensNextImageStatus(null, lensNextCaptureKey({ ...issue, screenshotUrl: null }), null), "missing");

console.log("block 14 build 068 Lens Next Platform browser acceptance: PASS");
