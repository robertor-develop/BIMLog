import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  LensNextPanelView,
  type LensNextPanelViewProps,
} from "../../src/features/lens-next/LensNextPanelView.tsx";
import {
  LENS_NEXT_DEFAULT_FILTERS,
  type LensNextHistory,
  type LensNextIssue,
} from "../../src/features/lens-next/lens-next-types.ts";

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
  supersedesId: 200,
  supersedesCode: "LN-0200",
  screenshotUrl: null,
};
const history: LensNextHistory = {
  revisions: [
    {
      serverId: 223,
      revisionNumber: 3,
      note: "Pump room access conflict",
      trade: "Plumbing",
      floor: "Roof",
      lifecycleStatus: "active",
      supersedesId: 200,
      updatedAt: "2026-08-12T01:03:42.000Z",
      createdAt: "2026-08-12T00:03:42.000Z",
    },
  ],
  events: [
    {
      id: 700,
      actionType: "edited",
      entityId: 223,
      before: null,
      after: null,
      details: "Read-only history event",
      userFullName: "Test User",
      userCompanyName: "Test Company",
      createdAt: "2026-08-12T01:03:42.000Z",
    },
  ],
};

const noOp = () => undefined;
const baseProps: LensNextPanelViewProps = {
  authorizedProjects: [{ id: 26, name: "Elara East", code: "ELA01" }],
  selectedProjectId: 26,
  onProjectChange: noOp,
  filteredIssues: [],
  selectedServerId: null,
  selectedIssue: null,
  filters: { ...LENS_NEXT_DEFAULT_FILTERS },
  onFiltersChange: noOp,
  trades: ["Plumbing"],
  floors: ["Roof"],
  apiState: "connecting",
  bridgeState: "disconnected",
  refreshState: "refreshing",
  apiError: null,
  bridgeError: "Lens Next bridge session unavailable.",
  history: null,
  historyError: null,
  lastRefreshedAt: null,
  bridgeOpenEnabled: false,
  onRefresh: noOp,
  onSelectIssue: noOp,
  onCloseIssue: noOp,
  onOpenWorkingView: noOp,
  onLoadHistory: noOp,
};

function render(props: Partial<LensNextPanelViewProps> = {}): string {
  return renderToStaticMarkup(<LensNextPanelView {...baseProps} {...props} />);
}

const loading = render();
assert.match(
  loading,
  /<aside[^>]+aria-label="BIMLog Lens Next read-only panel"/,
);
assert.match(loading, /aria-live="polite" aria-label="Connection status"/);
assert.match(loading, /aria-busy="true"/);
assert.match(loading, /Loading live BIMLog issues/);
assert.match(
  loading,
  /<button[^>]+type="button"[^>]+disabled=""[^>]*>Refreshing/,
);
assert.match(loading, /Lens Next bridge session unavailable/);

const empty = render({
  apiState: "connected",
  refreshState: "fresh",
  bridgeError: null,
});
assert.match(empty, /No issues match these filters/);
assert.match(empty, /<select/);
assert.match(empty, /<input[^>]+type="search"/);

const error = render({
  apiState: "error",
  refreshState: "error",
  apiError: "Authenticated Lens read failed",
  bridgeState: "error",
  bridgeError: "Bridge failed closed",
});
assert.match(error, /role="status" aria-live="polite"/);
assert.match(error, /Authenticated Lens read failed/);
assert.match(error, /Bridge failed closed/);

const populated = render({
  filteredIssues: [issue],
  apiState: "connected",
  bridgeState: "connected",
  refreshState: "fresh",
  bridgeError: null,
  lastRefreshedAt: "2026-08-12T01:03:42.000Z",
});
assert.match(populated, /1 issues/);
assert.match(populated, /aria-label="View issue LN-0223"/);
assert.match(populated, /aria-pressed="false"/);
assert.match(populated, /aria-label="No thumbnail available"/);
assert.match(populated, /lucide-image-off/);
assert.doesNotMatch(populated, /▧|×/);

const selectedDisabled = render({
  filteredIssues: [issue],
  selectedServerId: 223,
  selectedIssue: issue,
  apiState: "connected",
  bridgeState: "disconnected",
  refreshState: "fresh",
  bridgeError: "Lens Next bridge session unavailable.",
  history,
  bridgeOpenEnabled: false,
});
assert.match(selectedDisabled, /aria-label="Selected issue details"/);
assert.match(selectedDisabled, /Exact BIMLog identity/);
assert.match(selectedDisabled, /Server ID/);
assert.match(selectedDisabled, /Read-only revision history/);
assert.match(selectedDisabled, /Read-only history event/);
assert.match(selectedDisabled, /aria-label="Close issue details"/);
assert.match(selectedDisabled, /lucide-x/);
assert.match(
  selectedDisabled,
  /<button[^>]+disabled=""[^>]*>Open working view/,
);

const selectedOpen = render({
  filteredIssues: [issue],
  selectedServerId: 223,
  selectedIssue: issue,
  apiState: "connected",
  bridgeState: "connected",
  refreshState: "fresh",
  bridgeError: null,
  history,
  bridgeOpenEnabled: true,
});
const openButton =
  selectedOpen.match(/<button[^>]*>Open working view<\/button>/)?.[0] ?? "";
assert.ok(openButton, "open-working-view button must render");
assert.doesNotMatch(openButton, /disabled/);

const css = readFileSync(
  new URL("../../src/features/lens-next/lens-next-panel.css", import.meta.url),
  "utf8",
);
assert.match(css, /@media \(max-width: 380px\)/);
assert.match(css, /@media \(min-width: 720px\)/);
assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
assert.match(css, /min-width: 280px/);

const routeSource = readFileSync(
  new URL("../../src/App.tsx", import.meta.url),
  "utf8",
);
assert.equal((routeSource.match(/path="\/lens-next"/g) ?? []).length, 1);
assert.equal(
  (routeSource.match(/import \{ LensNextWorkspace \}/g) ?? []).length,
  1,
);
assert.match(routeSource, /<ProtectedRoute component=\{LensNextWorkspace\}/);
assert.ok(
  routeSource.indexOf('path="/lens-next"') <
    routeSource.indexOf('path="/projects/:id/:tab?"'),
);

const workspaceSource = readFileSync(
  new URL(
    "../../src/features/lens-next/LensNextWorkspace.tsx",
    import.meta.url,
  ),
  "utf8",
);
assert.match(workspaceSource, /useAuthStore/);
assert.match(workspaceSource, /useListProjects/);
assert.match(workspaceSource, /useSyncExternalStore/);
assert.doesNotMatch(
  workspaceSource,
  /localStorage|sessionStorage|URLSearchParams|console\./,
);

const sessionSource = readFileSync(
  new URL("../../src/features/lens-next/lens-next-session.ts", import.meta.url),
  "utf8",
);
assert.doesNotMatch(
  sessionSource,
  /localStorage|sessionStorage|URLSearchParams|console\./,
);
assert.match(sessionSource, /MAX_SESSION_TTL_MS/);
assert.match(sessionSource, /currentSession/);

console.log(
  JSON.stringify({
    status: "PASS",
    reactRenders: 6,
    states: [
      "loading",
      "empty",
      "error",
      "populated-filtered",
      "details-history-disabled",
      "details-history-open",
    ],
    accessibleLandmark: true,
    liveRegions: true,
    nativeButtonsAndSelects: true,
    lucideIcons: ["ImageOff", "X"],
    responsiveBreakpoints: [380, 720],
    protectedRouteCount: 1,
    sourceBoundWorkspace: true,
    persistentTokenStores: 0,
  }),
);
