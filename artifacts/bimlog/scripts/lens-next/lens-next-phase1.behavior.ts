import assert from "node:assert/strict";
import {
  createLensNextOpenWorkingViewRequest,
  adaptLensNextPullResponse,
  assertLensNextImmutableIdentity,
  filterLensNextIssues,
  lensNextCollectionFingerprint,
  normalizeLensNextProjects,
  reconcileLensNextRefresh,
} from "../../src/features/lens-next/lens-next-model.ts";
import {
  createLensNextApiClient,
  createLensNextBridgeClient,
  LENS_NEXT_BRIDGE_ORIGIN,
} from "../../src/features/lens-next/lens-next-client.ts";
import type {
  LensNextFilters,
  LensNextImmutableIssueIdentity,
} from "../../src/features/lens-next/lens-next-types.ts";
import {
  clearLensNextBridgeSession,
  getLensNextBridgeSessionSnapshot,
  injectLensNextBridgeSession,
  LENS_NEXT_BRIDGE_SESSION_SOURCE,
} from "../../src/features/lens-next/lens-next-session.ts";

function rawViewpoint(index: number) {
  const statuses = [
    "open",
    "follow_up",
    "waiting_design",
    "approved",
    "resolved",
  ];
  const trades = ["Mechanical", "Electrical", "Plumbing", "Fire Protection"];
  const floors = ["B1", "L01", "L02", "Roof"];
  return {
    id: index + 1,
    projectId: 26,
    viewpointId: `vp-${String(index + 1).padStart(4, "0")}`,
    displayId: `LN-${String(index + 1).padStart(4, "0")}`,
    navisworksGuid: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    bimlogPhysicalId: `phys-${index + 1}`,
    issueGroupId: `group-${Math.floor(index / 3)}`,
    note:
      index === 222
        ? "Pump room access conflict"
        : `Coordination issue ${index + 1}`,
    openItems: `Resolve item ${index + 1}`,
    trade: trades[index % trades.length],
    floor: floors[Math.floor(index / trades.length) % floors.length],
    responsibleCompany: `Company ${index % 9}`,
    reportType: index % 2 === 0 ? "Coordination" : "Design",
    priority: (index % 5) + 1,
    status: statuses[index % statuses.length],
    lifecycleStatus: index % 17 === 0 ? "superseded" : "active",
    revisionNumber: (index % 4) + 1,
    capturedAt: new Date(Date.UTC(2026, 7, 12, 0, 0, index)).toISOString(),
    syncedAt: new Date(Date.UTC(2026, 7, 12, 1, 0, index)).toISOString(),
    supersedesId: index % 4 === 0 && index > 0 ? index : null,
    supersedesCode:
      index % 4 === 0 && index > 0
        ? `LN-${String(index).padStart(4, "0")}`
        : null,
    // Deliberately absent screenshotUrl: the current lens-pull response has no thumbnail field.
  };
}

const rawRows = Array.from({ length: 500 }, (_, index) => rawViewpoint(index));
const pullBody = { success: true, viewpoints: [...rawRows].reverse() };
const issues = adaptLensNextPullResponse(pullBody, 26);

assert.equal(
  issues.length,
  500,
  "hundreds-of-issues fixture must remain complete",
);
assert.ok(
  issues.every((issue) => issue.screenshotUrl === null),
  "missing thumbnails must stay honestly null",
);
assert.deepEqual(
  issues.map((issue) => issue.identity.serverId),
  adaptLensNextPullResponse({ success: true, viewpoints: rawRows }, 26).map(
    (issue) => issue.identity.serverId,
  ),
  "sort order must be deterministic regardless of server row order",
);

const filters: LensNextFilters = {
  search: "pump ROOM",
  status: "waiting_design",
  trade: "Plumbing",
  floor: "Roof",
  priority: 3,
};
const filtered = filterLensNextIssues(issues, filters);
assert.equal(
  filtered.length,
  1,
  "combined search/status/trade/floor/priority filters must be exact and deterministic",
);
assert.equal(filtered[0]?.identity.serverId, 223);
assert.ok(
  filterLensNextIssues(issues, { ...filters, search: "no match" }).length === 0,
);

const firstFingerprint = lensNextCollectionFingerprint(issues);
const sameIssues = adaptLensNextPullResponse(
  { success: true, viewpoints: rawRows },
  26,
);
assert.equal(lensNextCollectionFingerprint(sameIssues), firstFingerprint);
assert.equal(
  reconcileLensNextRefresh(issues, sameIssues),
  issues,
  "identical refresh must retain the current collection reference",
);
const changedIssues = adaptLensNextPullResponse(
  {
    success: true,
    viewpoints: rawRows.map((row, index) =>
      index === 0 ? { ...row, note: "Updated read-only text" } : row,
    ),
  },
  26,
);
assert.notEqual(
  reconcileLensNextRefresh(issues, changedIssues),
  issues,
  "material refresh must replace the collection",
);

