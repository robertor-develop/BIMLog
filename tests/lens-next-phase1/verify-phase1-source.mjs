import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const TEST_RELATIVE_PATH = "tests/lens-next-phase1/verify-phase1-source.mjs";
const IDENTITY_RELATIVE_PATH =
  "evidence/lens-next/20260812/identity-isolation-contract.json";
const ACCEPTANCE_RELATIVE_PATH =
  "evidence/lens-next/20260812/phase1-readonly-acceptance-contract.json";
const APP_RELATIVE_PATH = "artifacts/bimlog/src/App.tsx";
const WEB_RELATIVE_ROOT = "artifacts/bimlog/src/features/lens-next";
const WEB_SCRIPT_RELATIVE_ROOT = "artifacts/bimlog/scripts/lens-next";
const NATIVE_RELATIVE_ROOT = "plugins/BIMLogLensNext";
const RECEIPT_RELATIVE_ROOT = "evidence/lens-next/20260812/integration";

const EXPECTED_IDENTITY_SHA256 =
  "E22E953EFF210FF189D635BF34A16D6E9954E5B51F234728179DDD8A2F45A317";
const EXPECTED_ACCEPTANCE_SHA256 =
  "83154183F6E0E7B81BB897D2E687562C8116A047FC9F4DBB5BB8FF8BE40626E5";

const EXPECTED = Object.freeze({
  assembly: "BIMLogLensNext",
  dll: "BIMLogLensNext.dll",
  rootNamespace: "BIMLogLensNext",
  dockPluginId: "BIMLogLensNext.IgniteSmart",
  dockPanelId: "BIMLogLensNext.IgniteSmart",
  buttonPluginId: "BIMLogLensNextButton.IgniteSmart",
  installationFolder: "BIMLogLensNext",
  installerDefinition: "Install-BIMLogLensNext",
  uninstallerDefinition: "Uninstall-BIMLogLensNext",
  configurationRoot: "%LOCALAPPDATA%\\BIMLog\\LensNext",
  configurationFile: "lens-next.config.json",
  cacheRoot: "%LOCALAPPDATA%\\BIMLog\\LensNext\\cache",
  logRoot: "%LOCALAPPDATA%\\BIMLog\\LensNext\\logs",
  featureFlagPrefix: "lens_next.",
  metadataNamespace: "bimlog.lens_next.v1",
  metadataSource: "BIMLogLensNext",
  bridgeOrigin: "http://127.0.0.1:8766",
  bridgeProtocolVersion: 1,
  publishedFolder: "BIMLog Lens Next Published",
  publishedMarker: "bimlog.lens_next.published.v1",
});

const READ_ONLY_COMMANDS = Object.freeze([
  "ping",
  "capabilities",
  "project-context",
  "open-working-view",
]);

const FORBIDDEN_COMMANDS = Object.freeze([
  "status-write",
  "comment-write",
  "assignment-write",
  "visual-capture",
  "visual-update",
  "publish",
  "migrate",
  "recover-duplicate",
]);

const FORBIDDEN_RESOLVERS = Object.freeze([
  "label",
  "displayName",
  "displayId",
  "folderPath",
  "treePosition",
  "activeView",
  "firstMatch",
  "bestGuess",
]);

const LEGACY = Object.freeze({
  assembly: "BIMLogNavisPlugin",
  dockPluginId: "BIMLogLens.IgniteSmart",
  buttonPluginId: "BIMLogLensButton.IgniteSmart",
  bridgeOrigin: "http://localhost:8765",
  metadataSource: "BIMLogLens",
  configurationRoot: "%APPDATA%\\BIMLog",
});

const PHASE1_WEB_PATHS = Object.freeze([
  "artifacts/bimlog/src/features/lens-next/index.ts",
  "artifacts/bimlog/src/features/lens-next/lens-next-client.ts",
  "artifacts/bimlog/src/features/lens-next/lens-next-model.ts",
  "artifacts/bimlog/src/features/lens-next/lens-next-panel.css",
  "artifacts/bimlog/src/features/lens-next/lens-next-session.ts",
  "artifacts/bimlog/src/features/lens-next/lens-next-types.ts",
  "artifacts/bimlog/src/features/lens-next/LensNextPanel.tsx",
  "artifacts/bimlog/src/features/lens-next/LensNextPanelView.tsx",
  "artifacts/bimlog/src/features/lens-next/LensNextWorkspace.tsx",
]);

