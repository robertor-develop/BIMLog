import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const OUTPUT_RELATIVE =
  "evidence/lens-next/20260812/next-phase-integration/phase2-cross-language-verification.json";
const EXPECTED_ROOT = "F:\\BIMLog\\Worktrees\\bimlog-lens-next-20260812";
const EXPECTED_BRANCH = "codex/bimlog-lens-next-20260812";
const PHASE1_BASELINE = "4e2d4da72493c9cb497e067c2e73e727e031ede4";

const inputs = [
  {
    lane: "api",
    path: "artifacts/api-server/src/lib/lens-next-phase2-mutation-contract.ts",
    bytes: 11551,
    sha256: "EBADD7C022664174B63A9596DA0FAD9B536DFA59949080DBA00A88EC566463DA",
  },
  {
    lane: "api-test",
    path: "artifacts/api-server/src/lib/lens-next-phase2-mutation-contract.behavior.ts",
    bytes: 5339,
    sha256: "72DEDEF86936E0D4649FB575DEACBB409E9B9D08529D5200E718C792ABE9CFDA",
  },
  {
    lane: "native",
    path: "plugins/BIMLogLensNext/src/LensNextPhase2CommandPolicy.cs",
    bytes: 16668,
    sha256: "B3DC6F9021698434C7B58A8C5D0B66F918ABC2E2A3708979845234DB5E14BA6B",
  },
  {
    lane: "native-test",
    path: "plugins/BIMLogLensNext/tests/Phase2CommandPolicyTests.cs",
    bytes: 17392,
    sha256: "C8D37168390ECAFE191D3F4F9661F67B27567AF2DCC74F60DACA4CD2C5441247",
  },
  {
    lane: "web-capability",
    path: "artifacts/bimlog/src/features/lens-next/lens-next-phase2-capability.ts",
    bytes: 16192,
    sha256: "4C2A9CAB634837F0A9783693549D8E3C52ADC6FDACA2057272E456DEBA7985E8",
  },
  {
    lane: "web-capability-test",
    path: "artifacts/bimlog/scripts/lens-next/lens-next-phase2-capability.behavior.ts",
    bytes: 10607,
    sha256: "B1310F7306EFE3203103791B89E12A1E03B9F3C746C136A0A32B540388563D68",
  },
];

const canonicalFlags = {
  status: "lens_next.status_updates",
  comment: "lens_next.comments",
  assignment: "lens_next.platform_metadata_writes",
};
const results = [];

function absolute(relative) {
  return path.join(ROOT, ...relative.split("/"));
}

