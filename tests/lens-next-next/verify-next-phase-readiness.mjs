import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const EXPECTED_ROOT = "F:\\BIMLog\\Worktrees\\bimlog-lens-next-20260812";
const EXPECTED_BRANCH = "codex/bimlog-lens-next-20260812";
const EXPECTED_HEAD = "4e2d4da72493c9cb497e067c2e73e727e031ede4";
const EXPECTED_TREE = "f6a5b9733ba0163422e90c1302b27f49894b6cd0";
const RECEIPT_RELATIVE =
  "evidence/lens-next/20260812/next-phase-integration/next-phase-readiness-inventory.json";
const LANE1_RELATIVE =
  "evidence/lens-next/20260812/native-reference-discovery/native-reference-discovery-receipt.json";
const EXPECTED_LANE1_BYTES = 10226;
const EXPECTED_LANE1_SHA256 =
  "642B28B89B8AC79F34DA12E5A6AD832C050FABA96451461560C545807C7B55BA";
const LEGACY_REFERENCE_ROOT =
  "F:\\BIMLog\\Repositories\\BIMLogPlugin2025-emergency-1.60.21";
const DISPOSAL_LEDGER =
  "F:\\BIMLog\\Repositories\\bimlog-coordination\\audit\\lane-a-filesystem\\checkpointed-20260801\\duplicate-disposal-ledger.csv";
const HASH_CHECKPOINT =
  "F:\\BIMLog\\Repositories\\bimlog-coordination\\audit\\lane-a-filesystem\\checkpointed-20260801\\safe-hash-checkpoint-20260801.csv";

const expectedHashes = new Map([
  [
    "evidence/lens-next/20260812/identity-isolation-contract.json",
    "E22E953EFF210FF189D635BF34A16D6E9954E5B51F234728179DDD8A2F45A317",
  ],
  [
    "evidence/lens-next/20260812/phase1-readonly-acceptance-contract.json",
    "83154183F6E0E7B81BB897D2E687562C8116A047FC9F4DBB5BB8FF8BE40626E5",
  ],
  [
    "evidence/lens-next/20260812/integration/phase1-integration-terminal-receipt.json",
    "B40F5B055BBE8A949DC32E15962C902BB0EDC71B6E062040113A72FF81C62EBB",
  ],
]);

const exactWriteFlags = [
  "lens_next.platform_metadata_writes",
  "lens_next.status_updates",
  "lens_next.comments",
  "lens_next.camera_capture",
  "lens_next.visual_state_updates",
  "lens_next.viewpoint_publishing",
  "lens_next.project_migration",
  "lens_next.duplicate_recovery",
];
const exactReadCommands = [
  "ping",
  "capabilities",
  "project-context",
  "open-working-view",
];
const forbiddenFallbacks = [
  "label",
  "displayName",
  "displayId",
  "folderPath",
  "treePosition",
  "activeView",
  "firstMatch",
  "bestGuess",
];
const exactContractForbiddenResolvers = [
  "label",
  "display name",
  "displayId alone",
  "folder path",
  "tree position",
  "current active viewpoint",
  "first match",
  "best guess",
];

function normalize(relative) {
  return relative.replaceAll("\\", "/");
}

