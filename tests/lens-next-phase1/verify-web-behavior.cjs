"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const { performance } = require("node:perf_hooks");

const WORKTREE = path.resolve(__dirname, "..", "..");
const WEB_ROOT = path.join(
  WORKTREE,
  "artifacts",
  "bimlog",
  "src",
  "features",
  "lens-next",
);
const TYPESCRIPT_CANDIDATES = [
  path.join(WORKTREE, "node_modules", "typescript"),
  "F:\\BIMLog\\Repositories\\bimlog\\node_modules\\typescript",
];
const typescriptRoot = TYPESCRIPT_CANDIDATES.find((candidate) =>
  fs.existsSync(path.join(candidate, "package.json")),
);
assert.ok(typescriptRoot, "An existing F-root TypeScript runtime is required");
const ts = require(typescriptRoot);

const moduleCache = new Map();

function resolveLocalTypeScript(fromFile, request) {
  if (!request.startsWith(".")) return null;
  const base = path.resolve(path.dirname(fromFile), request);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`Cannot resolve ${request} from ${fromFile}`);
}

function loadTypeScriptModule(file) {
  const absolute = path.resolve(file);
  if (moduleCache.has(absolute)) return moduleCache.get(absolute).exports;
  const source = fs.readFileSync(absolute, "utf8");
  const transpiled = ts.transpileModule(source, {
    fileName: absolute,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      strict: true,
    },
    reportDiagnostics: true,
  });
  assert.deepEqual(
    transpiled.diagnostics ?? [],
    [],
    `Transpile diagnostics in ${path.relative(WORKTREE, absolute)}`,
  );
  const loaded = new Module(absolute, module);
  moduleCache.set(absolute, loaded);
  loaded.filename = absolute;
  loaded.paths = Module._nodeModulePaths(path.dirname(absolute));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (request) => {
    const local = resolveLocalTypeScript(absolute, request);
    return local ? loadTypeScriptModule(local) : originalRequire(request);
  };
  loaded._compile(transpiled.outputText, absolute);
  return loaded.exports;
}

const model = loadTypeScriptModule(path.join(WEB_ROOT, "lens-next-model.ts"));
const client = loadTypeScriptModule(path.join(WEB_ROOT, "lens-next-client.ts"));

let passed = 0;
function test(name, action) {
  try {
    action();
    passed += 1;
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    process.stderr.write(`FAIL ${name}: ${error.stack ?? error}\n`);
    process.exitCode = 1;
  }
}

function row(id, overrides = {}) {
  return {
    id,
    projectId: 26,
    viewpointId: `vp-${id}`,
    displayId: `L-${id}`,
    navisworksGuid: `guid-${id}`,
    bimlogPhysicalId: `physical-${id}`,
    issueGroupId: `group-${id}`,
    note: `Issue ${id}`,
    openItems: null,
    trade: id % 2 === 0 ? "MEP" : "Structural",
    floor: id % 3 === 0 ? "L2" : "L1",
    responsibleCompany: "BIMCorp Inc",
    reportType: "coordination",
    priority: (id % 5) + 1,
    status: id % 2 === 0 ? "open" : "follow_up",
    lifecycleStatus: "active",
    revisionNumber: 1,
    capturedAt: "2026-08-12T12:00:00.000Z",
    syncedAt: "2026-08-12T12:01:00.000Z",
    supersedesId: null,
    supersedesCode: null,
    ...overrides,
  };
}

function pull(rows) {
  return { success: true, viewpoints: rows };
}

function identity(id) {
  return {
    projectId: 26,
    serverId: id,
    viewpointId: `vp-${id}`,
    lifecycleStatus: "active",
    revisionNumber: 1,
  };
}

test("panel source is valid TSX without generating output", () => {
  const panelPath = path.join(WEB_ROOT, "LensNextPanel.tsx");
  const transpiled = ts.transpileModule(fs.readFileSync(panelPath, "utf8"), {
    fileName: panelPath,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
    },
    reportDiagnostics: true,
  });
  assert.deepEqual(transpiled.diagnostics ?? [], []);
  assert.ok(transpiled.outputText.includes("react/jsx-runtime"));
});

