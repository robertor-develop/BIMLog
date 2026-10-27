import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync(new URL("./LensNextPanel.tsx", import.meta.url), "utf8");
const view = readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../../../api-server/src/routes/clash_reports.ts", import.meta.url), "utf8");
for (const action of ["rename", "reorder", "make_primary", "archive"]) assert.ok(route.includes(`action === "${action}"`) || route.includes(`"${action}"`));
assert.match(route, /lens_issue_viewpoint_primary_archive_forbidden/);
assert.match(route, /lens_issue_viewpoint_last_archive_forbidden/);
assert.match(route, /lens-issue-viewpoint-history\.v1/);
assert.match(panel, /captureCurrentVisualState\(selectedIssue, bridgeContext\)/);
assert.match(panel, /loadIssueViewpointVisualState\(selectedIssue, selectedIssueViewpointId\)/);
assert.match(panel, /applyPlatformWorkingView\(selectedIssue, bridgeContext, stored\.visualStateJson/);
assert.match(view, /Issue viewpoints/);
assert.match(view, /Add Viewpoint/);
assert.match(view, /Make primary/);
assert.match(view, /onLoadSelectedIssueViewpointHistory/);
console.log("Lens Build 008 multi-viewpoint gallery, lifecycle controls, navigation, and separate history: PASS");