const EXPECTED_WEB_PATHS = Object.freeze([
  ...PHASE1_WEB_PATHS,
  "artifacts/bimlog/src/features/lens-next/lens-next-action-draft.ts",
  "artifacts/bimlog/src/features/lens-next/lens-next-activity-timeline.ts",
  "artifacts/bimlog/src/features/lens-next/lens-next-auto-refresh.ts",
  "artifacts/bimlog/src/features/lens-next/lens-next-offline-queue.ts",
  "artifacts/bimlog/src/features/lens-next/lens-next-phase2-capability.ts",
  "artifacts/bimlog/src/features/lens-next/LensNextActionDraftView.tsx",
  "artifacts/bimlog/src/features/lens-next/LensNextActivityTimelineView.tsx",
  "artifacts/bimlog/src/features/lens-next/LensNextConflictReviewView.tsx",
  "artifacts/bimlog/src/features/lens-next/LensNextConnectionTelemetryView.tsx",
  "artifacts/bimlog/src/features/lens-next/LensNextOfflineQueueView.tsx",
  "artifacts/bimlog/src/features/lens-next/LensNextPhase2WorkflowShell.tsx",
  "artifacts/bimlog/src/features/lens-next/LensNextWorkflowStateBanner.tsx",
]);

const PHASE1_WEB_SCRIPT_PATHS = Object.freeze([
  "artifacts/bimlog/scripts/lens-next/lens-next-panel-render.behavior.tsx",
  "artifacts/bimlog/scripts/lens-next/lens-next-phase1.behavior.ts",
]);

const EXPECTED_WEB_SCRIPT_PATHS = Object.freeze([
  ...PHASE1_WEB_SCRIPT_PATHS,
  "artifacts/bimlog/scripts/lens-next/lens-next-action-draft-view.behavior.tsx",
  "artifacts/bimlog/scripts/lens-next/lens-next-action-draft.behavior.ts",
  "artifacts/bimlog/scripts/lens-next/lens-next-activity-timeline-view.behavior.tsx",
  "artifacts/bimlog/scripts/lens-next/lens-next-activity-timeline.behavior.ts",
  "artifacts/bimlog/scripts/lens-next/lens-next-auto-refresh.behavior.ts",
  "artifacts/bimlog/scripts/lens-next/lens-next-conflict-review-view.behavior.tsx",
  "artifacts/bimlog/scripts/lens-next/lens-next-connection-telemetry-view.behavior.tsx",
  "artifacts/bimlog/scripts/lens-next/lens-next-offline-queue-view.behavior.tsx",
  "artifacts/bimlog/scripts/lens-next/lens-next-offline-queue.behavior.ts",
  "artifacts/bimlog/scripts/lens-next/lens-next-phase2-capability.behavior.ts",
  "artifacts/bimlog/scripts/lens-next/lens-next-phase2-workflow-shell.behavior.tsx",
  "artifacts/bimlog/scripts/lens-next/lens-next-workflow-state-banner.behavior.tsx",
]);

const PHASE1_NATIVE_PATHS = Object.freeze([
  "plugins/BIMLogLensNext/.gitignore",
  "plugins/BIMLogLensNext/BIMLogLensNext.csproj",
  "plugins/BIMLogLensNext/config/lens-next.config.schema.json",
  "plugins/BIMLogLensNext/contracts/metadata.contract.json",
  "plugins/BIMLogLensNext/contracts/plugin-registration.contract.json",
  "plugins/BIMLogLensNext/install/Install-BIMLogLensNext.contract.json",
  "plugins/BIMLogLensNext/install/Uninstall-BIMLogLensNext.contract.json",
  "plugins/BIMLogLensNext/src/BridgeContracts.cs",
  "plugins/BIMLogLensNext/src/BridgeRequestValidator.cs",
  "plugins/BIMLogLensNext/src/ImmutableIdentity.cs",
  "plugins/BIMLogLensNext/src/LensNextConstants.cs",
  "plugins/BIMLogLensNext/src/LensNextFeatureFlags.cs",
  "plugins/BIMLogLensNext/src/LensNextReadOnlyBridge.cs",
  "plugins/BIMLogLensNext/src/LensNextStateContract.cs",
  "plugins/BIMLogLensNext/src/NativeAbstractions.cs",
  "plugins/BIMLogLensNext/src/PluginRegistrationContract.cs",
  "plugins/BIMLogLensNext/tests/BIMLogLensNext.Tests.csproj",
  "plugins/BIMLogLensNext/tests/Program.cs",
  "plugins/BIMLogLensNext/tests/Run-IsolationContract.ps1",
]);

