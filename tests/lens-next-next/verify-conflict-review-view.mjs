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
  "conflict-review-view-terminal-receipt.json",
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
    "conflict-review-view",
    "artifacts/bimlog/src/features/lens-next/LensNextConflictReviewView.tsx",
    7660,
    "A9AEB9A225FD2D8C85CDFE0A39A481C75DF6A027D49341F2ADE582B71591E45D",
  ],
  [
    "conflict-review-view-behavior",
    "artifacts/bimlog/scripts/lens-next/lens-next-conflict-review-view.behavior.tsx",
    3730,
    "6AA8CBE0C25F34A8AEC44F3E556CAFCAF1D8F4605BF2E12F95331143C75D30E1",
  ],
];
const priors = [
  [
    "auto-refresh-workflow",
    "evidence/lens-next/20260812/next-phase-integration/web-workflow-successor-terminal-receipt.json",
    11098,
    "60EB976CED230800510BF10D5C49A72F13603A9A9B1F541C23D4DC0459F9E6E0",
  ],
  [
    "offline-queue",
    "evidence/lens-next/20260812/next-phase-integration/timeline-offline-queue-terminal-receipt.json",
    7733,
    "16FEE10E304E4290EA641E376458D43F155B6A28AFAFDC00A6DA10CA9DF54D1F",
  ],
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
const behavior = read(inputs[1][1]);
const kinds = [
  "stale_identity",
  "divergent_revision_version",
  "receipt_expired",
  "offline_queue_mismatch",
  "visual_digest_mismatch",
];
check(
  "source.states-locales-callbacks",
  kinds.every((kind) => view.includes(`\"${kind}\"`)) &&
    view.includes('locale: "en" | "es"') &&
    view.includes("onRequestRefresh: () => void") &&
    view.includes("onDiscardDraft: () => void") &&
    !["onResolve", "onAccept", "onMerge", "onOverwrite", "onSend"].some(
      (name) => view.includes(name),
    ),
  "Five conflict states, two locales, and only refresh-request/discard-draft callbacks are exposed.",
);
check(
  "source.bound-values",
  view.includes("maximumBoundValueCharacters: 160") &&
    view.includes("value.slice(0, limit - 1)") &&
    view.includes('bounded(value.status, "—", 64)') &&
    view.includes("bounded(value.queueFingerprint, text.unavailable, 80)"),
  "User/server values are bounded before presentation, with an invariant ceiling of 160 characters.",
);
check(
  "source.manual-review-default-deny",
  [
    "automaticResolutionAllowed: false",
    "acceptMergeOverwriteControlsAllowed: false",
    "sendBehavior: false",
    "networkBehavior: false",
    "storageBehavior: false",
    "writeBehavior: false",
    "visualMutationAllowed: false",
  ].every((value) => view.includes(value)) &&
    view.includes("No visual state is changed") &&
    view.includes("never accepts, merges, overwrites, resolves, or sends"),
  "The review is manual and fail closed: no resolution, send, I/O, write, or visual mutation.",
);
check(
  "source.no-direct-io-write-or-auto-resolution",
  !/(fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|navigator\.sendBeacon|\.write\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\()/i.test(
    view,
  ) &&
    !/(resolveConflict|acceptMerge|overwriteCurrent|sendDraft)\s*\(/.test(view),
  "No direct adapter or automatic conflict-resolution primitive exists in the view.",
);
check(
  "source.behavior-coverage",
  behavior.includes("kinds: kinds.length") &&
    behavior.includes("locales: 2") &&
    behavior.includes("renders") &&
    behavior.includes("nativeButtons: 2") &&
    behavior.includes("boundedValues: true"),
  "The focused proof covers all state/locale combinations, two native controls, and bounded values.",
);

const focused = run(process.execPath, [TSX, inputs[1][1]]);
const proof = parseLastJsonLine(focused);
check(
  "proof.conflict-review-ssr",
  focused.exitCode === 0 &&
    proof?.result === "PASS" &&
    proof.kinds === 5 &&
    proof.locales === 2 &&
    proof.renders === 10 &&
    proof.nativeButtons === 2 &&
    proof.boundedValues === true &&
    proof.automaticResolutionAllowed === false &&
    proof.sendBehavior === false &&
    proof.networkBehavior === false &&
    proof.storageBehavior === false &&
    proof.writeBehavior === false &&
    proof.visualMutationAllowed === false,
  proof ?? focused,
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
  "tests/lens-next-next/verify-conflict-review-view.mjs",
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
  "tests/lens-next-next/verify-conflict-review-view.mjs",
  "evidence/lens-next/20260812/next-phase-integration/conflict-review-view-terminal-receipt.json",
]);
check("proof.diff", diff.exitCode === 0, {
  exitCode: diff.exitCode,
  stdout: diff.stdout,
  stderr: diff.stderr,
});

for (const [role, relativePath, bytes, sha256] of priors) {
  const file = abs(relativePath);
  const prior = JSON.parse(read(relativePath));
  const actual = { bytes: fs.statSync(file).size, sha256: hash(file) };
  check(
    `prior.${role}.rebind`,
    actual.bytes === bytes &&
      actual.sha256 === sha256 &&
      prior.status.startsWith("PASS") &&
      prior.totals?.failed === 0 &&
      prior.safety?.pluginNativeBridgeSavedViewpointPathsReadOrTested === false,
    {
      relativePath,
      expected: { bytes, sha256 },
      actual,
      status: prior.status,
    },
  );
}

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
    read("tests/lens-next-next/verify-conflict-review-view.mjs"),
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
  schemaVersion: "bimlog-lens-next-conflict-review-view-terminal-v1",
  generatedAtUtc: new Date().toISOString(),
  status: failed.length
    ? "FAIL_CLOSED"
    : "PASS_CONFLICT_REVIEW_MANUAL_ONLY_ZERO_IO_MUTATION",
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
  priorReceipts: priors.map(([role, relativePath, bytes, sha256]) => ({
    role,
    path: relativePath,
    bytes,
    sha256,
  })),
  totals: {
    assertions: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
  },
  failedAssertionIds: failed.map((item) => item.id),
  checks,
  disposition: {
    conflictReviewViewAccepted: failed.length === 0,
    conflictStates: 5,
    locales: 2,
    maximumBoundValueCharacters: 160,
    callbacks: ["request-read-only-refresh", "discard-local-draft"],
    automaticResolutionAllowed: false,
    sendAllowed: false,
    networkOrStorageAllowed: false,
    writeAllowed: false,
    visualMutationAllowed: false,
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