function absolute(relative) {
  return path.join(ROOT, ...normalize(relative).split("/"));
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function text(relative) {
  return fs.readFileSync(absolute(relative), "utf8");
}

function json(relative) {
  return JSON.parse(text(relative));
}

const results = [];
function assert(id, passed, detail) {
  results.push({ id, passed: Boolean(passed), detail });
}

const rootNormalized = ROOT.toLowerCase();
assert("root.exact-f-root", rootNormalized === EXPECTED_ROOT.toLowerCase(), ROOT);
assert("git.branch", git("branch", "--show-current") === EXPECTED_BRANCH, EXPECTED_BRANCH);
assert("git.head", git("rev-parse", "HEAD") === EXPECTED_HEAD, EXPECTED_HEAD);
assert("git.tree", git("rev-parse", "HEAD^{tree}") === EXPECTED_TREE, EXPECTED_TREE);

for (const [relative, expected] of expectedHashes) {
  const actual = sha256(absolute(relative));
  assert(`frozen.${normalize(relative)}`, actual === expected, { actual, expected });
}

const identity = json("evidence/lens-next/20260812/identity-isolation-contract.json");
const phase1 = json("evidence/lens-next/20260812/phase1-readonly-acceptance-contract.json");
const phase1Terminal = json(
  "evidence/lens-next/20260812/integration/phase1-integration-terminal-receipt.json",
);
assert(
  "contract.structured-sections-only",
  phase1.authority?.requirementsScope === "STRUCTURED_SECTIONS_1_THROUGH_16_ONLY" &&
    phase1.authority?.trailingWhatsAppIgnoredAsAuthority === true,
  phase1.authority,
);
assert(
  "contract.phase1-terminal-pass",
  phase1Terminal.status === "PASS_PHASE1_INTEGRATION_READY_LOCAL_NO_RELEASE_ACTION",
  phase1Terminal.status,
);
assert(
  "contract.legacy-isolation",
  identity.legacy?.policy === "untouched_and_available_side_by_side" &&
    identity.nextIsolation?.assembly === "BIMLogLensNext" &&
    identity.nextIsolation?.dockPluginId === "BIMLogLensNext.IgniteSmart" &&
    identity.nextIsolation?.bridgeDefault === "http://127.0.0.1:8766",
  identity.nextIsolation,
);
assert(
  "contract.write-flags-exact-default-off",
  JSON.stringify(identity.featureFlags?.separateFlags) === JSON.stringify(exactWriteFlags) &&
    identity.featureFlags?.productionDefault === "read_only" &&
    identity.featureFlags?.writesRequireSandboxOrPilot === true,
  identity.featureFlags,
);
assert(
  "contract.bridge-read-commands-exact",
  JSON.stringify(identity.bridge?.phase1Commands) === JSON.stringify(exactReadCommands),
  identity.bridge?.phase1Commands,
);
assert(
  "contract.no-status-to-visual-coupling",
  identity.visualWorkflowSeparation?.rule ===
    "workflow metadata changes must never alter visual state",
  identity.visualWorkflowSeparation?.rule,
);
assert(
  "contract.no-fallback-or-auto-conflict-resolution",
  JSON.stringify(identity.identityModel?.forbiddenResolvers) ===
    JSON.stringify(exactContractForbiddenResolvers),
  identity.identityModel?.forbiddenResolvers,
);
assert(
  "contract.no-install-open-migration",
  identity.migration?.automaticOnInstallOrOpen === false &&
    identity.featureFlags?.installOrOpenMayEnableMigration === false,
  identity.migration,
);

const featureFlagSource = text("plugins/BIMLogLensNext/src/LensNextFeatureFlags.cs");
const constantSource = text("plugins/BIMLogLensNext/src/LensNextConstants.cs");
const bridgeContractSource = text("plugins/BIMLogLensNext/src/BridgeContracts.cs");
const bridgeValidatorSource = text("plugins/BIMLogLensNext/src/BridgeRequestValidator.cs");
const bridgeRuntimeSource = text("plugins/BIMLogLensNext/src/LensNextReadOnlyBridge.cs");
const webModelSource = text("artifacts/bimlog/src/features/lens-next/lens-next-model.ts");
const inspectedSource = [
  featureFlagSource,
  constantSource,
  bridgeContractSource,
  bridgeValidatorSource,
  bridgeRuntimeSource,
  webModelSource,
].join("\n");
assert(
  "source.write-flags-default-off",
  exactWriteFlags.every((flag) => constantSource.includes(`"${flag}"`)) &&
    featureFlagSource.includes("name => false") &&
    featureFlagSource.includes("AnyWriteEnabled"),
  exactWriteFlags,
);
assert(
  "source.bridge-remains-read-only",
  exactReadCommands.every((command) => bridgeContractSource.includes(`"${command}"`)) &&
    bridgeContractSource.includes("WritesEnabled = false") &&
    bridgeContractSource.includes("SavedViewpointMutationEnabled = false"),
  exactReadCommands,
);
assert(
  "source.exact-identity-and-idempotency",
  bridgeValidatorSource.includes("idempotency_key_mismatch") &&
    bridgeRuntimeSource.includes("session_context_mismatch") &&
    webModelSource.includes("idempotencyKey: exactRequestId") &&
    webModelSource.includes("contextProjectId !== exactIdentity.projectId"),
  "requestId/idempotency/session/project bindings present",
);
assert(
  "source.forbidden-fallbacks-rejected",
  forbiddenFallbacks.every((name) => bridgeValidatorSource.includes(`"${name}"`)),
  forbiddenFallbacks,
);
assert(
  "source.no-saved-viewpoint-mutation-api",
  !/(CreateUniqueCopy|SavedViewpoints\.(Add|Remove|EditDisplayName)|AddCopy|RemoveAt)/.test(
    inspectedSource,
  ),
  "No native SavedViewpoint mutation API in frozen Lens Next source",
);

const implementationRoots = [
  "artifacts/bimlog/src/features/lens-next",
  "artifacts/bimlog/scripts/lens-next",
  "plugins/BIMLogLensNext",
];
const implementationDiff = git("diff", "--name-only", "HEAD", "--", ...implementationRoots)
  .split(/\r?\n/)
  .filter(Boolean)
  .map(normalize);
assert(
  "lane2.no-unaccepted-implementation-writes",
  implementationDiff.length === 0,
  implementationDiff,
);

const lane1Path = absolute(LANE1_RELATIVE);
let lane1 = null;
if (fs.existsSync(lane1Path)) {
  lane1 = {
    path: LANE1_RELATIVE,
    bytes: fs.statSync(lane1Path).size,
    sha256: sha256(lane1Path),
    body: JSON.parse(fs.readFileSync(lane1Path, "utf8")),
  };
  assert(
    "lane1.receipt-exact-bytes",
    lane1.bytes === EXPECTED_LANE1_BYTES && lane1.sha256 === EXPECTED_LANE1_SHA256,
    { bytes: lane1.bytes, sha256: lane1.sha256 },
  );
  assert(
    "lane1.blocked-disposition",
    lane1.body?.status === "BLOCKED_AUTHORITATIVE_F_ROOT_REFERENCES_ABSENT" &&
      lane1.body?.mode === "READ_ONLY_DISCOVERY_WITH_EVIDENCE_ONLY_RECEIPT",
    { status: lane1.body?.status, mode: lane1.body?.mode },
  );
  assert(
    "lane1.authority-bound-read-only",
    lane1.body?.authority?.constitutionVersion === "3.0.0" &&
      lane1.body?.authority?.fRootOnly === true &&
      lane1.body?.authority?.legacyInferenceAllowed === false &&
      lane1.body?.authority?.cRootInspectionPerformed === false &&
      lane1.body?.authority?.externalActionPerformed === false,
    lane1.body?.authority,
  );
  assert(
    "lane1.worktree-and-plugin-unchanged",
    lane1.body?.worktree?.root === EXPECTED_ROOT &&
      lane1.body?.worktree?.branch === EXPECTED_BRANCH &&
      lane1.body?.worktree?.startingCommit === EXPECTED_HEAD &&
      lane1.body?.worktree?.startingTree === EXPECTED_TREE &&
      lane1.body?.worktree?.pluginTreeEditedByThisLane === false &&
      implementationDiff.length === 0,
    lane1.body?.worktree,
  );
  assert(
    "lane1.dual-version-requirement-unbound",
    JSON.stringify(lane1.body?.intendedProductSupport?.versionsNamedByAcceptedFRootEvidence) ===
      JSON.stringify(["Navisworks 2021", "Navisworks 2025"]) &&
      lane1.body?.intendedProductSupport?.singleVersionSelectionAuthorized === false &&
      lane1.body?.intendedProductSupport?.exactReferenceSetBound === false,
    lane1.body?.intendedProductSupport,
  );
  const candidateSets = lane1.body?.discoveredCandidateBinaries?.sets ?? [];
  const exactCandidates = [
    ["Autodesk.Navisworks.Api", 4243232, "D6426063E03A97C34BA805F20C1D1ADD35BCC5C63EFEA87F8AF40F49E82BF155"],
    ["Autodesk.Navisworks.Automation", 184096, "476F7E78D5566A1071AB43E3C23B523585A6B8E1F85F3C9F1E8D4DF861DC8729"],
    ["Autodesk.Navisworks.Clash", 502048, "D272A4510C4FDA3E3E90A72E3C0C392CB687170C052C8698296E59BB0FFFC90A"],
  ];
  assert(
    "lane1.discovered-dll-inventory-exact",
    lane1.body?.search?.fRootNavisworksDllFileCount === 6 &&
      lane1.body?.search?.uniqueFRootNavisworksDllContentCount === 3 &&
      lane1.body?.discoveredCandidateBinaries?.physicalCopies === 6 &&
      exactCandidates.every(([assemblyName, bytes, hash]) => {
        const candidate = candidateSets.find((entry) => entry.assemblyName === assemblyName);
        return (
          candidate?.bytes === bytes &&
          candidate?.sha256 === hash &&
          candidate?.relativeLocations?.length === 2 &&
          candidate.relativeLocations.every((location) => location.startsWith(LEGACY_REFERENCE_ROOT)) &&
          candidate?.authoritativeProductYear === null
        );
      }),
    candidateSets,
  );
  const disposalText = fs.readFileSync(DISPOSAL_LEDGER, "utf8");
  const checkpointText = fs.readFileSync(HASH_CHECKPOINT, "utf8");
  assert(
    "lane1.legacy-candidates-quarantined-not-authority",
    exactCandidates.every(([assemblyName, bytes, hash]) => {
      const file = `${assemblyName}.dll`;
      return (
        disposalText.includes(file) &&
        disposalText.includes("QUARANTINED_INADMISSIBLE_FOR_DUPLICATE_DECISION") &&
        checkpointText.includes(file) &&
        checkpointText.toUpperCase().includes(hash) &&
        checkpointText.includes(`\"${bytes}\"`)
      );
    }),
    { disposalLedger: DISPOSAL_LEDGER, hashCheckpoint: HASH_CHECKPOINT },
  );
  assert(
    "lane1.adapter-remains-blocked",
    lane1.body?.decision?.adapterImplementationAllowed === false &&
      lane1.body?.decision?.pluginSourceChanged === false &&
      lane1.body?.decision?.reasonCodes?.includes("NO_ACCEPTED_F_ROOT_2021_REFERENCE_SET") &&
      lane1.body?.decision?.reasonCodes?.includes("NO_ACCEPTED_F_ROOT_2025_REFERENCE_SET") &&
      lane1.body?.decision?.reasonCodes?.includes("ONLY_DISCOVERED_DLLS_ARE_LEGACY_QUARANTINED") &&
      lane1.body?.decision?.safeContinuation ===
        "Keep the committed abstract read-only adapter boundary unchanged.",
    lane1.body?.decision,
  );
  assert(
    "lane1.evidence-only-mutation",
    JSON.stringify(lane1.body?.mutations?.productFilesChanged) === "[]" &&
      JSON.stringify(lane1.body?.mutations?.pluginFilesChanged) === "[]" &&
      JSON.stringify(lane1.body?.mutations?.gitActions) === "[]" &&
      JSON.stringify(lane1.body?.mutations?.installActions) === "[]" &&
      JSON.stringify(lane1.body?.mutations?.databaseActions) === "[]" &&
      JSON.stringify(lane1.body?.mutations?.externalActions) === "[]",
    lane1.body?.mutations,
  );
}

const failed = results.filter((result) => !result.passed);
const status = failed.length
  ? "FAIL_CLOSED"
  : lane1
    ? "PASS_READ_ONLY_LANE1_RECEIPT_AND_LANE2_NO_WRITE_BOUNDARY"
    : "WAITING_FOR_FROZEN_LANE1_REFERENCE_RECEIPT";
const receipt = {
  schemaVersion: "bimlog-lens-next-next-phase-readiness-v1",
  generatedAtUtc: new Date().toISOString(),
  status,
  worktree: {
    root: ROOT.replaceAll("\\", "/"),
    branch: EXPECTED_BRANCH,
    head: EXPECTED_HEAD,
    tree: EXPECTED_TREE,
  },
  frozenInputs: [...expectedHashes].map(([relative, sha256]) => ({
    path: relative,
    sha256,
  })),
  lane1ReferenceDiscovery: lane1
    ? { path: lane1.path, bytes: lane1.bytes, sha256: lane1.sha256, status: lane1.body.status }
    : { path: LANE1_RELATIVE, status: "PENDING_NOT_PRESENT" },
  lane2WorkflowDisposition: {
    status: "FAIL_CLOSED_NO_SAFE_DIRECT_WORKFLOW_WRITE_WITH_CURRENT_API_AUTHORITY",
    implementationPathsChangedSinceHead: implementationDiff,
    directWriteActivated: false,
    reason:
      "Current contracts and APIs do not yet establish a sandbox/pilot-authorized write target, stable issue-family write identity, or accepted separated workflow mutation contract.",
  },
  acceptanceBoundary: {
    legacyIsolationRequired: true,
    exactImmutableIdentityRequired: true,
    allWriteFlagsDefaultOff: true,
    writesSandboxOrPilotOnly: true,
    statusToVisualCouplingForbidden: true,
    labelPathTreeActiveViewFallbackForbidden: true,
    silentConflictResolutionForbidden: true,
    installExternalDatabaseActionPerformed: false,
  },
  totals: { assertions: results.length, passed: results.length - failed.length, failed: failed.length },
  failedAssertionIds: failed.map((result) => result.id),
  results,
  safety: {
    implementationFilesWrittenByVerifier: false,
    legacyFilesWritten: false,
    cRootWrite: false,
    installAction: false,
    databaseAction: false,
    networkOrExternalAction: false,
    gitAction: false,
  },
};

const receiptPath = absolute(RECEIPT_RELATIVE);
fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
if (failed.length) process.exitCode = 1;