const EXPECTED_NATIVE_PATHS = Object.freeze([
  ...PHASE1_NATIVE_PATHS,
  "plugins/BIMLogLensNext/contracts/readonly-package.contract.json",
  "plugins/BIMLogLensNext/native/2021/BIMLogLensNext.Native2021.csproj",
  "plugins/BIMLogLensNext/native/2021/PackageContents.xml",
  "plugins/BIMLogLensNext/native/2021/ThisAssemblyProductYear.cs",
  "plugins/BIMLogLensNext/native/2025/BIMLogLensNext.Native2025.csproj",
  "plugins/BIMLogLensNext/native/2025/PackageContents.xml",
  "plugins/BIMLogLensNext/native/2025/ThisAssemblyProductYear.cs",
  "plugins/BIMLogLensNext/native/AutodeskPluginEntryPoints.cs",
  "plugins/BIMLogLensNext/native/AutodeskReadOnlyAdapter.cs",
  "plugins/BIMLogLensNext/native/Build-LensNextReadOnlyPackages.ps1",
  "plugins/BIMLogLensNext/native/Build-LensNextSandboxPackages.ps1",
  "plugins/BIMLogLensNext/native/NativeReferenceBinding.cs",
  "plugins/BIMLogLensNext/native/NavisworksReferenceGate.targets",
  "plugins/BIMLogLensNext/native/tests/2021/BIMLogLensNext.Native2021.Tests.csproj",
  "plugins/BIMLogLensNext/native/tests/2021/ExpectedProductYear.cs",
  "plugins/BIMLogLensNext/native/tests/2025/BIMLogLensNext.Native2025.Tests.csproj",
  "plugins/BIMLogLensNext/native/tests/2025/ExpectedProductYear.cs",
  "plugins/BIMLogLensNext/native/tests/AdapterContractTests.cs",
  "plugins/BIMLogLensNext/src/LensNextPhase2CommandPolicy.cs",
  "plugins/BIMLogLensNext/tests/Phase2CommandPolicyTests.cs",
]);

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function findWorktreeRoot() {
  let candidate = path.dirname(new URL(import.meta.url).pathname);
  if (/^\/[A-Za-z]:/.test(candidate)) candidate = candidate.slice(1);
  candidate = decodeURIComponent(candidate);
  for (let depth = 0; depth < 8; depth += 1) {
    if (
      fs.existsSync(path.join(candidate, IDENTITY_RELATIVE_PATH)) &&
      fs.existsSync(path.join(candidate, ACCEPTANCE_RELATIVE_PATH))
    ) {
      return candidate;
    }
    const parent = path.dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }
  throw new Error("Unable to resolve the Lens Next worktree root.");
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function canonicalTextBytes(bytes) {
  return Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
}

function readBytes(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath));
}

function readText(root, relativePath) {
  return readBytes(root, relativePath).toString("utf8");
}

function listFiles(root, relativeRoot) {
  const absoluteRoot = path.join(root, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return [];
  const files = [];
  const visit = (absoluteDirectory) => {
    for (const entry of fs.readdirSync(absoluteDirectory, {
      withFileTypes: true,
    })) {
      const absolute = path.join(absoluteDirectory, entry.name);
      const relative = toPosix(path.relative(root, absolute));
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        files.push({ relative, absolute, symbolicLink: true });
      } else if (entry.isDirectory()) {
        if (!new Set(["bin", "obj", ".dotnet-home"]).has(entry.name)) visit(absolute);
      } else if (entry.isFile()) {
        files.push({ relative, absolute, symbolicLink: false });
      }
    }
  };
  visit(absoluteRoot);
  return files.sort((left, right) => left.relative.localeCompare(right.relative));
}

function sourceText(files, allowedExtensions) {
  return files
    .filter(({ relative }) => allowedExtensions.has(path.extname(relative)))
    .map(({ absolute }) => fs.readFileSync(absolute, "utf8"))
    .join("\n");
}

function fileHashes(files) {
  return files.map(({ relative, absolute, symbolicLink }) => {
    const bytes = canonicalTextBytes(fs.readFileSync(absolute));
    return { path: relative, symbolicLink, bytes: bytes.length, sha256: sha256(bytes) };
  });
}

const root = findWorktreeRoot();
const results = [];

function record(id, passed, detail, kind = "assertion") {
  results.push({ id, kind, passed: Boolean(passed), detail });
}

function recordEqual(id, actual, expected) {
  record(id, actual === expected, { actual, expected });
}

