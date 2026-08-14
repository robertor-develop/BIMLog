import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const OUTPUT = path.join(
  ROOT,
  "evidence",
  "lens-next",
  "20260812",
  "next-phase-integration",
  "action-draft-view-terminal-receipt.json",
);
const TSX =
  "F:\\BIMLog\\Repositories\\bimlog\\node_modules\\.pnpm\\tsx@4.21.0\\node_modules\\tsx\\dist\\cli.mjs";
const TSC =
  "F:\\BIMLog\\Repositories\\bimlog\\node_modules\\typescript\\bin\\tsc";
const PRETTIER =
  "F:\\BIMLog\\Repositories\\bimlog\\node_modules\\prettier\\bin\\prettier.cjs";
const TYPE_ROOTS = path.join(
  ROOT,
  "artifacts",
  "bimlog",
  "node_modules",
  "@types",
);

const inputs = [
  [
    "action-draft-view",
    "artifacts/bimlog/src/features/lens-next/LensNextActionDraftView.tsx",
    12788,
    "35ECBA0CAF0A6DE037947AD7EC4A3C53FCECC55395A51A40460ACCD1CB374797",
  ],
  [
    "action-draft-view-behavior",
    "artifacts/bimlog/scripts/lens-next/lens-next-action-draft-view.behavior.tsx",
    5000,
    "879FFC0E80F4E1C019AF925D4FED8826084A50FA4D8F298C45E89DCD751A6438",
  ],
  [
    "action-draft",
    "artifacts/bimlog/src/features/lens-next/lens-next-action-draft.ts",
    10468,
    "E33B64F741EDCA50BCC9B8943F0D9FF594D0F7D4F01288408ECA49A751E7326B",
  ],
  [
    "action-draft-behavior",
    "artifacts/bimlog/scripts/lens-next/lens-next-action-draft.behavior.ts",
    5669,
    "37CE589044D560EAD443030942D9F4A467B54CECCC86A35D21A47C04D2C21E2A",
  ],
  [
    "phase2-capability",
    "artifacts/bimlog/src/features/lens-next/lens-next-phase2-capability.ts",
    16192,
    "4C2A9CAB634837F0A9783693549D8E3C52ADC6FDACA2057272E456DEBA7985E8",
  ],
  [
    "phase2-capability-behavior",
    "artifacts/bimlog/scripts/lens-next/lens-next-phase2-capability.behavior.ts",
    10607,
    "B1310F7306EFE3203103791B89E12A1E03B9F3C746C136A0A32B540388563D68",
  ],
];
const executorReceipt = [
  "evidence/lens-next/20260812/next-phase-integration/phase2-api-executor-terminal-receipt.json",
  10641,
  "10E287B7B36623012524E42E8EAB869C8CBFACD253A81807484FDBB2609C8240",
];

const checks = [];
const abs = (relativePath) => path.join(ROOT, ...relativePath.split("/"));
const read = (relativePath) => fs.readFileSync(abs(relativePath), "utf8");
const hash = (file) =>
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex")
    .toUpperCase();
const check = (id, passed, detail) =>
  checks.push({ id, passed: Boolean(passed), detail });
const run = (command, args) => {
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
      exitCode: error.status ?? 1,
      stdout: String(error.stdout ?? "").trim(),
      stderr: String(error.stderr ?? error.message ?? "").trim(),
    };
  }
};
const parseLastJsonLine = (result) => {
  try {
    return JSON.parse(result.stdout.split(/\r?\n/).filter(Boolean).at(-1));
  } catch {
    return null;
  }
};

for (const [role, relativePath, bytes, sha256] of inputs) {
  const file = abs(relativePath);
  const actual = { bytes: fs.statSync(file).size, sha256: hash(file) };
  check(
    `input.${role}.exact`,
    actual.bytes === bytes && actual.sha256 === sha256,
    { relativePath, expected: { bytes, sha256 }, actual },
  );
}

const view = read(inputs[0][1]);
const viewBehavior = read(inputs[1][1]);
const draft = read(inputs[2][1]);
const capability = read(inputs[4][1]);

