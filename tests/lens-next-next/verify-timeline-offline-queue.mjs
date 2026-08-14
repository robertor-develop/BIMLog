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
  "timeline-offline-queue-terminal-receipt.json",
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
const priorReceipts = [
  [
    "executor",
    "evidence/lens-next/20260812/next-phase-integration/phase2-api-executor-terminal-receipt.json",
    "898DEEACDF1284FA7CA68575F11644CC9E4C703AE0C57C351B99872202BF4FC8",
  ],
  [
    "workflow",
    "evidence/lens-next/20260812/next-phase-integration/web-workflow-successor-terminal-receipt.json",
    "5E489D4F165865B16BE3FD116CF168F3B2650570B8CDDA42B140A8DDDCEAB57A",
  ],
];
const inputs = [
  [
    "timeline",
    "artifacts/bimlog/src/features/lens-next/lens-next-activity-timeline.ts",
    8209,
    "E455B6123D945A47EA4C254EF5F1E6992A852BFE0366B56D484B126F835BE8AC",
  ],
  [
    "timeline-behavior",
    "artifacts/bimlog/scripts/lens-next/lens-next-activity-timeline.behavior.ts",
    6093,
    "2A72BAE5F880BF86D9C3174E2F75B756B21916D897F1B2A266CA73EDFEC779C7",
  ],
  [
    "offline-queue",
    "artifacts/bimlog/src/features/lens-next/lens-next-offline-queue.ts",
    9771,
    "F8C14CDC0B960A5C9F88CAA68538020FBB9A9D67238D153C6DA1CDFE4A7DF210",
  ],
  [
    "offline-queue-behavior",
    "artifacts/bimlog/scripts/lens-next/lens-next-offline-queue.behavior.ts",
    7016,
    "35FD11FFFC72FB7C0C7A31DF257B6A1F1E7CFEE2889F44C5073F725275931395",
  ],
];
const checks = [];
const abs = (rel) => path.join(ROOT, ...rel.split("/"));
const text = (rel) => fs.readFileSync(abs(rel), "utf8");
const hash = (file) =>
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex")
    .toUpperCase();
const check = (id, passed, detail) =>
  checks.push({ id, passed: Boolean(passed), detail });