const identityBytes = readBytes(root, IDENTITY_RELATIVE_PATH);
const acceptanceBytes = readBytes(root, ACCEPTANCE_RELATIVE_PATH);
const identity = JSON.parse(identityBytes.toString("utf8"));
const acceptance = JSON.parse(acceptanceBytes.toString("utf8"));

recordEqual("contract.identity.sha256", sha256(canonicalTextBytes(identityBytes)), EXPECTED_IDENTITY_SHA256);
recordEqual(
  "contract.acceptance.sha256",
  sha256(canonicalTextBytes(acceptanceBytes)),
  EXPECTED_ACCEPTANCE_SHA256,
);
recordEqual(
  "contract.identity.status",
  identity.status,
  "assessment_bound_phase1_may_proceed",
);
recordEqual(
  "contract.acceptance.status",
  acceptance.status,
  "PHASE1_SOURCE_READY_IDENTITY_CONTRACT_CONSUMED",
);
recordEqual(
  "contract.worktree.root",
  path.resolve(root).toLowerCase(),
  path.resolve(identity.authoritativeWorktree).toLowerCase(),
);

for (const [name, expected] of Object.entries(EXPECTED)) {
  const contractKey = {
    assembly: "assembly",
    dll: "dll",
    rootNamespace: "rootNamespace",
    dockPluginId: "dockPluginId",
    dockPanelId: "dockPanelId",
    buttonPluginId: "buttonPluginId",
    installationFolder: "installationFolderName",
    installerDefinition: "installerDefinition",
    uninstallerDefinition: "uninstallerDefinition",
    configurationRoot: "configurationRoot",
    configurationFile: "configurationFile",
    cacheRoot: "cacheRoot",
    logRoot: "logRoot",
    featureFlagPrefix: "featureFlagPrefix",
    metadataNamespace: "metadataNamespace",
    metadataSource: "metadataSource",
    bridgeOrigin: "bridgeDefault",
    publishedFolder: "publishedFolder",
    publishedMarker: "publishedMarker",
  }[name];
  if (name === "bridgeProtocolVersion") {
    recordEqual(`identity.${name}`, identity.bridge.protocolVersion, expected);
  } else {
    recordEqual(`identity.${name}`, identity.nextIsolation[contractKey], expected);
  }
}

record(
  "contract.read-only-command-allowlist",
  JSON.stringify(identity.bridge.phase1Commands) === JSON.stringify(READ_ONLY_COMMANDS),
  { actual: identity.bridge.phase1Commands, expected: READ_ONLY_COMMANDS },
);
record(
  "contract.forbidden-command-set",
  JSON.stringify(identity.bridge.phase1ForbiddenCommands) ===
    JSON.stringify(FORBIDDEN_COMMANDS),
  {
    actual: identity.bridge.phase1ForbiddenCommands,
    expected: FORBIDDEN_COMMANDS,
  },
);

const appFiles = fs.existsSync(path.join(root, APP_RELATIVE_PATH))
  ? [{
      relative: APP_RELATIVE_PATH,
      absolute: path.join(root, APP_RELATIVE_PATH),
      symbolicLink: fs.lstatSync(path.join(root, APP_RELATIVE_PATH)).isSymbolicLink(),
    }]
  : [];
const webFiles = listFiles(root, WEB_RELATIVE_ROOT);
const webScriptFiles = listFiles(root, WEB_SCRIPT_RELATIVE_ROOT);
const nativeFiles = listFiles(root, NATIVE_RELATIVE_ROOT);
record(
  "source.app.present",
  appFiles.length === 1,
  appFiles.length === 1 ? APP_RELATIVE_PATH : `${APP_RELATIVE_PATH} is absent`,
  "readiness",
);
record(
  "source.web.present",
  webFiles.length === EXPECTED_WEB_PATHS.length,
  webFiles.length > 0 ? `${webFiles.length} file(s)` : `${WEB_RELATIVE_ROOT} is absent`,
  "readiness",
);
record(
  "source.web-scripts.present",
  webScriptFiles.length === EXPECTED_WEB_SCRIPT_PATHS.length,
  webScriptFiles.length > 0
    ? `${webScriptFiles.length} file(s)`
    : `${WEB_SCRIPT_RELATIVE_ROOT} is absent`,
  "readiness",
);
record(
  "source.native.present",
  nativeFiles.length === EXPECTED_NATIVE_PATHS.length,
  nativeFiles.length > 0
    ? `${nativeFiles.length} file(s)`
    : `${NATIVE_RELATIVE_ROOT} is absent`,
  "readiness",
);