assert.deepEqual(
  normalizeLensNextProjects([
    { id: 26, name: "Elara East", code: "ELA01" },
    { id: 8, name: "Alpha" },
    { id: 26, name: "Duplicate must not override", code: "BAD" },
  ]),
  [
    { id: 8, name: "Alpha", code: null },
    { id: 26, name: "Elara East", code: "ELA01" },
  ],
  "authenticated project adapter must deduplicate deterministically",
);

const identity: LensNextImmutableIssueIdentity = {
  projectId: 26,
  serverId: 223,
  viewpointId: "vp-0223",
  lifecycleStatus: "active",
  revisionNumber: 3,
};
const bridgeIssue = issues.find(
  (issue) => issue.identity.serverId === identity.serverId,
);
assert.ok(bridgeIssue, "bridge fixture issue must exist");
const openRequest = createLensNextOpenWorkingViewRequest(
  identity,
  {
    sessionId: "session-1",
    projectId: 26,
    modelFingerprint: "model-sha256-1",
    displayName: "Test model",
  },
  { bimlogPhysicalId: "physical-223", navisworksGuid: "guid-223" },
  "lens-next-test-0001",
);
assert.deepEqual(Object.keys(openRequest).sort(), [
  "command",
  "fields",
  "idempotencyKey",
  "protocolVersion",
  "requestId",
]);
assert.deepEqual(Object.keys(openRequest.fields).sort(), [
  "bimlogPhysicalId",
  "lifecycleStatus",
  "modelFingerprint",
  "navisworksGuid",
  "projectId",
  "revisionNumber",
  "serverId",
  "sessionId",
  "viewpointId",
]);
assert.equal(openRequest.command, "open-working-view");
assert.ok(!JSON.stringify(openRequest).match(/label|folder|tree|activeView/i));
assert.throws(
  () =>
    assertLensNextImmutableIdentity({ ...identity, label: "unsafe fallback" }),
  /fallback identity key is forbidden/,
);
assert.throws(
  () =>
    assertLensNextImmutableIdentity({
      ...identity,
      folderPath: "Published/Issue",
    }),
  /fallback identity key is forbidden/,
);
assert.throws(
  () => assertLensNextImmutableIdentity({ ...identity, activeView: true }),
  /fallback identity key is forbidden/,
);
assert.throws(
  () =>
    assertLensNextImmutableIdentity({ ...identity, revisionNumber: undefined }),
  /revisionNumber/,
);
assert.throws(
  () =>
    adaptLensNextPullResponse(
      { success: true, viewpoints: [{ ...rawRows[0], lifecycleStatus: null }] },
      26,
    ),
  /lifecycleStatus/,
);
assert.throws(
  () =>
    adaptLensNextPullResponse(
      { success: true, viewpoints: [{ ...rawRows[0], projectId: 99 }] },
      26,
    ),
  /different project/,
);

