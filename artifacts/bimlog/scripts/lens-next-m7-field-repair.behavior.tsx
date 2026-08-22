import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  LensNextPanelView,
  type LensNextPanelViewProps,
} from "../src/features/lens-next/LensNextPanelView.tsx";
import {
  LENS_NEXT_DEFAULT_FILTERS,
  type LensNextIssue,
} from "../src/features/lens-next/lens-next-types.ts";

const noop = () => undefined;
const issue: LensNextIssue = {
  identity: {
    projectId: 26,
    serverId: 223,
    viewpointId: "vp-0223",
    lifecycleStatus: "active",
    revisionNumber: 3,
  },
  displayId: "LN-0223",
  navisworksGuid: "00000000-0000-4000-8000-000000000223",
  bimlogPhysicalId: "phys-223",
  issueGroupId: "group-74",
  note: "Pump room access conflict",
  openItems: "Resolve access clearance",
  trade: "Plumbing",
  floor: "Roof",
  responsibleCompany: "Test Company",
  reportType: "Coordination",
  priority: 3,
  status: "waiting_design",
  capturedAt: "2026-08-12T00:03:42.000Z",
  syncedAt: "2026-08-12T01:03:42.000Z",
  supersedesId: null,
  supersedesCode: null,
  screenshotUrl: null,
};

const baseProps: LensNextPanelViewProps = {
  authorizedProjects: [{ id: 26, name: "Elara East", code: "ELA01" }],
  selectedProjectId: 26,
  onProjectChange: noop,
  projectLocked: true,
  bridgeDisplayName: "1185 RIVER AV MODEL-06-11-26.nwd",
  bridgeModelFingerprint: "a19b77900000000000000000000000000000000000000000000000000ec2324",
  filteredIssues: [issue],
  issueGroups: [],
  viewPreset: "status_only",
  customGroupBy: [],
  onViewPresetChange: noop,
  onCustomGroupByChange: noop,
  selectedServerId: null,
  selectedIssue: null,
  filters: { ...LENS_NEXT_DEFAULT_FILTERS },
  onFiltersChange: noop,
  trades: ["Plumbing"],
  floors: ["Roof"],
  apiState: "connected",
  bridgeState: "connected",
  refreshState: "fresh",
  apiError: null,
  bridgeError: null,
  history: null,
  historyError: null,
  lastRefreshedAt: "2026-08-22T12:00:00.000Z",
  bridgeOpenEnabled: true,
  onRefresh: noop,
  onSelectIssue: noop,
  onCloseIssue: noop,
  onOpenWorkingView: noop,
  onLoadHistory: noop,
};

const empty = renderToStaticMarkup(<LensNextPanelView {...baseProps} />);
assert.match(empty, /class="lens-next__body"/);
assert.match(empty, /class="lens-next__browser"/);
assert.match(empty, /Select an issue/);
assert.match(empty, /temporary Working View/);

const selected = renderToStaticMarkup(
  <LensNextPanelView {...baseProps} selectedServerId={223} selectedIssue={issue} />,
);
assert.match(selected, /aria-label="Selected issue details"/);
assert.match(selected, /LN-0223/);
assert.match(selected, />Open working view<\/button>/);

const css = readFileSync(
  new URL("../src/features/lens-next/lens-next-panel.css", import.meta.url),
  "utf8",
);
assert.match(css, /\.lens-next-workspace--embedded/);
assert.match(css, /height:\s*100dvh/);
assert.match(css, /grid-template-columns:\s*minmax\(280px, 0\.9fr\) minmax\(320px, 1\.1fr\)/);
assert.match(css, /\.lens-next__browser \.lens-next__issue-list[\s\S]*overflow-y:\s*auto/);
assert.match(css, /\.lens-next__body > \.lens-next__details[\s\S]*overflow-y:\s*auto/);
assert.match(css, /@media \(max-width: 560px\)/);

const workspace = readFileSync(
  new URL("../src/features/lens-next/LensNextWorkspace.tsx", import.meta.url),
  "utf8",
);
assert.match(workspace, /launchMode === "navisworks"/);
assert.match(workspace, /lens-next-workspace--embedded/);
assert.match(workspace, /data-lens-next-embedded/);

const panel = readFileSync(
  new URL("../src/features/lens-next/LensNextPanel.tsx", import.meta.url),
  "utf8",
);
assert.match(panel, /bridgeClient\.openWorkingView\(selectedIssue, bridgeContext\)/);
assert.match(panel, /onOpenWorkingView=\{\(\) => void openWorkingView\(\)\}/);

console.log("Lens Next M7 field repair behavior: 18/18 passed");