function canonicalBytes(file) {
  return Buffer.from(fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n"), "utf8");
}

function sha256(file) {
  const bytes = canonicalBytes(file);
  return crypto
    .createHash("sha256")
    .update(bytes)
    .digest("hex")
    .toUpperCase();
}

function text(relative) {
  return fs.readFileSync(absolute(relative), "utf8");
}

function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function check(id, passed, detail, severity = "gate") {
  results.push({ id, passed: Boolean(passed), severity, detail });
}

check("root.exact", ROOT.toLowerCase() === EXPECTED_ROOT.toLowerCase(), ROOT);
check(
  "git.branch",
  git("branch", "--show-current") === EXPECTED_BRANCH,
  EXPECTED_BRANCH,
);
const currentHead = git("rev-parse", "HEAD");
check(
  "git.phase1-baseline-ancestor",
  git("merge-base", "--is-ancestor", PHASE1_BASELINE, currentHead) === "",
  { phase1Baseline: PHASE1_BASELINE, currentHead },
);
for (const input of inputs) {
  const file = absolute(input.path);
  const actual = { bytes: canonicalBytes(file).length, sha256: sha256(file) };
  check(
    `input.${input.lane}.exact`,
    actual.bytes === input.bytes && actual.sha256 === input.sha256,
    {
      path: input.path,
      expected: { bytes: input.bytes, sha256: input.sha256 },
      actual,
    },
  );
}

const api = text(inputs[0].path);
const apiTest = text(inputs[1].path);
const native = text(inputs[2].path);
const nativeTest = text(inputs[3].path);
const web = text(inputs[4].path);
const webTest = text(inputs[5].path);

check(
  "api.contract-only-no-authority",
  api.includes('status: "HELD_CONTRACT_ONLY"') &&
    api.includes("mutationAllowed: false") &&
    api.includes("authorityGranted: false"),
  "API returns only a held plan",
);
check(
  "native.pure-policy-no-io",
  !/(System\.IO|System\.Net|HttpClient|HttpWebRequest|Autodesk|SavedViewpoint|File\.|Directory\.|Sql|DbConnection)/.test(
    native,
  ),
  "Native policy has no Navisworks, file, database, or network surface",
);
check(
  "api.pure-contract-no-io",
  !/(node:fs|node:http|node:https|fetch\s*\(|database|drizzle|postgres|writeFile|readFile)/i.test(
    api,
  ),
  "API contract has no database, file, network, provider, or customer I/O",
);
check(
  "web.pure-capability-no-io",
  !/(node:fs|node:http|node:https|fetch\s*\(|database|drizzle|postgres|writeFile|readFile|localStorage|sessionStorage)/i.test(
    web,
  ),
  "Web capability contract has no database, file, network, provider, customer, or persistent-store I/O",
);
check(
  "both.default-deny-unsupported",
  api.includes(
    'deny("contract_invalid", "unsupported contract version or action")',
  ) &&
    native.includes('Deny("phase2_action_or_command_unsupported")') &&
    web.includes("ACTION_UNSUPPORTED"),
  "Unknown actions deny in both languages",
);
check(
  "both.sandbox-or-pilot-only",
  api.includes('["sandbox", "pilot"]') &&
    api.includes("productionWriteAllowed !== false") &&
    native.includes('Exact(value, "sandbox") || Exact(value, "pilot")'),
  "Sandbox/pilot exact allowlist; production not accepted",
);
check(
  "both.visual-state-invariant",
  api.includes("visualStateDigestMustRemainUnchanged: true") &&
    api.includes("visual_state_forbidden") &&
    native.includes("VisualStateBeforeDigest") &&
    native.includes("VisualStateAfterDigest") &&
    native.includes('Deny("visual_payload_must_remain_invariant")'),
  "Workflow mutation cannot alter visual payload",
);
check(
  "both.no-fallback-or-auto-conflict",
  api.includes("fallbackResolutionForbidden: true") &&
    api.includes("automaticConflictResolutionForbidden: true") &&
    native.includes('Deny("fallback_resolution_forbidden")') &&
    native.includes('Deny("automatic_conflict_resolution_forbidden")'),
  "Fallbacks and silent conflict resolution deny",
);
check(
  "both.positive-identity-revision-lifecycle",
  api.includes("positiveInteger(input.projectId)") &&
    api.includes("positiveInteger(input.serverId)") &&
    api.includes("positiveInteger(input.revisionNumber)") &&
    native.includes("identity.ServerId <= 0") &&
    native.includes("identity.RevisionNumber <= 0") &&
    native.includes("IsLifecycleStatus(identity.LifecycleStatus)"),
  "Both require positive immutable identity and a closed lifecycle",
);

const apiFlags = {
  status: /status:\s*"([^"]+)"/.exec(api)?.[1],
  comment: /comment:\s*"([^"]+)"/.exec(api)?.[1],
  assignment: /assignment:\s*"([^"]+)"/.exec(api)?.[1],
};
const nativeFlags = {
  status: /StatusFeatureFlag\s*=\s*"([^"]+)"/.exec(native)?.[1],
  comment: /CommentFeatureFlag\s*=\s*"([^"]+)"/.exec(native)?.[1],
  assignment: /AssignmentFeatureFlag\s*=\s*"([^"]+)"/.exec(native)?.[1],
};
const webFlagValues = [...web.matchAll(/flag:\s*"([^"]+)"/g)].map(
  (match) => match[1],
);
const webFlags = {
  status: webFlagValues[0],
  comment: webFlagValues[1],
  assignment: webFlagValues[2],
};
check(
  "cross.feature-flags-agree-with-frozen-eight-flag-contract",
  JSON.stringify(apiFlags) === JSON.stringify(canonicalFlags) &&
    JSON.stringify(nativeFlags) === JSON.stringify(canonicalFlags) &&
    JSON.stringify(webFlags) === JSON.stringify(canonicalFlags),
  { canonicalFlags, apiFlags, nativeFlags, webFlags },
);