const apiCalls: Array<{
  url: string;
  method: string;
  authorization: string | null;
}> = [];
const apiFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const method = init?.method ?? "GET";
  const headers = new Headers(init?.headers);
  apiCalls.push({ url, method, authorization: headers.get("Authorization") });
  assert.equal(method, "GET", "Phase 1 BIMLog API client may issue GET only");
  if (url.endsWith("/lens-pull")) {
    return new Response(
      JSON.stringify({ success: true, viewpoints: [rawRows[222]] }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
  if (url.endsWith("/lens-viewpoints/223/history")) {
    return new Response(
      JSON.stringify({
        success: true,
        chain: [
          {
            id: 223,
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
            fileNameBefore: null,
            fileNameAfter: null,
            details: "Read-only history event",
            userFullName: "Test User",
            userCompanyName: "Test Company",
            createdAt: "2026-08-12T01:03:42.000Z",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  return new Response("not found", { status: 404 });
}) as typeof fetch;

const api = createLensNextApiClient({
  token: "test-bearer",
  fetchImpl: apiFetch,
});
const oneIssue = await api.loadIssues(26);
assert.equal(oneIssue[0]?.identity.serverId, 223);
const history = await api.loadHistory(identity);
assert.equal(history.revisions[0]?.serverId, 223);
assert.equal(history.events[0]?.actionType, "edited");
assert.equal(apiCalls.length, 2);
assert.ok(
  apiCalls.every(
    (call) =>
      call.method === "GET" && call.authorization === "Bearer test-bearer",
  ),
);
assert.ok(
  apiCalls[0]?.url.endsWith("/api/v1/projects/26/clash-reports/lens-pull"),
);
assert.ok(
  apiCalls[1]?.url.endsWith(
    "/api/v1/projects/26/clash-reports/lens-viewpoints/223/history",
  ),
);

const bridgeCalls: Array<{ url: string; method: string; body: unknown }> = [];
const bridgeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  bridgeCalls.push({ url, method, body });
  assert.ok(
    url.startsWith(`${LENS_NEXT_BRIDGE_ORIGIN}/v1/`),
    "bridge origin must remain exact and isolated",
  );
  if (url.endsWith("/ping")) {
    assert.equal(method, "GET");
    return new Response(
      JSON.stringify({
        success: true,
        code: "pong",
        payload: { protocolVersion: 1 },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
  if (url.endsWith("/project-context")) {
    assert.equal(method, "GET");
    return new Response(
      JSON.stringify({
        success: true,
        code: "project_context",
        payload: {
          sessionId: "session-1",
          projectId: 26,
          modelFingerprint: "model-sha256-1",
          displayName: "Test model",
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
  assert.equal(url, `${LENS_NEXT_BRIDGE_ORIGIN}/v1/open-working-view`);
  assert.equal(method, "POST");
  assert.equal(body.command, "open-working-view");
  assert.equal(body.fields.projectId, String(identity.projectId));
  assert.equal(body.fields.serverId, String(identity.serverId));
  return new Response(
    JSON.stringify({
      success: true,
      code: "working_view_opened",
      payload: {
        opened: true,
        requestId: body.requestId,
        identity,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}) as typeof fetch;

const bridge = createLensNextBridgeClient({
  sessionToken: "bridge-session-token",
  fetchImpl: bridgeFetch,
  requestIdFactory: () => "lens-next-test-0002",
});
assert.equal(await bridge.probe(), true);
const bridgeContext = await bridge.loadProjectContext();
const opened = await bridge.openWorkingView(bridgeIssue, bridgeContext);
assert.equal(opened.opened, true);
assert.deepEqual(opened.identity, identity);
assert.deepEqual(
  bridgeCalls.map((call) => call.method),
  ["GET", "GET", "POST"],
);
assert.equal(
  JSON.stringify(bridgeCalls).match(
    /status-write|comment-write|publish|migrate|delete|patch|put/gi,
  ),
  null,
);

const mismatchBridge = createLensNextBridgeClient({
  sessionToken: "bridge-session-token",
  requestIdFactory: () => "lens-next-test-0003",
  fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        success: true,
        code: "working_view_opened",
        payload: {
          opened: true,
          requestId: body.requestId,
          identity: { ...identity, serverId: 999 },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch,
});
await assert.rejects(
  () => mismatchBridge.openWorkingView(bridgeIssue, bridgeContext),
  /identity echo does not match/,
);

const sessionNow = Date.parse("2026-08-12T18:00:00.000Z");
assert.throws(
  () =>
    injectLensNextBridgeSession(
      {
        protocolVersion: 1,
        source: LENS_NEXT_BRIDGE_SESSION_SOURCE,
        token: "invalid-short-token",
        issuedAt: "2026-08-12T18:00:00.000Z",
        expiresAt: "2026-08-12T18:05:00.000Z",
      },
      sessionNow,
    ),
  /token format is invalid/,
);
assert.throws(
  () =>
    injectLensNextBridgeSession(
      {
        protocolVersion: 1,
        source: LENS_NEXT_BRIDGE_SESSION_SOURCE,
        token: "abcdefghijklmnopqrstuvwxyzABCDEF",
        issuedAt: "2026-08-12T18:00:00.000Z",
        expiresAt: "2026-08-12T18:05:00.000Z",
        urlToken: "forbidden",
      },
      sessionNow,
    ),
  /unknown or missing fields/,
);
const sessionReceipt = injectLensNextBridgeSession(
  {
    protocolVersion: 1,
    source: LENS_NEXT_BRIDGE_SESSION_SOURCE,
    token: "abcdefghijklmnopqrstuvwxyzABCDEF",
    issuedAt: "2026-08-12T18:00:00.000Z",
    expiresAt: "2026-08-12T18:05:00.000Z",
  },
  sessionNow,
);
assert.equal(sessionReceipt.accepted, true);
assert.equal(
  getLensNextBridgeSessionSnapshot()?.token,
  "abcdefghijklmnopqrstuvwxyzABCDEF",
);
clearLensNextBridgeSession();
assert.equal(getLensNextBridgeSessionSnapshot(), null);

console.log(
  JSON.stringify({
    status: "PASS",
    fixtureIssues: issues.length,
    deterministicCombinedFilterMatches: filtered.length,
    refreshIdempotency: "PASS",
    authenticatedApiGets: apiCalls.length,
    historyAdapter: "PASS",
    bridgeOrigin: LENS_NEXT_BRIDGE_ORIGIN,
    bridgeMethods: bridgeCalls.map((call) => call.method),
    forbiddenFallbackDenials: 4,
    writeEndpoints: 0,
    writeCommands: 0,
    ephemeralSessionInjection: "PASS",
    persistentSessionStores: 0,
  }),
);