const exactPathsEqual = (files, expected) =>
  files.every(({ symbolicLink }) => !symbolicLink) &&
  JSON.stringify(files.map(({ relative }) => relative).sort()) ===
    JSON.stringify([...expected].sort());
const appAllowed = exactPathsEqual(appFiles, [APP_RELATIVE_PATH]);
const webAllowed = exactPathsEqual(webFiles, EXPECTED_WEB_PATHS);
const webScriptsAllowed = exactPathsEqual(webScriptFiles, EXPECTED_WEB_SCRIPT_PATHS);
const nativeAllowed = exactPathsEqual(nativeFiles, EXPECTED_NATIVE_PATHS);
record("source.app.path-allowlist", appAllowed, appFiles.map(({ relative }) => relative));
record("source.web.path-allowlist", webAllowed, webFiles.map(({ relative }) => relative));
record(
  "source.web-scripts.path-allowlist",
  webScriptsAllowed,
  webScriptFiles.map(({ relative }) => relative),
);
record(
  "source.native.path-allowlist",
  nativeAllowed,
  nativeFiles.map(({ relative }) => relative),
);

const appText = sourceText(appFiles, new Set([".tsx"]));
const phase1WebFiles = webFiles.filter(({ relative }) => PHASE1_WEB_PATHS.includes(relative));
const phase1WebScriptFiles = webScriptFiles.filter(({ relative }) => PHASE1_WEB_SCRIPT_PATHS.includes(relative));
const phase1NativeFiles = nativeFiles.filter(({ relative }) => PHASE1_NATIVE_PATHS.includes(relative));
const webText = sourceText(phase1WebFiles, new Set([".ts", ".tsx", ".css", ".json"]));
const webScriptText = sourceText(phase1WebScriptFiles, new Set([".ts", ".tsx"]));
const nativeText = sourceText(phase1NativeFiles, new Set([".cs", ".csproj", ".json"]));
const nativeCsFiles = nativeFiles.filter(
  ({ relative }) =>
    relative.startsWith(`${NATIVE_RELATIVE_ROOT}/src/`) && relative.endsWith(".cs"),
);
const nativeCsText = sourceText(nativeCsFiles, new Set([".cs"]));
const nativeBridgeContractsText = nativeFiles
  .filter(({ relative }) => relative === `${NATIVE_RELATIVE_ROOT}/src/BridgeContracts.cs`)
  .map(({ absolute }) => fs.readFileSync(absolute, "utf8"))
  .join("\n");