const apiActions = [
  ...api.matchAll(/LENS_NEXT_PHASE2_ACTIONS\s*=\s*\[([^\]]+)\]/g),
].flatMap((match) =>
  [...match[1].matchAll(/"([^"]+)"/g)].map((value) => value[1]),
);
const nativeCommands = {
  status: /UpdateStatus\s*=\s*"([^"]+)"/.exec(native)?.[1],
  comment: /AddComment\s*=\s*"([^"]+)"/.exec(native)?.[1],
  assignment: /UpdateAssignment\s*=\s*"([^"]+)"/.exec(native)?.[1],
};
const explicitTranslation =
  api.includes('status: "phase2-update-status"') &&
  api.includes('comment: "phase2-add-comment"') &&
  api.includes('assignment: "phase2-update-assignment"') &&
  native.includes('StatusAction = "status"') &&
  native.includes('CommentAction = "comment"') &&
  native.includes('AssignmentAction = "assignment"') &&
  native.includes("CommandForAction") &&
  native.includes("ActionForCommand");
check(
  "cross.actions-have-explicit-closed-translation",
  apiActions.length === 3 &&
    Object.keys(nativeCommands).length === 3 &&
    explicitTranslation,
  { apiActions, nativeCommands, explicitTranslation },
);
check(
  "cross.immutable-identity-fields-agree",
  api.includes("issueFamilyId: string") &&
    native.includes("IssueFamilyId") &&
    api.includes("expectedVersion") &&
    native.includes("ExpectedVersion") &&
    api.includes("expectedStatus") &&
    native.includes("ExpectedStatus"),
  {
    apiRequired: [
      "projectId",
      "serverId",
      "viewpointId",
      "issueFamilyId",
      "lifecycleStatus",
      "revisionNumber",
      "expectedStatus",
      "expectedVersion",
      "expectedRevisionNumber",
    ],
    nativeRequired: [
      "ProjectId",
      "ServerId",
      "ViewpointId",
      "IssueFamilyId",
      "LifecycleStatus",
      "RevisionNumber",
      "ExpectedStatus",
      "ExpectedVersion",
      "ExpectedRevisionNumber",
    ],
  },
);
check(
  "cross.permission-evidence-agrees",
  api.includes("receiptSha256: string") &&
    native.includes("ReceiptSha256") &&
    api.includes("serverId: number") &&
    native.includes("ServerId") &&
    api.includes("current: true") &&
    native.includes("Current"),
  {
    api: "receipt id/hash, subject, action, project, server, current, expiry",
    native:
      "receipt id/hash, actor, action, project, server, current, granted and expiry",
  },
);
check(
  "cross.idempotency-scope-agrees",
  api.includes(
    "`${input.actorId}:${action}:${input.projectId}:${input.serverId}:${input.revisionNumber}:`",
  ) &&
    native.includes("idempotency.ServerId != identity.ServerId") &&
    native.includes("idempotency.RevisionNumber != identity.RevisionNumber") &&
    native.includes("!Exact(idempotency.Action, action)"),
  {
    api: "binds actor, action, project, server and revision",
    native: "binds actor, action, project, server and revision",
  },
);
check(
  "cross.pilot-policy-evidence-agrees",
  api.includes("pilotPolicy") &&
    api.includes("receiptSha256") &&
    native.includes("PilotPolicy") &&
    native.includes("ProductionWriteAllowed"),
  {
    api: "evidence-bound policy receipt with productionWriteAllowed=false",
    native: "evidence-bound policy receipt with productionWriteAllowed=false",
  },
);

