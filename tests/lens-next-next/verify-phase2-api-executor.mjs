import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const EXPECTED_ROOT = "F:\\BIMLog\\Worktrees\\bimlog-lens-next-20260812";
const EXPECTED_HEAD = "4e2d4da72493c9cb497e067c2e73e727e031ede4";
const OUTPUT = path.join(
  ROOT,
  "evidence",
  "lens-next",
  "20260812",
  "next-phase-integration",
  "phase2-api-executor-terminal-receipt.json",
);
const REPO_NODE_MODULES = "F:\\BIMLog\\Repositories\\bimlog\\node_modules";
const TSX = path.join(
  REPO_NODE_MODULES,
  ".pnpm",
  "tsx@4.21.0",
  "node_modules",
  "tsx",
  "dist",
  "cli.mjs",
);
const TSC = path.join(REPO_NODE_MODULES, "typescript", "bin", "tsc");
const PRETTIER = path.join(
  REPO_NODE_MODULES,
  "prettier",
  "bin",
  "prettier.cjs",
);
const NODE_TYPE_ROOT = path.join(
  REPO_NODE_MODULES,
  ".pnpm",
  "@types+node@20.19.37",
  "node_modules",
  "@types",
);

const inputs = [
  {
    role: "api-contract",
    path: "artifacts/api-server/src/lib/lens-next-phase2-mutation-contract.ts",
    bytes: 11551,
    sha256: "EBADD7C022664174B63A9596DA0FAD9B536DFA59949080DBA00A88EC566463DA",
  },
  {
    role: "api-contract-behavior",
    path: "artifacts/api-server/src/lib/lens-next-phase2-mutation-contract.behavior.ts",
    bytes: 5339,
    sha256: "72DEDEF86936E0D4649FB575DEACBB409E9B9D08529D5200E718C792ABE9CFDA",
  },
  {
    role: "api-executor",
    path: "artifacts/api-server/src/lib/lens-next-phase2-mutation-executor.ts",
    bytes: 7565,
    sha256: "6DAFB4126E0092BE0D0F7B789F7254AA246730F81A17399B71A804F5E20BACE0",
  },
  {
    role: "api-executor-behavior",
    path: "artifacts/api-server/src/lib/lens-next-phase2-mutation-executor.behavior.ts",
    bytes: 8519,
    sha256: "2CF4EC0AD025A3FE0866826368D576A709E63AF647043ACA60C332C322252DF1",
  },
  {
    role: "web-capability",
    path: "artifacts/bimlog/src/features/lens-next/lens-next-phase2-capability.ts",
    bytes: 16192,
    sha256: "4C2A9CAB634837F0A9783693549D8E3C52ADC6FDACA2057272E456DEBA7985E8",
  },
  {
    role: "web-capability-behavior",
    path: "artifacts/bimlog/scripts/lens-next/lens-next-phase2-capability.behavior.ts",
    bytes: 10607,
    sha256: "B1310F7306EFE3203103791B89E12A1E03B9F3C746C136A0A32B540388563D68",
  },
];

const results = [];

function absolute(relative) {
  return path.join(ROOT, ...relative.split("/"));
}

function source(relative) {
  return fs.readFileSync(absolute(relative), "utf8");
}

function sha256(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex")
    .toUpperCase();
}

function check(id, passed, detail) {
  results.push({ id, passed: Boolean(passed), detail });
}