if (nativeFiles.length > 0) {
  for (const value of [
    EXPECTED.assembly,
    EXPECTED.dll,
    EXPECTED.rootNamespace,
    EXPECTED.dockPluginId,
    EXPECTED.dockPanelId,
    EXPECTED.buttonPluginId,
    EXPECTED.configurationRoot,
    EXPECTED.cacheRoot,
    EXPECTED.logRoot,
    EXPECTED.metadataNamespace,
    EXPECTED.bridgeOrigin,
  ]) {
    record(`native.identity.${value}`, nativeText.includes(value), value);
  }
  record(
    "native.bridge.protocol-version",
    /BridgeProtocolVersion\s*=\s*1\s*;/.test(nativeCsText),
    "BridgeProtocolVersion must be exactly 1",
  );
  const nativeCommandLiterals = [...nativeBridgeContractsText.matchAll(/public const string \w+\s*=\s*\"([^\"]+)\"/g)]
    .map((match) => match[1]);
  record(
    "native.command.allowlist.exact",
    JSON.stringify(nativeCommandLiterals) === JSON.stringify(READ_ONLY_COMMANDS),
    { actual: nativeCommandLiterals, expected: READ_ONLY_COMMANDS },
  );
  for (const command of FORBIDDEN_COMMANDS) {
    record(
      `native.command.reject.${command}`,
      !nativeCommandLiterals.includes(command),
      command,
    );
  }
  for (const resolver of FORBIDDEN_RESOLVERS) {
    record(
      `native.fallback.reject.${resolver}`,
      nativeCsText.includes(`\"${resolver}\"`),
      `${resolver} must be named by the validator deny set`,
    );
  }
  record(
    "native.fallback.fail-closed-code",
    nativeCsText.includes("fallback_resolver_forbidden"),
    "fallback_resolver_forbidden",
  );
  record(
    "native.identity.missing-and-ambiguous-block",
    nativeCsText.includes("identity_not_found") &&
      nativeCsText.includes("identity_ambiguous"),
    "Both exact-resolution failure states must be explicit",
  );
  record(
    "native.read-only.capability-flags",
    /WritesEnabled\s*=\s*false/.test(nativeCsText) &&
      /SavedViewpointMutationEnabled\s*=\s*false/.test(nativeCsText),
    "Writes and SavedViewpoint mutation must both be disabled",
  );
  record(
    "native.saved-viewpoint-mutation-api.absent",
    !/(?:DocumentSavedViewpoints|SavedViewpoints\s*\.|CreateSavedViewpoint|AddSavedViewpoint|RemoveSavedViewpoint|DeleteSavedViewpoint|MoveSavedViewpoint|RenameSavedViewpoint)/i.test(
      nativeCsText,
    ),
    "No SavedViewpoint collection or mutation API may appear in Phase 1 source",
  );
  record(
    "native.legacy-identifiers.absent-from-runtime",
    !nativeCsText.includes(LEGACY.assembly) &&
      !nativeCsText.includes(LEGACY.dockPluginId) &&
      !nativeCsText.includes(LEGACY.buttonPluginId) &&
      !nativeCsText.includes(LEGACY.bridgeOrigin),
    "Legacy assembly/plugin IDs/port must not appear in native runtime source",
  );
  record(
    "native.legacy-state-reference.is-deny-only",
    !nativeCsFiles.some(({ relative, absolute }) => {
      const text = fs.readFileSync(absolute, "utf8");
      const containsLegacyPath =
        text.includes(LEGACY.configurationRoot) || text.includes("AppData\\Roaming\\BIMLog");
      return containsLegacyPath && !relative.endsWith("LensNextStateContract.cs");
    }) &&
      nativeCsText.includes("IsLegacyPath"),
    "A Legacy state path may appear only in the explicit deny classifier",
  );
  record(
    "native.idempotency-key-equals-request-id",
    nativeCsText.includes("idempotency_key_mismatch") &&
      /string\.Equals\(request\.RequestId, request\.IdempotencyKey, StringComparison\.Ordinal\)/.test(
        nativeCsText,
      ),
    "Every accepted request requires idempotencyKey == requestId",
  );
  record(
    "native.active-session-binding",
    nativeCsText.includes("session_context_mismatch") &&
      /string\.Equals\(identity\.SessionId, _sessionId, StringComparison\.Ordinal\)/.test(
        nativeCsText,
      ),
    "open-working-view must bind to the active native session ID",
  );
  record(
    "native.strict-positive-identifiers-and-revision",
    ["ProjectId", "ServerId", "RevisionNumber"].every((field) =>
      nativeCsText.includes(`RequirePositiveInteger(${field}`),
    ) &&
      nativeCsText.includes("LifecycleStatus.Equals(\"active\"") &&
      nativeCsText.includes("LifecycleStatus.Equals(\"superseded\"") &&
      nativeCsText.includes("LifecycleStatus.Equals(\"voided\""),
    "projectId, serverId and revisionNumber are strict positive integers; lifecycle is closed",
  );
  record(
    "native.bridge-token-memory-only",
    /private readonly string _sessionToken/.test(nativeCsText) &&
      !/(?:Registry|File\.(?:Write|Append)|StreamWriter|ProtectedData|Environment\.SetEnvironmentVariable)/.test(
        nativeCsText,
      ),
    "The bounded bridge token remains private in memory with no persistence API",
  );
}

if (webFiles.length > 0) {
  record(
    "web.bridge.origin",
    webText.includes(EXPECTED.bridgeOrigin) && !webText.includes(LEGACY.bridgeOrigin),
    { expected: EXPECTED.bridgeOrigin, forbidden: LEGACY.bridgeOrigin },
  );
  record(
    "web.bridge.protocol-version",
    /(?:protocolVersion|BRIDGE_PROTOCOL_VERSION)[^\n=:{]*[:=]\s*1\b/.test(webText),
    "Web bridge protocol must be exactly 1",
  );
  const webCommandLiterals = [...webText.matchAll(/command\s*:\s*[\"']([^\"']+)[\"']/g)]
    .map((match) => match[1]);
  record(
    "web.command.subset-of-native-read-only-allowlist",
    webCommandLiterals.length > 0 &&
      webCommandLiterals.every((command) => READ_ONLY_COMMANDS.includes(command)),
    { actual: webCommandLiterals, allowed: READ_ONLY_COMMANDS },
  );
  for (const command of FORBIDDEN_COMMANDS) {
    record(
      `web.command.reject.${command}`,
      !webText.includes(`\"${command}\"`) && !webText.includes(`'${command}'`),
      command,
    );
  }
  record(
    "web.live-read.endpoint",
    webText.includes("/lens-pull"),
    "Phase 1 live issue retrieval must use the read-only Lens pull endpoint",
  );
  record(
    "web.platform-write-endpoints.absent",
    !/(?:lens-sync|\/edit|\/reassign|\/void|\/bulk-|\/comments?)(?:[\"'`/?]|$)/i.test(
      webText,
    ),
    "No platform write endpoint may appear in Lens Next Phase 1 source",
  );
  record(
    "web.mutating-api-methods.absent-outside-loopback-bridge",
    !webFiles.some(({ relative, absolute }) => {
      const text = fs.readFileSync(absolute, "utf8");
      if (!/(?:method\s*:\s*[\"'](?:POST|PUT|PATCH|DELETE)|apiRequest\s*\(\s*[\"'](?:POST|PUT|PATCH|DELETE))/i.test(text)) {
        return false;
      }
      const isBoundReadOnlyBridgeClient =
        text.includes(EXPECTED.bridgeOrigin) &&
        text.includes("/v1/open-working-view") &&
        !/(?:lens-sync|\/edit|\/reassign|\/void|\/bulk-|\/comments?)(?:[\"'`/?]|$)/i.test(text);
      return !isBoundReadOnlyBridgeClient;
    }),
    "Mutating HTTP verbs are permitted only for the isolated loopback command bridge",
  );
  record(
    "web.identity.blocked-states",
    nativeCsText.includes("identity_not_found") &&
      nativeCsText.includes("identity_ambiguous") &&
      /body\s+&&\s+typeof body === [\"']object[\"']\s+&&\s+[\"']message[\"'] in body/.test(webText) &&
      /error instanceof Error \? error\.message/.test(webText),
    "Native emits exact blocked codes and the web client/UI preserves the structured server message",
  );
  record(
    "web.no-fallback-contract",
    !/(?:labelFallback|folderFallback|treePositionFallback|activeViewFallback)\s*[:=]\s*true/i.test(
      webText,
    ),
    "No forbidden resolver fallback may be enabled",
  );
  record(
    "web.saved-viewpoint-mutation.absent",
    !/(?:create|add|remove|delete|move|rename|update)[A-Za-z]*SavedViewpoint/i.test(
      webText,
    ),
    "No SavedViewpoint mutation command may appear in web source",
  );
  record(
    "web.read-only-issue-details",
    !/(?:onStatusChange|onCommentSubmit|onAssignmentChange|saveIssue|updateIssue)/.test(webText),
    "Issue details must expose no workflow write handler",
  );
  record(
    "web.idempotency-key-equals-request-id",
    /requestId:\s*exactRequestId/.test(webText) &&
      /idempotencyKey:\s*exactRequestId/.test(webText),
    "The web request builder derives requestId and idempotencyKey from one exact value",
  );
  record(
    "web.active-session-context-bound",
    /fields:\s*Object\.freeze\(\{\s*sessionId,/.test(webText) &&
      /contextProjectId\s*!==\s*exactIdentity\.projectId/.test(webText) &&
      webText.includes("modelFingerprint"),
    "The web request binds active session, project, and model context",
  );
  record(
    "web.strict-positive-identifiers-and-revision",
    /projectId:\s*positiveInteger/.test(webText) &&
      /serverId:\s*positiveInteger/.test(webText) &&
      /revisionNumber:\s*positiveInteger/.test(webText) &&
      webText.includes("LENS_NEXT_LIFECYCLE_STATES"),
    "Web input rejects non-positive IDs/revision and unsupported lifecycle values",
  );
  record(
    "web.bridge-token-memory-only",
    webText.includes("let currentSession") &&
      webText.includes("MAX_SESSION_TTL_MS") &&
      !/(?:localStorage|sessionStorage|indexedDB|document\.cookie|URLSearchParams)/.test(
        webText,
      ),
    "Feature-local bridge token is bounded and memory-only",
  );
  record(
    "web.lucide-icons",
    /import\s*\{\s*ImageOff\s*,\s*X\s*\}\s*from\s*[\"']lucide-react[\"']/.test(
      webText,
    ) &&
      /<ImageOff\b/.test(webText) &&
      /<X\b/.test(webText),
    "UI controls and empty-thumbnail state use Lucide icons",
  );
}

record(
  "web.protected-route",
  appFiles.length === 1 &&
    /<Route\s+path=[\"']\/lens-next[\"']>\s*\{\(\)\s*=>\s*<ProtectedRoute\s+component=\{LensNextWorkspace\}\s*\/>\}\s*<\/Route>/s.test(
      appText,
    ),
  "Exactly one /lens-next route must be wrapped by the existing ProtectedRoute",
);
record(
  "web.executable-ssr-view-harness",
  phase1WebScriptFiles.length === 2 &&
    /import\s*\{\s*renderToStaticMarkup\s*\}\s*from\s*[\"']react-dom\/server[\"']/.test(
      webScriptText,
    ) &&
    /renderToStaticMarkup\(<LensNextPanelView/.test(webScriptText) &&
    webScriptText.includes("reactRenders: 6") &&
    webScriptText.includes("protectedRouteCount: 1"),
  "Executable SSR harness renders the production view and verifies its protected route",
);

record(
  "cross-lane.bridge.origin-agreement",
  webFiles.length > 0 &&
    nativeFiles.length > 0 &&
    webText.includes(EXPECTED.bridgeOrigin) &&
    nativeText.includes(EXPECTED.bridgeOrigin),
  EXPECTED.bridgeOrigin,
);
record(
  "cross-lane.bridge.protocol-agreement",
  webFiles.length > 0 &&
    /(?:protocolVersion|BRIDGE_PROTOCOL_VERSION)[^\n=:{]*[:=]\s*1\b/.test(webText) &&
    /BridgeProtocolVersion\s*=\s*1\s*;/.test(nativeCsText),
  EXPECTED.bridgeProtocolVersion,
);
record(
  "cross-lane.command-agreement",
  webFiles.length > 0 &&
    nativeFiles.length > 0 &&
    [...webText.matchAll(/command\s*:\s*[\"']([^\"']+)[\"']/g)]
      .map((match) => match[1])
      .every((command) => READ_ONLY_COMMANDS.includes(command)) &&
    READ_ONLY_COMMANDS.every((command) => nativeBridgeContractsText.includes(`\"${command}\"`)),
  {
    webInvokedSubset: [...webText.matchAll(/command\s*:\s*[\"']([^\"']+)[\"']/g)].map(
      (match) => match[1],
    ),
    nativeAllowlist: READ_ONLY_COMMANDS,
  },
);

const failed = results.filter(({ passed }) => !passed);
const readinessFailures = failed.filter(({ kind }) => kind === "readiness");
const status =
  failed.length === 0
    ? "PASS"
    : readinessFailures.length > 0
      ? "BLOCKED_SOURCE_INCOMPLETE"
      : "FAIL_CLOSED";

const receipt = {
  schemaVersion: "bimlog-lens-next-phase1-cross-lane-verification-v1",
  generatedAtUtc: new Date().toISOString(),
  status,
  worktree: root,
  harness: {
    path: TEST_RELATIVE_PATH,
    sha256: sha256(readBytes(root, TEST_RELATIVE_PATH)),
  },
  contracts: {
    identity: {
      path: IDENTITY_RELATIVE_PATH,
      sha256: sha256(identityBytes),
    },
    acceptance: {
      path: ACCEPTANCE_RELATIVE_PATH,
      sha256: sha256(acceptanceBytes),
    },
  },
  implementationInputs: {
    app: fileHashes(appFiles)[0] ?? null,
    webRoot: WEB_RELATIVE_ROOT,
    webScriptRoot: WEB_SCRIPT_RELATIVE_ROOT,
    nativeRoot: NATIVE_RELATIVE_ROOT,
    webFiles: fileHashes(webFiles),
    webScriptFiles: fileHashes(webScriptFiles),
    nativeFiles: fileHashes(nativeFiles),
  },
  totals: {
    assertions: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
  },
  failedAssertionIds: failed.map(({ id }) => id),
  results,
  safety: {
    productFilesWritten: false,
    legacyFilesWritten: false,
    databaseAction: false,
    networkAction: false,
    installAction: false,
    gitAction: false,
  },
};

const receiptArgumentIndex = process.argv.indexOf("--receipt");
if (receiptArgumentIndex >= 0) {
  const requested = process.argv[receiptArgumentIndex + 1];
  if (!requested) throw new Error("--receipt requires a relative path.");
  const normalized = toPosix(requested).replace(/^\.\//, "");
  if (
    !normalized.startsWith(`${RECEIPT_RELATIVE_ROOT}/`) ||
    !normalized.endsWith(".json") ||
    normalized.includes("..")
  ) {
    throw new Error(`Receipt path must be a JSON file below ${RECEIPT_RELATIVE_ROOT}.`);
  }
  const receiptPath = path.join(root, normalized);
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
}

process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
process.exitCode = failed.length === 0 ? 0 : 1;