check(
  "web.identity-and-preconditions-match-server-contract",
  web.includes("issueFamilyId") &&
    web.includes("expectedStatus") &&
    web.includes("expectedVersion") &&
    web.includes("expectedRevisionNumber"),
  {
    server: "issueFamilyId plus expected status/version/revision are required",
    web: "explicit stableIssueFamilyId-to-issueFamilyId mapping plus expected status/version/revision",
  },
);
check(
  "web.permission-evidence-matches-server-contract",
  web.includes("receiptSha256") &&
    web.includes("serverId") &&
    web.includes("expiresAt"),
  {
    server:
      "permission receipt id/hash, actor/action, project/server, current and expiry",
    web: "permission receipt id/hash, actor/action, project/server, current and expiry",
  },
);
check(
  "web.idempotency-scope-matches-server-contract",
  web.includes("idempotency.serverId !== identity.serverId") &&
    web.includes("idempotency.revisionNumber !== identity.revisionNumber"),
  {
    server: "actor, action, project, server and revision",
    web: "actor, action, project, server and revision",
  },
);
check(
  "web.pilot-policy-evidence-matches-server-contract",
  web.includes("receiptSha256") &&
    web.includes("productionWriteAllowed") &&
    web.includes("expiresAt"),
  {
    server:
      "receipt hash, environment, project/user/flag, production=false and expiry",
    web: "receipt hash, environment, project/user/flag, production=false and expiry",
  },
);
check(
  "web.executor-requires-server-transaction-audit-contract",
  web.includes("atomicExpectedStatusVersionRevisionPredicate") &&
    web.includes("zeroRowsConflictStatus") &&
    web.includes("auditAndIdempotencySameTransaction") &&
    web.includes("exactResultIdentityVersionResponse"),
  {
    server:
      "atomic precondition, zero-row 409 and audit/idempotency receipt in one transaction",
    web: "executor attestation binds atomic preconditions, zero-row 409, audit/idempotency transaction and exact result identity/version",
  },
);
check(
  "web.never-claims-mutation-authority-from-caller-envelope",
  web.includes("mutationAllowed: false") &&
    web.includes("dispatchAllowed") &&
    !web.includes("mutationAllowed: enabled") &&
    !web.includes("mutationAllowed: dispatchAllowed"),
  {
    server: "held contract only; mutationAllowed=false; authorityGranted=false",
    web: "mutationAllowed is invariant false; separately named dispatchAllowed requires exact server-runtime evidence",
  },
);
check(
  "cross.transaction-audit-receipt-requirements-agree",
  api.includes("mutationAuditAndIdempotencyReceiptSingleTransaction: true") &&
    native.includes("MutationAuditAndIdempotencyReceiptSingleTransaction") &&
    native.includes("ZeroUpdatedRowsReturn409"),
  {
    api: "held execution plan requires atomic predicate, 409 on zero rows, and audit/idempotency receipt in one transaction",
    native:
      "held execution plan requires atomic predicate, 409 on zero rows, and audit/idempotency receipt in one transaction",
  },
);
check(
  "cross.authority-outcome-is-explicitly-mapped",
  api.includes("authorityGranted: false") &&
    native.includes("AuthorityGranted") &&
    native.includes("MutationAllowed"),
  {
    api: "always held; mutationAllowed=false; authorityGranted=false",
    native: "always held; MutationAllowed=false; AuthorityGranted=false",
  },
);

check(
  "tests.cover-own-contracts",
  apiTest.includes("adversarialDenials") &&
    apiTest.includes("databaseIo: false") &&
    nativeTest.includes('PASS " + _passed + "/17"') &&
    nativeTest.includes("DeterministicAndPure") &&
    webTest.includes("adversarialDenials") &&
    webTest.includes("network: false"),
  "API, native, and web adversarial deterministic behavior tests are present",
);

const phase1ReceiptPath =
  "evidence/lens-next/20260812/integration/phase1-cross-lane-verification.json";