test("immutable identity accepts only the five exact authority fields", () => {
  assert.deepEqual(model.assertLensNextImmutableIdentity(identity(7)), identity(7));
  for (const forbidden of [
    "label",
    "displayId",
    "folderPath",
    "treePosition",
    "activeView",
  ]) {
    assert.throws(
      () => model.assertLensNextImmutableIdentity({ ...identity(7), [forbidden]: "fallback" }),
      /forbidden/,
    );
  }
  assert.throws(
    () => model.assertLensNextImmutableIdentity({ ...identity(7), serverId: undefined }),
    /serverId/,
  );
  for (const invalidIdentity of [
    { ...identity(7), projectId: 0 },
    { ...identity(7), serverId: -1 },
    { ...identity(7), revisionNumber: 0 },
    { ...identity(7), lifecycleStatus: "deleted" },
  ]) {
    assert.throws(() => model.assertLensNextImmutableIdentity(invalidIdentity));
  }
});

test("lens-pull adaptation is project-bound, duplicate-free, and honest about thumbnails", () => {
  const issues = model.adaptLensNextPullResponse(pull([row(1), row(2)]), 26);
  assert.equal(issues.length, 2);
  assert.ok(issues.every((issue) => issue.screenshotUrl === null));
  assert.throws(
    () => model.adaptLensNextPullResponse(pull([row(1, { projectId: 27 })]), 26),
    /different project/,
  );
  assert.throws(
    () => model.adaptLensNextPullResponse(pull([row(1), row(1)]), 26),
    /duplicate server identity/,
  );
});

test("refresh is deterministic and reuses identical state", () => {
  const current = model.adaptLensNextPullResponse(pull([row(1), row(2)]), 26);
  const incoming = model.adaptLensNextPullResponse(pull([row(1), row(2)]), 26);
  assert.equal(model.reconcileLensNextRefresh(current, incoming), current);
  const changed = model.adaptLensNextPullResponse(
    pull([row(1, { note: "Changed" }), row(2)]),
    26,
  );
  assert.equal(model.reconcileLensNextRefresh(current, changed), changed);
});

test("filters are deterministic and display fields never become identity", () => {
  const issues = model.adaptLensNextPullResponse(pull([row(1), row(2), row(3)]), 26);
  const filtered = model.filterLensNextIssues(issues, {
    search: "L-2",
    status: "open",
    trade: "MEP",
    floor: "all",
    priority: "all",
  });
  assert.deepEqual(filtered.map((issue) => issue.identity.serverId), [2]);
  assert.deepEqual(Object.keys(filtered[0].identity), [
    "projectId",
    "serverId",
    "viewpointId",
    "lifecycleStatus",
    "revisionNumber",
  ]);
});

test("500-issue read/filter fixture remains duplicate-free and bounded", () => {
  const fixture = Array.from({ length: 500 }, (_, index) => row(index + 1));
  const started = performance.now();
  const issues = model.adaptLensNextPullResponse(pull(fixture), 26);
  const filtered = model.filterLensNextIssues(issues, {
    search: "Issue",
    status: "all",
    trade: "all",
    floor: "all",
    priority: "all",
  });
  const elapsedMs = performance.now() - started;
  assert.equal(issues.length, 500);
  assert.equal(filtered.length, 500);
  assert.equal(new Set(issues.map((issue) => issue.identity.serverId)).size, 500);
  assert.ok(elapsedMs < 1_000, `500-issue fixture took ${elapsedMs.toFixed(1)}ms`);
});

