import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LENS_NEXT_STATUS_LABELS, lensNextIssueAccessibleLabel, lensNextIssueDescription, lensNextPriorityLabel } from "./lens-next-issue-presentation";
import type { LensNextIssue } from "./lens-next-types";

const issue = {
  identity: { projectId: 4, serverId: 91, viewpointId: "VIEW-91", lifecycleStatus: "active", revisionNumber: 2 },
  displayId: "CL-091",
  note: "Duct conflicts with beam",
  openItems: "Fallback detail",
  priority: 1,
  status: "waiting_design",
  trade: "HVAC",
  floor: "Level 02",
} as LensNextIssue;

assert.equal(lensNextPriorityLabel(1), "P1 Critical");
assert.equal(lensNextPriorityLabel(5), "P5 Monitor");
assert.equal(lensNextPriorityLabel(null), "Priority not recorded");
assert.equal(lensNextIssueDescription(issue), "Duct conflicts with beam");
assert.equal(LENS_NEXT_STATUS_LABELS.waiting_design, "Waiting Design");
assert.equal(lensNextIssueAccessibleLabel(issue), "View issue CL-091, P1 Critical, Waiting Design, HVAC, Level 02");

const view = readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");
assert.match(view, /aria-label=\{tt\("Issue presentation", "Presentación de incidencias"\)\}/);
assert.match(view, /issuePresentation === "cards"/);
assert.match(view, /<IssueTable issues=\{visibleIssues\}/);
assert.match(view, /BIMLog capture/);
assert.match(view, /No captured thumbnail/);
assert.match(view, /Thumbnail unavailable/);
assert.match(view, /className="lens-next__detail-header"/);
assert.match(view, /aria-label="Selected issue actions"/);
assert.match(view, /Properties and model evidence/);
assert.match(view, /Reference attachments/);
assert.match(view, /History and activity/);
assert.match(view, /lens-next__detail-section--publishing/);
assert.match(view, /Review publication/);
assert.match(view, /Confirm publish/);
assert.match(view, /Create issue/);
assert.match(view, /Link BIMLog item/);
assert.match(view, /Ready for confirmation/);
assert.match(view, /Synchronization operation progress/);
assert.match(view, /Review record/);
assert.doesNotMatch(view, /placeholder\.com|placehold\.co|dummyimage/i);

console.log("Lens Next issue presentation: PASS");