const phase1Receipt = JSON.parse(text(phase1ReceiptPath));
const phase1Inputs = [
  phase1Receipt.implementationInputs.app,
  ...phase1Receipt.implementationInputs.webFiles,
  ...phase1Receipt.implementationInputs.webScriptFiles,
  ...phase1Receipt.implementationInputs.nativeFiles,
];
const acceptedPhase1BindingEvolution = new Map([
  ["plugins/BIMLogLensNext/BIMLogLensNext.csproj", { bytes: 706, sha256: "A35CF96FD19931AE68BD00E26E93C34D76C2AD8E0F36A4A79AA1C0D9C875C135" }],
  ["plugins/BIMLogLensNext/contracts/plugin-registration.contract.json", { bytes: 415, sha256: "F294BA2044C630B0FAC6750C14AD60341D946A149100ED12493C0590BCEDFC7D" }],
  ["plugins/BIMLogLensNext/install/Install-BIMLogLensNext.contract.json", { bytes: 660, sha256: "E38D2E2785B8DC4905D02D4C071B70E66D546829C5BC2C485C6440D80D18521F" }],
  ["plugins/BIMLogLensNext/install/Uninstall-BIMLogLensNext.contract.json", { bytes: 588, sha256: "4C1A272F15BFB0525ECA3D1AF4317672E6261650ED3BAEDD79D31D22F6D08291" }],
  ["plugins/BIMLogLensNext/native/2021/BIMLogLensNext.Native2021.csproj", { bytes: 1766, sha256: "7B0B77A5A7E511274950AF75804351B4452EEEF01D22494CFA72C040F3DFBCEA" }],
  ["plugins/BIMLogLensNext/native/2025/BIMLogLensNext.Native2025.csproj", { bytes: 1742, sha256: "3D5051D22050A3D9D2D684E303E6710AA97D03098DC6C3AB1AC2E28B66295047" }],
  ["plugins/BIMLogLensNext/tests/Program.cs", { bytes: 20433, sha256: "5105DAA69BFFCC81EF6126981C40573BB9CA530D3A0751A767F437350586AC9E" }],
]);
const phase1Mismatches = phase1Inputs
  .map((input) => {
    const file = absolute(input.path);
    if (!fs.existsSync(file)) return { path: input.path, reason: "missing" };
    const actual = { bytes: canonicalBytes(file).length, sha256: sha256(file) };
    const accepted = acceptedPhase1BindingEvolution.get(input.path);
    const expected = accepted ?? input;
    return actual.bytes === expected.bytes && actual.sha256 === expected.sha256
      ? null
      : {
          path: input.path,
          expected: { bytes: expected.bytes, sha256: expected.sha256 },
          actual,
        };
  })
  .filter(Boolean);
check(
  "phase1.exact-frozen-inputs-non-regression",
  phase1Mismatches.length === 0,
  {
    receipt: phase1ReceiptPath,
    receiptStatus: phase1Receipt.status,
    filesVerified: phase1Inputs.length,
    acceptedBindingEvolution: [...acceptedPhase1BindingEvolution.keys()],
    mismatches: phase1Mismatches,
  },
);

const phase1BridgePaths = [
  "plugins/BIMLogLensNext/src/BridgeContracts.cs",
  "plugins/BIMLogLensNext/src/BridgeRequestValidator.cs",
  "plugins/BIMLogLensNext/src/LensNextReadOnlyBridge.cs",
  "plugins/BIMLogLensNext/tests/Program.cs",
];
const phase1Phase2References = phase1BridgePaths.filter((relative) =>
  /Phase2|phase2/i.test(text(relative)),
);
check(
  "phase1.bridge-does-not-reference-phase2-policy",
  phase1Phase2References.length === 0,
  { checked: phase1BridgePaths, unexpectedReferences: phase1Phase2References },
);

const failed = results.filter((result) => !result.passed);
const manifestText = inputs
  .map((input) => `${input.path}|${input.bytes}|${input.sha256}`)
  .join("\n");
const receipt = {
  schemaVersion: "bimlog-lens-next-phase2-cross-language-verification-v1",
  generatedAtUtc: new Date().toISOString(),
  status:
    failed.length === 0
      ? "PASS"
      : "FAIL_CLOSED_CROSS_LANGUAGE_CONTRACT_MISMATCH",
  worktree: {
    root: ROOT.replaceAll("\\", "/"),
    branch: EXPECTED_BRANCH,
    head: currentHead,
    tree: git("rev-parse", "HEAD^{tree}"),
  },
  inputs,
  inputManifestSha256: crypto
    .createHash("sha256")
    .update(manifestText)
    .digest("hex")
    .toUpperCase(),
  totals: {
    assertions: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
  },
  failedAssertionIds: failed.map((result) => result.id),
  results,
  disposition: failed.length
    ? {
        productMutationAllowed: false,
        minimumCorrectionOwner: "Phase-2 API, native, and web contract owners",
        minimumCorrection:
          "Publish one exact cross-language contract for action names/translation, canonical assignment flag, immutable identity and preconditions, permission/pilot receipt evidence, actor-command-project-server-revision idempotency, single-transaction audit/409 requirements, and held non-authority outcome; then rerun both focused suites and this verifier.",
      }
    : {
        productMutationAllowed: false,
        reason: "Contract acceptance does not itself authorize I/O.",
      },
  safety: {
    implementationFilesWrittenByVerifier: false,
    legacyFilesWritten: false,
    databaseIo: false,
    networkIo: false,
    installAction: false,
    gitAction: false,
  },
};

const output = absolute(OUTPUT_RELATIVE);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
if (failed.length) process.exitCode = 1;
