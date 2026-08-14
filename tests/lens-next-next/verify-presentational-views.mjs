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
  "presentational-views-terminal-receipt.json",
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
    "timeline-view",
    "artifacts/bimlog/src/features/lens-next/LensNextActivityTimelineView.tsx",
    7349,
    "1E98210088426F8BA2C0034134FD2FD25EE59B5520793F6AF31F89427CC18989",
  ],
  [
    "timeline-view-behavior",
    "artifacts/bimlog/scripts/lens-next/lens-next-activity-timeline-view.behavior.tsx",
    3705,
    "7CC260D29EF98535EA5D343282C7567769B38F2DA704C6B951BE0F9B8DF9B6B3",
  ],
  [
    "queue-view",
    "artifacts/bimlog/src/features/lens-next/LensNextOfflineQueueView.tsx",
    8821,
    "854056DE44A710DA24FF20B16D082EAF485E8C9B8DA23E8FCCCEE53A5E675CD8",
  ],
  [
    "queue-view-behavior",
    "artifacts/bimlog/scripts/lens-next/lens-next-offline-queue-view.behavior.tsx",
    5438,
    "05D848BF2B5CA87CE5229AFC41235734E869AAD4FF70922762EEDCA19F125175",
  ],
];
const priors = [
  [
    "timeline-queue-model",
    "evidence/lens-next/20260812/next-phase-integration/timeline-offline-queue-terminal-receipt.json",
    "EF29566E4D004A7D21591FDB78776FF3C1D0E56780405E17CAAB0CD2BA215554",
  ],
  [
    "workflow",
    "evidence/lens-next/20260812/next-phase-integration/web-workflow-successor-terminal-receipt.json",
    "5E489D4F165865B16BE3FD116CF168F3B2650570B8CDDA42B140A8DDDCEAB57A",
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
const queue = text(inputs[2][1]);
check(
  "timeline.accessible-bilingual-bounded",
  timeline.includes('locale = "en"') &&
    timeline.includes('role={urgent ? "alert" : "status"}') &&
    timeline.includes("aria-live") &&
    timeline.includes("Math.min(100") &&
    timeline.includes("maximumModelEvents: 500"),
  "Bilingual accessible status/alert view renders at most 100 of 500 model events.",
);
check(
  "timeline.lucide-zero-actions-io",
  timeline.includes('from "lucide-react"') &&
    timeline.includes("actionControls: 0") &&
    timeline.includes("networkBehavior: false") &&
    !/(fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|onClick)/i.test(
      timeline,
    ),
  "Lucide presentational view exposes no action, network, or storage behavior.",
);
check(
  "queue.accessible-bilingual-bounded",
  queue.includes('locale = "en"') &&
    queue.includes('role={urgent ? "alert" : "status"}') &&
    queue.includes("aria-live") &&
    queue.includes("state.items.slice(0, 100)") &&
    queue.includes("maximumRenderedItems: 100"),
  "Bilingual accessible status/alert queue renders at most 100 items.",
);
check(
  "queue.callbacks-not-dispatch",
  queue.includes('from "lucide-react"') &&
    queue.includes("<button") &&
    queue.includes("dispatchBehavior: false") &&
    queue.includes("networkBehavior: false") &&
    queue.includes("storageBehavior: false") &&
    !/(fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB)/i.test(
      queue,
    ),
  "Buttons are callback-only presentation; no dispatch, network, or storage adapter exists.",
);

const timelineRun = run(process.execPath, [TSX, inputs[1][1]]);
const timelineProof = parse(timelineRun);
check(
  "proof.timeline-ssr",
  timelineRun.exitCode === 0 &&
    timelineProof?.result === "PASS" &&
    timelineProof.stateViews === 6 &&
    timelineProof.locales === 2 &&
    timelineProof.modelEvents === 500 &&
    timelineProof.renderedEvents === 100 &&
    timelineProof.hiddenEvents === 400 &&
    timelineProof.actionControls === 0 &&
    timelineProof.networkBehavior === false &&
    timelineProof.persistenceBehavior === false &&
    timelineProof.writeBehavior === false,
  timelineProof ?? timelineRun,
);
const queueRun = run(process.execPath, [TSX, inputs[3][1]]);
const queueProof = parse(queueRun);
check(
  "proof.queue-ssr",
  queueRun.exitCode === 0 &&
    queueProof?.result === "PASS" &&
    queueProof.modes === 6 &&
    queueProof.locales === 2 &&
    queueProof.renderedItems === 100 &&
    queueProof.reconfirmButtons === 1 &&
    queueProof.discardButtons === 100 &&
    queueProof.dispatchBehavior === false &&
    queueProof.networkBehavior === false &&
    queueProof.storageBehavior === false &&
    queueProof.automaticConflictResolution === false &&
    queueProof.visualStateMutation === false,
  queueProof ?? queueRun,
);
const tsc = run(process.execPath, [
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
  "tests/lens-next-next/verify-presentational-views.mjs",
]);
check("proof.prettier", prettier.exitCode === 0, {
  exitCode: prettier.exitCode,
});
const diff = run("git", [
  "diff",
  "--check",
  "--",
  ...inputs.map(([, rel]) => rel),
  "tests/lens-next-next/verify-presentational-views.mjs",
  "evidence/lens-next/20260812/next-phase-integration/presentational-views-terminal-receipt.json",
]);
check("proof.diff", diff.exitCode === 0, { exitCode: diff.exitCode });
for (const [role, rel, sha256] of priors) {
  const prior = JSON.parse(text(rel));
  check(
    `prior.${role}.rebind`,
    hash(abs(rel)) === sha256 &&
      prior.totals.failed === 0 &&
      prior.status.startsWith("PASS"),
    { path: rel, sha256: hash(abs(rel)), status: prior.status },
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
    text("tests/lens-next-next/verify-presentational-views.mjs"),
  ].some((v) => bad.test(v)),
  "No sentinel matches.",
);
const failed = checks.filter((v) => !v.passed);
const manifest = inputs
  .map(([, rel, bytes, sha]) => `${rel}|${bytes}|${sha}`)
  .join("\n");
const receipt = {
  schemaVersion: "bimlog-lens-next-presentational-views-terminal-v1",
  generatedAtUtc: new Date().toISOString(),
  status: failed.length
    ? "FAIL_CLOSED"
    : "PASS_PRESENTATIONAL_VIEWS_ZERO_DISPATCH_IO",
  worktree: {
    root: ROOT.replaceAll("\\", "/"),
    head: "4e2d4da72493c9cb497e067c2e73e727e031ede4",
  },
  scope: "web-only under temporary adapter freeze",
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
    presentationalViewsAccepted: !failed.length,
    actionDispatchAllowed: false,
    networkOrStorageAllowed: false,
    mutationAllowed: false,
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
