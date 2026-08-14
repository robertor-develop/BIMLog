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
  "phase2-workflow-shell-terminal-receipt.json",
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
    "phase2-workflow-shell",
    "artifacts/bimlog/src/features/lens-next/LensNextPhase2WorkflowShell.tsx",
    7778,
    "D5DDA7BDAD54B624BE721A8DDC338743D95538D3CB4E059698C3BCB356B076B3",
  ],
  [
    "phase2-workflow-shell-behavior",
    "artifacts/bimlog/scripts/lens-next/lens-next-phase2-workflow-shell.behavior.tsx",
    9025,
    "41D7DC30761D1756EAB9364A33D7FA1E8BA0647526890C876CEB506C2C2F405A",
  ],
];
const priors = [
  [
    "workflow",
    "evidence/lens-next/20260812/next-phase-integration/web-workflow-successor-terminal-receipt.json",
    11098,
    "5E489D4F165865B16BE3FD116CF168F3B2650570B8CDDA42B140A8DDDCEAB57A",
  ],
  [
    "timeline-queue-models",
    "evidence/lens-next/20260812/next-phase-integration/timeline-offline-queue-terminal-receipt.json",
    7733,
    "EF29566E4D004A7D21591FDB78776FF3C1D0E56780405E17CAAB0CD2BA215554",
  ],
  [
    "timeline-queue-views",
    "evidence/lens-next/20260812/next-phase-integration/presentational-views-terminal-receipt.json",
    6712,
    "3F33DBE9F82D6944EB1E21F695F8AE80115D502FBE4D69C610216B92A0B82074",
  ],
  [
    "action-draft-view",
    "evidence/lens-next/20260812/next-phase-integration/action-draft-view-terminal-receipt.json",
    9878,
    "64178A994F16310CB8BAAF9E3592E2341499A10DD7D4EF38EDD22A7AFFCB7D20",
  ],
  [
    "conflict-review-view",
    "evidence/lens-next/20260812/next-phase-integration/conflict-review-view-terminal-receipt.json",
    6593,
    "BD3D1D1693A4916054DDCDD8388E1DA27B50D53FF714A5A22C3321C7766BE998",
  ],
  [
    "connection-telemetry-view",
    "evidence/lens-next/20260812/next-phase-integration/connection-telemetry-view-terminal-receipt.json",
    5659,
    "8977BB5243EE9041595823BBAC83F02795A6993167236C55EB045123D21CA805",
  ],
  [
    "phase2-api-executor",
    "evidence/lens-next/20260812/next-phase-integration/phase2-api-executor-terminal-receipt.json",
    10641,
    "898DEEACDF1284FA7CA68575F11644CC9E4C703AE0C57C351B99872202BF4FC8",
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

const shell = read(inputs[0][1]);
const behavior = read(inputs[1][1]);
const sections = [
  "connection",
  "workflow",
  "draft",
  "activity",
  "queue",
  "conflict",
];
check(
  "source.six-sections-two-locales",
  sections.every((section) => shell.includes(`\"${section}\"`)) &&
    shell.includes('locale: "en" | "es"') &&
    shell.includes("onSectionChange"),
  "The shell binds six sections and two locales through a presentation-only section callback.",
);
check(
  "source.bounds",
  shell.includes("maximumQueuedDrafts: 100") &&
    shell.includes("maximumActivityEvents: 500") &&
    shell.includes("In-memory draft limit: 100") &&
    shell.includes("Read-only activity limit: 500"),
  "The cohesive shell advertises and freezes queue/activity limits of 100/500.",
);
check(
  "source.default-deny",
  [
    "networkBehavior: false",
    "storageBehavior: false",
    "writeBehavior: false",
    "automaticConflictResolutionAllowed: false",
    "visualMutationAllowed: false",
  ].every((value) => shell.includes(value)) &&
    shell.includes("no token display, network dispatch, storage, write") &&
    shell.includes("conflict resolution, or visual mutation behavior"),
  "The shell denies tokens, network, storage, writes, conflict resolution, and visual mutation.",
);
check(
  "source.no-io-or-mutation-adapter",
  !/(sessionToken\s*:|authorization\s*:|bearer\s+|fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|navigator\.sendBeacon|\.write\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\()/i.test(
    shell,
  ),
  "No token, network, storage, persistence, or mutation adapter exists in the shell.",
);
check(
  "source.behavior-coverage",
  behavior.includes("sections: sections.length") &&
    behavior.includes("locales: 2") &&
    behavior.includes("renders") &&
    behavior.includes("telemetryStates: telemetryStates.length") &&
    behavior.includes("workflowStates: workflowStates.length") &&
    behavior.includes("draftStates: draftStates.length") &&
    behavior.includes("activityStates: activityStates.length") &&
    behavior.includes("queueStates: queueStates.length") &&
    behavior.includes("conflictStates: conflictStates.length"),
  "The executable shell proof covers every bound view state family.",
);

const focused = run(process.execPath, [TSX, inputs[1][1]]);
const proof = parseLastJsonLine(focused);
check(
  "proof.phase2-workflow-shell-ssr",
  focused.exitCode === 0 &&
    proof?.result === "PASS" &&
    proof.sections === 6 &&
    proof.locales === 2 &&
    proof.renders === 47 &&
    proof.telemetryStates === 6 &&
    proof.workflowStates === 6 &&
    proof.draftStates === 6 &&
    proof.activityStates === 6 &&
    proof.queueStates === 6 &&
    proof.conflictStates === 5 &&
    proof.maximumQueuedDrafts === 100 &&
    proof.maximumActivityEvents === 500 &&
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
  "tests/lens-next-next/verify-phase2-workflow-shell.mjs",
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
  "tests/lens-next-next/verify-phase2-workflow-shell.mjs",
  "evidence/lens-next/20260812/next-phase-integration/phase2-workflow-shell-terminal-receipt.json",
]);
check("proof.diff", diff.exitCode === 0, {
  exitCode: diff.exitCode,
  stdout: diff.stdout,
  stderr: diff.stderr,
});

for (const [role, relativePath, bytes, sha256] of priors) {
  const file = abs(relativePath);
  const receipt = JSON.parse(read(relativePath));
  const actual = { bytes: fs.statSync(file).size, sha256: hash(file) };
  check(
    `prior.${role}.rebind`,
    actual.bytes === bytes &&
      actual.sha256 === sha256 &&
      receipt.status.startsWith("PASS") &&
      receipt.totals?.failed === 0 &&
      receipt.safety?.pluginNativeBridgeSavedViewpointPathsReadOrTested ===
        false,
    {
      relativePath,
      expected: { bytes, sha256 },
      actual,
      status: receipt.status,
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
    read("tests/lens-next-next/verify-phase2-workflow-shell.mjs"),
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
  schemaVersion: "bimlog-lens-next-phase2-workflow-shell-terminal-v1",
  generatedAtUtc: new Date().toISOString(),
  status: failed.length
    ? "FAIL_CLOSED"
    : "PASS_PHASE2_COHESIVE_WEB_SHELL_ZERO_IO_MUTATION",
  worktree: {
    root: ROOT.replaceAll("\\", "/"),
    branch: "codex/bimlog-lens-next-20260812",
    head: "4e2d4da72493c9cb497e067c2e73e727e031ede4",
  },
  scope:
    "final strict web-only cohesive shell acceptance under temporary adapter freeze",
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
  acceptedPriorReceipts: priors.map(([role, relativePath, bytes, sha256]) => ({
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
    phase2CohesiveWebShellAccepted: failed.length === 0,
    sections: 6,
    locales: 2,
    renders: 47,
    maximumQueuedDrafts: 100,
    maximumActivityEvents: 500,
    networkAllowed: false,
    storageAllowed: false,
    writeAllowed: false,
    automaticConflictResolutionAllowed: false,
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