test("open request contains no fallback or workflow-write fields", () => {
  const request = model.createLensNextOpenWorkingViewRequest(
    identity(12),
    { sessionId: "session-1", projectId: 26, modelFingerprint: "model-1", displayName: null },
    { bimlogPhysicalId: "physical-12", navisworksGuid: "guid-12" },
    "request-00000012",
  );
  assert.equal(request.protocolVersion, 1);
  assert.equal(request.command, "open-working-view");
  assert.equal(request.idempotencyKey, request.requestId);
  assert.deepEqual(request.fields, {
    sessionId: "session-1",
    projectId: "26",
    serverId: "12",
    viewpointId: "vp-12",
    lifecycleStatus: "active",
    revisionNumber: "1",
    modelFingerprint: "model-1",
    bimlogPhysicalId: "physical-12",
    navisworksGuid: "guid-12",
  });
  assert.ok(!JSON.stringify(request).match(/label|folderPath|treePosition|activeView/));
  assert.throws(
    () =>
      model.createLensNextOpenWorkingViewRequest(
        identity(12),
        { sessionId: "session-1", projectId: 27, modelFingerprint: "model-1", displayName: null },
        { bimlogPhysicalId: "physical-12", navisworksGuid: "guid-12" },
        "request-00000012",
      ),
    /does not match/,
  );
});

async function asyncTests() {
  const platformCalls = [];
  const api = client.createLensNextApiClient({
    token: "test-token",
    apiBaseUrl: "/api/v1",
    fetchImpl: async (url, init) => {
      platformCalls.push({ url: String(url), init });
      return new Response(JSON.stringify(pull([row(1)])), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  const issues = await api.loadIssues(26);
  assert.equal(issues.length, 1);
  assert.equal(platformCalls.length, 1);
  assert.equal(platformCalls[0].url, "/api/v1/projects/26/clash-reports/lens-pull");
  assert.equal(platformCalls[0].init.method, "GET");
  assert.equal(platformCalls[0].init.headers.Authorization, "Bearer test-token");

  const bridgeCalls = [];
  const bridge = client.createLensNextBridgeClient({
    sessionToken: "session-token",
    requestIdFactory: () => "request-bridge-0001",
    fetchImpl: async (url, init) => {
      bridgeCalls.push({ url: String(url), init });
      if (String(url).endsWith("/v1/ping")) {
        return new Response(JSON.stringify({ success: true, code: "pong", payload: { protocolVersion: 1 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (String(url).endsWith("/v1/project-context")) {
        return new Response(JSON.stringify({
          success: true,
          code: "project_context",
          payload: { sessionId: "session-1", projectId: 26, modelFingerprint: "model-1", displayName: "Model" },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      const request = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          success: true,
          code: "working_view_opened",
          payload: {
            opened: true,
            requestId: request.requestId,
            identity: {
              projectId: Number(request.fields.projectId),
              serverId: Number(request.fields.serverId),
              viewpointId: request.fields.viewpointId,
              lifecycleStatus: request.fields.lifecycleStatus,
              revisionNumber: Number(request.fields.revisionNumber),
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });
  assert.equal(await bridge.probe(), true);
  const context = await bridge.loadProjectContext();
  const opened = await bridge.openWorkingView(issues[0], context);
  assert.equal(opened.opened, true);
  assert.equal(bridgeCalls[0].url, "http://127.0.0.1:8766/v1/ping");
  assert.equal(bridgeCalls[0].init.method, "GET");
  assert.equal(bridgeCalls[1].url, "http://127.0.0.1:8766/v1/project-context");
  assert.equal(bridgeCalls[1].init.method, "GET");
  assert.equal(bridgeCalls[2].url, "http://127.0.0.1:8766/v1/open-working-view");
  assert.equal(bridgeCalls[2].init.method, "POST");
  const openBody = JSON.parse(bridgeCalls[2].init.body);
  assert.equal(openBody.command, "open-working-view");
  assert.equal(openBody.protocolVersion, 1);
  assert.ok(!JSON.stringify(openBody).match(/status-write|comment-write|publish|migrate/));
  assert.equal(platformCalls.filter(({ init }) => init.method !== "GET").length, 0);
}

asyncTests()
  .then(() => {
    passed += 1;
    process.stdout.write("PASS clients use GET-only BIMLog reads and the isolated read-only bridge\n");
    process.stdout.write(`PASS ${passed}/8\n`);
  })
  .catch((error) => {
    process.stderr.write(`FAIL clients: ${error.stack ?? error}\n`);
    process.exitCode = 1;
  });