const run = (cmd, args) => {
  try {
    return {
      exitCode: 0,
      stdout: execFileSync(cmd, args, {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim(),
    };
  } catch (e) {
    return {
      exitCode: e.status ?? 1,
      stdout: String(e.stdout ?? "").trim(),
      stderr: String(e.stderr ?? e.message ?? "").trim(),
    };
  }
};
const parse = (result) => {
  try {
    return JSON.parse(result.stdout.split(/\r?\n/).filter(Boolean).at(-1));
  } catch {
    return null;
  }
};

for (const [role, rel, bytes, sha256] of inputs) {
  const file = abs(rel);
  const actual = { bytes: fs.statSync(file).size, sha256: hash(file) };
  check(
    `input.${role}.exact`,
    actual.bytes === bytes && actual.sha256 === sha256,
    { path: rel, expected: { bytes, sha256 }, actual },
  );
}
const timeline = text(inputs[0][1]);
const timelineTest = text(inputs[1][1]);
const queue = text(inputs[2][1]);
const queueTest = text(inputs[3][1]);
check(
  "timeline.500-five-pages-dedupe-order",
  timeline.includes("MAX_EVENTS = 500") &&
    timeline.includes("pageSize: 100") &&
    timeline.includes("const byId = new Map") &&
    timeline.includes("sort("),
  "500 events, five 100-event pages, dedupe and deterministic ordering.",
);
check(
  "timeline.cursor-identity-monotonic-conflict",
  timeline.includes("cursor") &&
    timeline.includes("sameIdentity") &&
    timeline.includes("STALE_HISTORY_VERSION") &&
    timeline.includes("DIVERGENT_ACTIVITY_DUPLICATE") &&
    timeline.includes("blocked"),
  "Cursor and immutable identity are bound; stale/divergent data blocks without auto-resolution.",
);
check(
  "timeline.get-only-bilingual-no-write",
  timeline.includes('method: "GET"') &&
    timeline.includes('"en" | "es"') &&
    !/(POST|PATCH|PUT|DELETE)/.test(timeline) &&
    !/(fetch\s*\(|XMLHttpRequest|WebSocket|database|localStorage|sessionStorage)/i.test(
      timeline,
    ),
  "GET-only pure state model, bilingual, no write or I/O adapter.",
);
check(
  "timeline.behavior-source-covers-matrix",
  timelineTest.includes("for (let page = 0; page < 5") &&
    timelineTest.includes("duplicatesAdded") &&
    timelineTest.includes("cursorBlocked") &&
    timelineTest.includes("locales"),
  "Behavior covers 500 events, dedupe, cursor denial and bilingual state.",
);
check(
  "queue.100-fifo-bytes-dedupe",
  queue.includes("MAX_ITEMS = 100") &&
    queue.includes("MAX_TOTAL_BYTES") &&
    queue.includes("state.items[0]") &&
    queue.includes("idempotency") &&
    queue.includes("duplicate"),
  "Queue is capped at 100 and bytes, FIFO, with idempotency dedupe.",
);
check(
  "queue.reconfirm-retry-offline",
  queue.includes("reconfirmLensNextQueueHead") &&
    queue.includes("MAX_ATTEMPTS = 4") &&
    queue.includes("offline") &&
    queue.includes("markLensNextQueueHeadRetry"),
  "Reconnect requires confirmation and retry is bounded while offline.",
);
check(
  "queue.stale-executor-precondition-conflict",
  queue.includes("EXECUTOR_RECEIPT_STALE") &&
    queue.includes("DRAFT_STALE") &&
    queue.includes("RECONFIRMATION_REQUIRED"),
  "Stale executor or precondition mismatch blocks/conflicts fail-closed.",
);
check(
  "queue.no-persistence-network-write-auto-visual",
  queue.includes("persistentStorageAllowed: false") &&
    queue.includes("automaticConflictResolutionAllowed: false") &&
    queue.includes("writeEndpointsAllowed: false") &&
    queue.includes("draft.visualStateDigest") &&
    !/(fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|database)/i.test(
      queue,
    ),
  "No persistence, network, write, auto-resolution, or visual mutation.",
);

const timelineRun = run(process.execPath, [TSX, inputs[1][1]]);
const timelineProof = parse(timelineRun);
check(
  "proof.timeline",
  timelineRun.exitCode === 0 &&
    timelineProof?.result === "PASS" &&
    timelineProof.events === 500 &&
    timelineProof.pages === 5 &&
    timelineProof.duplicatesAdded === 0 &&
    timelineProof.staleBlocked &&
    timelineProof.divergentBlocked &&
    timelineProof.cursorBlocked &&
    timelineProof.locales === 2 &&
    timelineProof.writes === 0 &&
    Object.values(timelineProof.io).every((v) => v === false),
  timelineProof ?? timelineRun,
);
const queueRun = run(process.execPath, [TSX, inputs[3][1]]);
const queueProof = parse(queueRun);
check(
  "proof.queue",
  queueRun.exitCode === 0 &&
    queueProof?.result === "PASS" &&
    queueProof.queued === 100 &&
    queueProof.fifo &&
    queueProof.duplicatesAdded === 0 &&
    queueProof.overflowBlocked &&
    queueProof.mismatchBlocked &&
    queueProof.staleBlocked &&
    queueProof.reconnectRequiresConfirmation &&
    queueProof.retryAttempts === 4 &&
    queueProof.persistentStores === 0 &&
    queueProof.dispatches === 0 &&
    Object.values(queueProof.io).every((v) => v === false),
  queueProof ?? queueRun,
);
const tsc = run(process.execPath, [
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
  TYPE_ROOTS,
  ...inputs.map(([, rel]) => rel),
]);
check("proof.strict-typescript", tsc.exitCode === 0, {
  exitCode: tsc.exitCode,
  stderr: tsc.stderr,
});
const prettier = run(process.execPath, [
  PRETTIER,
  "--check",
  ...inputs.map(([, rel]) => rel),
  "tests/lens-next-next/verify-timeline-offline-queue.mjs",
]);
check("proof.prettier", prettier.exitCode === 0, {
  exitCode: prettier.exitCode,
});
const diff = run("git", [
  "diff",
  "--check",
  "--",
  ...inputs.map(([, rel]) => rel),
  "tests/lens-next-next/verify-timeline-offline-queue.mjs",
  "evidence/lens-next/20260812/next-phase-integration/timeline-offline-queue-terminal-receipt.json",
]);
check("proof.diff", diff.exitCode === 0, { exitCode: diff.exitCode });
for (const [role, rel, sha256] of priorReceipts) {
  const receipt = JSON.parse(text(rel));
  check(
    `prior.${role}.rebind`,
    hash(abs(rel)) === sha256 &&
      receipt.totals.failed === 0 &&
      receipt.status.startsWith("PASS"),
    { path: rel, sha256: hash(abs(rel)), status: receipt.status },
  );
}
const bad = new RegExp(
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
    ...inputs.map(([, rel]) => text(rel)),
    text("tests/lens-next-next/verify-timeline-offline-queue.mjs"),
  ].some((v) => bad.test(v)),
  "No sentinel matches.",
);
const failed = checks.filter((v) => !v.passed);
const manifest = inputs
  .map(([, rel, bytes, sha]) => `${rel}|${bytes}|${sha}`)
  .join("\n");
const receipt = {
  schemaVersion: "bimlog-lens-next-timeline-offline-queue-terminal-v1",
  generatedAtUtc: new Date().toISOString(),
  status: failed.length
    ? "FAIL_CLOSED"
    : "PASS_PURE_TIMELINE_OFFLINE_QUEUE_NO_MUTATION_AUTHORITY",
  worktree: {
    root: ROOT.replaceAll("\\", "/"),
    head: "4e2d4da72493c9cb497e067c2e73e727e031ede4",
  },
  scope: "web/API-only under temporary adapter freeze",
  inputs: inputs.map(([role, path, bytes, sha256]) => ({
    role,
    path,
    bytes,
    sha256,
  })),
  inputManifestSha256: crypto
    .createHash("sha256")
    .update(manifest)
    .digest("hex")
    .toUpperCase(),
  totals: {
    assertions: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
  },
  failedAssertionIds: failed.map((v) => v.id),
  checks,
  disposition: {
    pureContractsAccepted: !failed.length,
    mutationAllowed: false,
    authorityGranted: false,
    productionWriteAllowed: false,
    persistenceOrNetworkAllowed: false,
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