check(
  "source.action-state-locale-contract",
  view.includes('export type LensNextActionDraftViewLocale = "en" | "es"') &&
    ["status", "comment", "assignment"].every((action) =>
      draft.includes(`\"${action}\"`),
    ) &&
    [
      "valid",
      "invalid",
      "confirmation_required",
      "executor_unbound",
      "offline",
      "conflict",
    ].every((state) => view.includes(`\"${state}\"`)),
  "The exact view/draft pair declares three actions, six states, and English/Spanish locales.",
);
check(
  "source.native-controls-bounds",
  view.includes("<fieldset") &&
    view.includes("<select") &&
    view.includes("<textarea") &&
    view.includes('<button type="button"') &&
    view.includes("const MAX_OPTIONS = 100") &&
    view.includes("maximumAssignmentOptions: 100"),
  "Native form controls are bounded to at most 100 assignment choices.",
);
check(
  "source.draft-only-callback-surface",
  [
    "onStatusChange",
    "onCommentChange",
    "onAssigneeChange",
    "onCompanyChange",
    "onReasonChange",
    "onCreateDraft",
    "onConfirmDraft",
    "onCancelDraft",
  ].every((name) => view.includes(name)) &&
    !["onDispatch", "onExecute", "onSubmit"].some((name) =>
      view.includes(name),
    ) &&
    !view.includes("mutation-executor"),
  "The view exposes local draft callbacks only and has no executor/dispatch/submit callback.",
);
check(
  "source.ui-default-deny",
  [
    "dispatchBehavior: false",
    "networkBehavior: false",
    "storageBehavior: false",
    "writeBehavior: false",
    "authorityGranted: false",
    "productionWriteAllowed: false",
    "mutationAllowed: false",
  ].every((value) => view.includes(value)) &&
    view.includes("It never sends a request"),
  "The UI invariant set denies dispatch, authority, mutation, production writes, network, and storage.",
);
check(
  "source.no-direct-io-or-write-adapter",
  !/(fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|navigator\.sendBeacon|\.write\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\()/i.test(
    view,
  ),
  "No direct network, persistence, or mutation primitive exists in the view source.",
);
check(
  "source.draft-and-capability-default-deny",
  draft.includes("dispatchPerformed: false") &&
    draft.includes("productionWriteAllowed: false") &&
    draft.includes("authorityGranted: false") &&
    draft.includes("mutationAllowed: false") &&
    capability.includes("mutationAllowed: false") &&
    capability.includes("productionWriteAllowed: false"),
  "The bound draft and capability contracts preserve UI/production default deny.",
);
check(
  "source.behavior-covers-view-surface",
  viewBehavior.includes("actions: 3") &&
    viewBehavior.includes("states: states.length") &&
    viewBehavior.includes("locales: 2") &&
    viewBehavior.includes("nativeControls: true") &&
    viewBehavior.includes("maximumOptions: 100"),
  "The executable SSR proof covers all assigned actions, states, locales, native controls, and bound.",
);

const viewRun = run(process.execPath, [TSX, inputs[1][1]]);
const viewProof = parseLastJsonLine(viewRun);
check(
  "proof.action-draft-view",
  viewRun.exitCode === 0 &&
    viewProof?.result === "PASS" &&
    viewProof.actions === 3 &&
    viewProof.states === 6 &&
    viewProof.locales === 2 &&
    viewProof.nativeControls === true &&
    viewProof.maximumOptions === 100 &&
    viewProof.dispatchBehavior === false &&
    viewProof.networkBehavior === false &&
    viewProof.storageBehavior === false &&
    viewProof.writeBehavior === false &&
    viewProof.authorityGranted === false &&
    viewProof.productionWriteAllowed === false &&
    viewProof.mutationAllowed === false,
  viewProof ?? viewRun,
);

const draftRun = run(process.execPath, [TSX, inputs[3][1]]);
const draftProof = parseLastJsonLine(draftRun);
check(
  "proof.action-draft-model",
  draftRun.exitCode === 0 &&
    draftProof?.result === "PASS" &&
    draftProof.accepted === 3 &&
    draftProof.draftBatch === 500 &&
    draftProof.adversarialDenials === 20 &&
    draftProof.dispatchPerformed === false &&
    draftProof.productionWriteAllowed === false &&
    draftProof.mutationAllowed === false &&
    Object.values(draftProof.io ?? {}).every((value) => value === false),
  draftProof ?? draftRun,
);

const capabilityRun = run(process.execPath, [TSX, inputs[5][1]]);
const capabilityProof = parseLastJsonLine(capabilityRun);
check(
  "proof.phase2-capability",
  capabilityRun.exitCode === 0 &&
    capabilityProof?.result === "PASS" &&
    capabilityProof.acceptedContracts === 3 &&
    capabilityProof.enabledContracts === 3 &&
    capabilityProof.adversarialDenials === 39 &&
    Object.values(capabilityProof.io ?? {}).every((value) => value === false),
  capabilityProof ?? capabilityRun,
);

const typeScript = run(process.execPath, [
  TSC,
  "--noEmit",
  "--strict",
  "--skipLibCheck",
  "--jsx",
  "react-jsx",
  "--target",
  "ES2020",
  "--module",
  "commonjs",
  "--moduleResolution",
  "node",
  "--esModuleInterop",
  "--types",
  "node,react,react-dom",
  "--typeRoots",
  TYPE_ROOTS,
  ...inputs.map(([, relativePath]) => relativePath),
]);
check("proof.strict-typescript", typeScript.exitCode === 0, {
  exitCode: typeScript.exitCode,
  stderr: typeScript.stderr,
});

const prettier = run(process.execPath, [
  PRETTIER,
  "--check",
  ...inputs.map(([, relativePath]) => relativePath),
  "tests/lens-next-next/verify-action-draft-view.mjs",
]);
check("proof.prettier", prettier.exitCode === 0, {
  exitCode: prettier.exitCode,
  stdout: prettier.stdout,
  stderr: prettier.stderr,
});

const diff = run("git", [
  "diff",
  "--check",
  "--",
  ...inputs.map(([, relativePath]) => relativePath),
  "tests/lens-next-next/verify-action-draft-view.mjs",
  "evidence/lens-next/20260812/next-phase-integration/action-draft-view-terminal-receipt.json",
]);
check("proof.diff", diff.exitCode === 0, {
  exitCode: diff.exitCode,
  stdout: diff.stdout,
  stderr: diff.stderr,
});

const [executorPath, executorBytes, executorSha256] = executorReceipt;
const executorActual = {
  bytes: fs.statSync(abs(executorPath)).size,
  sha256: hash(abs(executorPath)),
};
const executor = JSON.parse(read(executorPath));
check(
  "prior.api-executor.rebind",
  executorActual.bytes === executorBytes &&
    executorActual.sha256 === executorSha256 &&
    executor.status ===
      "PASS_SANDBOX_EXECUTOR_ACCEPTANCE_NO_PRODUCTION_AUTHORITY" &&
    executor.totals?.failed === 0 &&
    executor.disposition?.productionWriteAllowed === false &&
    executor.disposition?.uiMutationAllowed === false &&
    executor.safety?.pluginNativeBridgeSavedViewpointPathsReadOrTested ===
      false,
  {
    relativePath: executorPath,
    expected: { bytes: executorBytes, sha256: executorSha256 },
    actual: executorActual,
    status: executor.status,
  },
);

const mojibakeSentinels = new RegExp(
  [
    String.fromCharCode(195),
    String.fromCharCode(194),
    String.fromCharCode(65533),
  ].join("|"),
  "u",
);
check(
  "proof.mojibake",
  ![
    ...inputs.map(([, relativePath]) => read(relativePath)),
    read("tests/lens-next-next/verify-action-draft-view.mjs"),
  ].some((value) => mojibakeSentinels.test(value)),
  "No mojibake sentinel occurs in an assigned or owned source file.",
);

const failed = checks.filter((item) => !item.passed);
const manifest = inputs
  .map(
    ([, relativePath, bytes, sha256]) => `${relativePath}|${bytes}|${sha256}`,
  )
  .join("\n");
const receipt = {
  schemaVersion: "bimlog-lens-next-action-draft-view-terminal-v1",
  generatedAtUtc: new Date().toISOString(),
  status: failed.length
    ? "FAIL_CLOSED"
    : "PASS_ACTION_DRAFT_VIEW_DRAFT_ONLY_ZERO_AUTHORITY_IO",
  worktree: {
    root: ROOT.replaceAll("\\", "/"),
    branch: "codex/bimlog-lens-next-20260812",
    head: "4e2d4da72493c9cb497e067c2e73e727e031ede4",
  },
  scope: "strict web-only acceptance under temporary adapter freeze",
  inputs: inputs.map(([role, relativePath, bytes, sha256]) => ({
    role,
    path: relativePath,
    bytes,
    sha256,
  })),
  inputManifestSha256: crypto
    .createHash("sha256")
    .update(manifest)
    .digest("hex")
    .toUpperCase(),
  priorReceipt: {
    role: "phase2-api-executor",
    path: executorPath,
    bytes: executorBytes,
    sha256: executorSha256,
  },
  totals: {
    assertions: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
  },
  failedAssertionIds: failed.map((item) => item.id),
  checks,
  disposition: {
    actionDraftViewAccepted: failed.length === 0,
    actions: 3,
    states: 6,
    locales: 2,
    maximumAssignmentOptions: 100,
    nativeFormControls: true,
    callbacksAreDraftOnly: true,
    dispatchAllowed: false,
    mutationAllowed: false,
    authorityGranted: false,
    productionWriteAllowed: false,
    networkOrStorageAllowed: false,
  },
  safety: {
    pluginNativeBridgeSavedViewpointPathsReadOrTested: false,
    implementationFilesWrittenByVerifier: false,
    databaseIo: false,
    networkIo: false,
    gitMutation: false,
    externalAction: false,
  },
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(
  JSON.stringify({
    status: receipt.status,
    totals: receipt.totals,
    failedAssertionIds: receipt.failedAssertionIds,
  }),
);
if (failed.length) process.exitCode = 1;