function run(command, args) {
  try {
    return {
      exitCode: 0,
      stdout: execFileSync(command, args, {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim(),
    };
  } catch (error) {
    return {
      exitCode: Number.isInteger(error.status) ? error.status : 1,
      stdout: String(error.stdout ?? "").trim(),
      stderr: String(error.stderr ?? error.message ?? "").trim(),
    };
  }
}

function jsonOutput(runResult) {
  if (runResult.exitCode !== 0) return null;
  const lines = runResult.stdout.split(/\r?\n/).filter(Boolean);
  try {
    return JSON.parse(lines.at(-1));
  } catch {
    return null;
  }
}

check("root.exact", ROOT.toLowerCase() === EXPECTED_ROOT.toLowerCase(), ROOT);
for (const input of inputs) {
  const file = absolute(input.path);
  const actual = { bytes: fs.statSync(file).size, sha256: sha256(file) };
  check(
    `input.${input.role}.exact`,
    actual.bytes === input.bytes && actual.sha256 === input.sha256,
    {
      path: input.path,
      expected: { bytes: input.bytes, sha256: input.sha256 },
      actual,
    },
  );
}

const contract = source(inputs[0].path);
const executor = source(inputs[2].path);
const executorBehavior = source(inputs[3].path);
const web = source(inputs[4].path);
const webBehavior = source(inputs[5].path);

check(
  "contract.three-actions-held-no-authority",
  ["status", "comment", "assignment"].every((action) =>
    contract.includes(`"${action}"`),
  ) &&
    contract.includes('status: "HELD_CONTRACT_ONLY"') &&
    contract.includes("mutationAllowed: false") &&
    contract.includes("authorityGranted: false"),
  "Three closed actions produce only a held, non-authorizing plan.",
);
check(
  "contract.immutable-identity-preconditions",
  [
    "projectId",
    "serverId",
    "viewpointId",
    "issueFamilyId",
    "lifecycleStatus",
    "revisionNumber",
    "expectedStatus",
    "expectedVersion",
    "expectedRevisionNumber",
  ].every((field) => contract.includes(field)),
  "Exact immutable identity and status/version/revision preconditions are required.",
);
check(
  "contract.permission-pilot-idempotency",
  contract.includes("permissionEvidence") &&
    contract.includes("pilotPolicy") &&
    contract.includes("receiptSha256") &&
    contract.includes("productionWriteAllowed: false") &&
    contract.includes(
      "`${input.actorId}:${action}:${input.projectId}:${input.serverId}:${input.revisionNumber}:`",
    ),
  "Permission and pilot receipts plus actor/action/project/server/revision idempotency are bound.",
);
check(
  "contract.atomic-409-audit-visual",
  contract.includes("atomicExpectedVersionAndStatusPredicate: true") &&
    contract.includes("zeroUpdatedRowsReturn409: true") &&
    contract.includes(
      "mutationAuditAndIdempotencyReceiptSingleTransaction: true",
    ) &&
    contract.includes("visualStateDigestMustRemainUnchanged: true"),
  "Atomic predicate, zero-row 409, same-transaction audit/receipt, and visual invariance are explicit.",
);

check(
  "executor.sandbox-only-production-false",
  executor.includes("lens-next-phase2-sandbox-executor.v1") &&
    executor.includes("LENS_NEXT_PHASE2_PRODUCTION_ENABLED = false") &&
    !executor.includes("productionEnabled: true"),
  "Executor is explicitly sandbox-scoped and cannot report production enabled.",
);
check(
  "executor.injected-transaction-only",
  executor.includes("LensNextMutationStore") &&
    executor.includes("store.transaction(async (tx) =>") &&
    !/(drizzle|postgres|pg\b|database|fetch\s*\(|node:fs|node:http|node:https|File\.|Sql)/i.test(
      executor,
    ),
  "All mutation behavior is behind an injected transaction; no real I/O adapter exists.",
);
check(
  "executor.exact-replay-and-mismatch",
  executor.includes("findReceipt(scopeKey)") &&
    executor.includes("prior.requestFingerprint !== requestFingerprint") &&
    executor.includes('code: "IDEMPOTENCY_REPLAY_MISMATCH"') &&
    executor.includes("replayed: true") &&
    executor.includes("result: prior.result"),
  "Exact replay returns the prior result; mismatched replay fails 409.",
);
check(
  "executor.atomic-precondition-and-409",
  executor.includes("mutateIfPreconditionsMatch") &&
    executor.includes(
      "if (!row || row.visualStateDigest !== visualStateDigest)",
    ) &&
    executor.includes('code: "PRECONDITION_CONFLICT"') &&
    executor.includes("status: 409"),
  "The store must atomically match preconditions; no row or visual mismatch returns 409.",
);
check(
  "executor.audit-and-receipt-same-transaction",
  executor.includes("await tx.appendAudit") &&
    executor.includes("await tx.saveReceipt(receipt)") &&
    executor.indexOf("await tx.appendAudit") <
      executor.indexOf("await tx.saveReceipt(receipt)"),
  "Audit and idempotency receipt are appended within the same transaction callback.",
);
check(
  "executor.exact-result-visual-invariance",
  executor.includes("resultFromRow") &&
    executor.includes("visualStateDigest: row.visualStateDigest") &&
    executor.includes("row.visualStateDigest !== visualStateDigest"),
  "Result identity/version/status/visual digest derive from the atomically updated row and preserve visual state.",
);
check(
  "executor.behavior-covers-replay-rollback-zero-duplicates",
  executorBehavior.includes("mismatchedReplayConflicts") &&
    executorBehavior.includes("rollbackCases") &&
    executorBehavior.includes("duplicateRecords") &&
    executorBehavior.includes(
      'for (const failure of ["audit", "receipt"] as const)',
    ) &&
    executorBehavior.includes("assert.equal(store.receipts.size, 0)") &&
    executorBehavior.includes("assert.equal(store.audits.length, 0)"),
  "In-memory adversarial behavior covers replay mismatch, rollback, and duplicate prevention.",
);

check(
  "web.unbound-executor-denies-dispatch",
  web.includes("SERVER_EXECUTOR_NOT_BOUND") &&
    web.includes("contractReady && serverExecutorBound") &&
    webBehavior.includes(
      "assert.equal(withoutExecutor.dispatchAllowed, false)",
    ),
  "A valid client envelope remains non-dispatchable until exact server-runtime executor evidence binds.",
);
check(
  "web.mutation-always-false",
  web.includes("mutationAllowed: false") &&
    !web.includes("mutationAllowed: true") &&
    !web.includes("mutationAllowed: dispatchAllowed") &&
    webBehavior.includes("assert.equal(enabled.mutationAllowed, false)"),
  "UI capability never claims mutation authority, including when dispatch is accepted.",
);
check(
  "web.executor-attestation-exact",
  [
    "atomicExpectedStatusVersionRevisionPredicate",
    "zeroRowsConflictStatus",
    "auditAndIdempotencySameTransaction",
    "exactResultIdentityVersionResponse",
    "visualDigestInvariant",
    "fallbackMatchingAllowed",
    "autoConflictResolutionAllowed",
  ].every((field) => web.includes(field)),
  "UI dispatch binds the full server executor attestation without fallback or automatic conflict resolution.",
);
check(
  "web.production-false-zero-io",
  web.includes("productionWriteAllowed !== false") &&
    !/(fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|node:fs|database)/i.test(
      web,
    ),
  "Production write policy must be false and the evaluator performs no I/O or persistent-token access.",
);

const contractRun = run(process.execPath, [TSX, inputs[1].path]);
const contractProof = jsonOutput(contractRun);
check(
  "proof.api-contract-focused",
  contractRun.exitCode === 0 &&
    contractProof?.status === "PASS" &&
    contractProof.acceptedShapes === 3 &&
    contractProof.adversarialDenials === 15 &&
    contractProof.mutationAllowed === false &&
    contractProof.authorityGranted === false,
  {
    exitCode: contractRun.exitCode,
    output: contractProof ?? contractRun.stdout,
  },
);

const executorRun = run(process.execPath, [TSX, inputs[3].path]);
const executorProof = jsonOutput(executorRun);
check(
  "proof.api-executor-focused",
  executorRun.exitCode === 0 &&
    executorProof?.result === "PASS" &&
    executorProof.actionPasses === 3 &&
    executorProof.replayIdempotent === true &&
    executorProof.mismatchedReplayConflicts === true &&
    executorProof.preconditionConflict409 === true &&
    executorProof.rollbackCases === 2 &&
    executorProof.duplicateRecords === 0 &&
    executorProof.productionEnabled === false &&
    Object.values(executorProof.io).every((value) => value === false),
  {
    exitCode: executorRun.exitCode,
    output: executorProof ?? executorRun.stdout,
  },
);

const webRun = run(process.execPath, [TSX, inputs[5].path]);
const webProof = jsonOutput(webRun);
check(
  "proof.web-capability-focused",
  webRun.exitCode === 0 &&
    webProof?.result === "PASS" &&
    webProof.acceptedContracts === 3 &&
    webProof.enabledContracts === 3 &&
    webProof.adversarialDenials === 39 &&
    Object.values(webProof.io).every((value) => value === false),
  { exitCode: webRun.exitCode, output: webProof ?? webRun.stdout },
);

const apiTsc = run(process.execPath, [
  TSC,
  "-p",
  "artifacts/api-server/tsconfig.json",
  "--noEmit",
  "--pretty",
  "false",
]);
check("proof.api-typescript", apiTsc.exitCode === 0, {
  exitCode: apiTsc.exitCode,
});

const webTsc = run(process.execPath, [
  TSC,
  "--noEmit",
  "--strict",
  "--skipLibCheck",
  "--target",
  "ES2020",
  "--module",
  "commonjs",
  "--moduleResolution",
  "node",
  "--esModuleInterop",
  "--types",
  "node",
  "--typeRoots",
  NODE_TYPE_ROOT,
  inputs[4].path,
  inputs[5].path,
]);
check("proof.web-typescript", webTsc.exitCode === 0, {
  exitCode: webTsc.exitCode,
});

const prettier = run(process.execPath, [
  PRETTIER,
  "--check",
  ...inputs.map((input) => input.path),
  "tests/lens-next-next/verify-phase2-api-executor.mjs",
]);
check("proof.prettier", prettier.exitCode === 0, {
  exitCode: prettier.exitCode,
});

const diffCheck = run("git", [
  "diff",
  "--check",
  "--",
  ...inputs.map((input) => input.path),
  "tests/lens-next-next/verify-phase2-api-executor.mjs",
  "evidence/lens-next/20260812/next-phase-integration/phase2-api-executor-terminal-receipt.json",
]);
check("proof.diff-check", diffCheck.exitCode === 0, {
  exitCode: diffCheck.exitCode,
});

const mojibake = new RegExp(
  [
    String.fromCharCode(195),
    String.fromCharCode(194),
    String.fromCharCode(65533),
  ].join("|"),
  "u",
);
const mojibakePaths = [
  ...inputs.map((input) => input.path),
  "tests/lens-next-next/verify-phase2-api-executor.mjs",
].filter((relative) => mojibake.test(source(relative)));
check("proof.mojibake", mojibakePaths.length === 0, mojibakePaths);

const failed = results.filter((result) => !result.passed);
const manifest = inputs
  .map((input) => `${input.path}|${input.bytes}|${input.sha256}`)
  .join("\n");
const receipt = {
  schemaVersion: "bimlog-lens-next-phase2-api-executor-terminal-v1",
  generatedAtUtc: new Date().toISOString(),
  status:
    failed.length === 0
      ? "PASS_SANDBOX_EXECUTOR_ACCEPTANCE_NO_PRODUCTION_AUTHORITY"
      : "FAIL_CLOSED",
  worktree: {
    root: ROOT.replaceAll("\\", "/"),
    head: EXPECTED_HEAD,
  },
  scope: "API/web-only under temporary native/plugin adapter freeze",
  inputs,
  inputManifestSha256: crypto
    .createHash("sha256")
    .update(manifest)
    .digest("hex")
    .toUpperCase(),
  totals: {
    assertions: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
  },
  failedAssertionIds: failed.map((result) => result.id),
  results,
  disposition: {
    contractAccepted: failed.length === 0,
    sandboxInjectedStoreExecutionAccepted: failed.length === 0,
    productionWriteAllowed: false,
    uiMutationAllowed: false,
    realDatabaseOrNetworkIoAllowed: false,
    nativePluginOrBridgeAcceptedByThisReceipt: false,
  },
  safety: {
    pluginNativeBridgeSavedViewpointPathsReadOrTested: false,
    implementationFilesWrittenByVerifier: false,
    realDatabaseIo: false,
    networkIo: false,
    customerProviderProductionAction: false,
    gitMutation: false,
    pushPublishDeploy: false,
  },
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
process.stdout.write(
  `${JSON.stringify({ status: receipt.status, totals: receipt.totals, failedAssertionIds: receipt.failedAssertionIds })}\n`,
);
if (failed.length) process.exitCode = 1;
