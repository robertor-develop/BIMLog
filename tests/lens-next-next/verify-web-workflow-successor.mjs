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
  "web-workflow-successor-terminal-receipt.json",
);
const TSX =
  "F:\\BIMLog\\Repositories\\bimlog\\node_modules\\.pnpm\\tsx@4.21.0\\node_modules\\tsx\\dist\\cli.mjs";
const TSC =
  "F:\\BIMLog\\Repositories\\bimlog\\node_modules\\typescript\\bin\\tsc";
const PRETTIER =
  "F:\\BIMLog\\Repositories\\bimlog\\node_modules\\prettier\\bin\\prettier.cjs";
const NODE_TYPES = path.join(
  ROOT,
  "artifacts",
  "bimlog",
  "node_modules",
  "@types",
);
const EXECUTOR_RECEIPT =
  "evidence/lens-next/20260812/next-phase-integration/phase2-api-executor-terminal-receipt.json";
const inputs = [
  [
    "auto-refresh",
    "artifacts/bimlog/src/features/lens-next/lens-next-auto-refresh.ts",
    8775,
    "B0354B8BA58D2274532D0213EB1D21FED7BDAA112177470CB2D3EBB615DE116A",
  ],
  [
    "auto-refresh-behavior",
    "artifacts/bimlog/scripts/lens-next/lens-next-auto-refresh.behavior.ts",
    6143,
    "7986F9937C26C72BEEBAF6E1A48AD163323F353E7B79EFCE3DB5F970B65AA4F8",
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
    "workflow-banner",
    "artifacts/bimlog/src/features/lens-next/LensNextWorkflowStateBanner.tsx",
    5095,
    "EBFFBCAE55125C761A474BEB72974A4995B1D2D4C0B04709133643325CF58F41",
  ],
  [
    "workflow-banner-behavior",
    "artifacts/bimlog/scripts/lens-next/lens-next-workflow-state-banner.behavior.tsx",
    3123,
    "A31CEC7E9B99D965E0130E9A57B7F4AF6B544BDE033ED0D6A797EE166C56C2AC",
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
const check = (id, pass, detail) =>
  checks.push({ id, passed: Boolean(pass), detail });
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
  } catch (error) {
    return {
      exitCode: error.status ?? 1,
      stdout: String(error.stdout ?? "").trim(),
      stderr: String(error.stderr ?? error.message ?? "").trim(),
    };
  }
};
const parseLast = (result) => {
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
const refresh = text(inputs[0][1]);
const refreshTest = text(inputs[1][1]);
const draft = text(inputs[2][1]);
const draftTest = text(inputs[3][1]);
const banner = text(inputs[4][1]);
const bannerTest = text(inputs[5][1]);

check(
  "refresh.six-state-get-only-single-flight",
  [
    "idle",
    "refreshing",
    "saved",
    "offline",
    "conflict",
    "action_blocked",
  ].every((v) => refresh.includes(`"${v}"`)) &&
    refresh.includes('method: "GET"') &&
    refresh.includes("state.inFlight ||"),
  "Six closed states, authenticated GET-only, one in-flight request.",
);
check(
  "refresh.bounded-retry-500",
  refresh.includes("MAX_ISSUES = 500") &&
    refresh.includes("MAX_RETRIES = 4") &&
    refresh.includes("Math.min(") &&
    refresh.includes("backoff"),
  "Maximum 500 issues and bounded retry/backoff.",
);
check(
  "refresh.identity-monotonic-idempotent",
  refresh.includes("sameStableIdentity") &&
    refresh.includes("response.version < request.expectedVersion") &&
    refresh.includes(
      "response.identity.revisionNumber < request.identity.revisionNumber",
    ) &&
    refresh.includes("DIVERGENT_DUPLICATE_RESPONSE"),
  "Stable identity, monotonic version/revision, idempotent exact duplicate, divergent duplicate conflict.",
);
check(
  "refresh.no-auto-resolution-no-write",
  refresh.includes("automaticConflictResolutionAllowed: false") &&
    refresh.includes("writeEndpointsAllowed: false") &&
    !/(POST|PATCH|PUT|DELETE)/.test(refresh),
  "Conflict/block is fail-closed with no write endpoint or automatic resolution.",
);
check(
  "draft.three-actions-held",
  ["status", "comment", "assignment"].every((v) => draft.includes(`"${v}"`)) &&
    draft.includes('status: "REQUEST_DRAFT_ONLY"') &&
    draft.includes("mutationAllowed: false") &&
    draft.includes("authorityGranted: false") &&
    draft.includes("dispatchPerformed: false"),
  "Three action drafts are non-authorizing and undispatched.",
);
check(
  "draft.500-and-adversarial",
  draftTest.includes("for (let index = 0; index < 500; index += 1)") &&
    draftTest.includes("adversarialDenials") &&
    draftTest.includes("persistentTokenStoreAllowed: false"),
  "500 deterministic drafts and adversarial denial matrix with no persistent token store.",
);
check(
  "banner.six-states-accessible-bilingual",
  [
    "saving",
    "saved",
    "offline",
    "refreshing",
    "conflict",
    "action_blocked",
  ].every((v) => banner.includes(v)) &&
    banner.includes('type LensNextWorkflowBannerLocale = "en" | "es"') &&
    banner.includes('role={urgent ? "alert" : "status"}') &&
    banner.includes("aria-live") &&
    banner.includes("narrow-280px-wrap"),
  "Six states, English/Spanish, alert/status live regions, 280px responsive contract.",
);
check(
  "banner.lucide-buttons-no-io",
  banner.includes('from "lucide-react"') &&
    banner.includes('<button type="button"') &&
    banner.includes("writeBehavior: false") &&
    banner.includes("automaticConflictResolution: false") &&
    !/(fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|database)/i.test(
      banner,
    ),
  "Lucide icons, native buttons, pure display, zero I/O and no automatic resolution.",
);

const proofRuns = inputs
  .filter(([, rel]) => rel.includes("behavior"))
  .map(([role, rel]) => [role, run(process.execPath, [TSX, rel])]);
for (const [role, result] of proofRuns)
  check(
    `proof.${role}`,
    result.exitCode === 0 && parseLast(result)?.result === "PASS",
    { exitCode: result.exitCode, output: parseLast(result) ?? result.stdout },
  );
const proofMap = Object.fromEntries(
  proofRuns.map(([role, result]) => [role, parseLast(result)]),
);
check(
  "proof.refresh-matrix",
  proofMap["auto-refresh-behavior"]?.states?.length === 6 &&
    proofMap["auto-refresh-behavior"]?.authenticatedGetOnly === true &&
    proofMap["auto-refresh-behavior"]?.retryAttempts === 4 &&
    proofMap["auto-refresh-behavior"]?.maximumIssues === 500 &&
    proofMap["auto-refresh-behavior"]?.duplicateIdempotent === true &&
    proofMap["auto-refresh-behavior"]?.writeEndpoints === 0,
  proofMap["auto-refresh-behavior"],
);
check(
  "proof.draft-matrix",
  proofMap["action-draft-behavior"]?.accepted === 3 &&
    proofMap["action-draft-behavior"]?.draftBatch === 500 &&
    proofMap["action-draft-behavior"]?.adversarialDenials === 20 &&
    proofMap["action-draft-behavior"]?.mutationAllowed === false,
  proofMap["action-draft-behavior"],
);
check(
  "proof.banner-matrix",
  proofMap["workflow-banner-behavior"]?.renderedStates === 6 &&
    proofMap["workflow-banner-behavior"]?.locales === 2 &&
    proofMap["workflow-banner-behavior"]?.urgentAlerts === 2 &&
    proofMap["workflow-banner-behavior"]?.nativeButtons === 2 &&
    proofMap["workflow-banner-behavior"]?.writeBehavior === false,
  proofMap["workflow-banner-behavior"],
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
  NODE_TYPES,
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
  "tests/lens-next-next/verify-web-workflow-successor.mjs",
]);
check("proof.prettier", prettier.exitCode === 0, {
  exitCode: prettier.exitCode,
});
const diff = run("git", [
  "diff",
  "--check",
  "--",
  ...inputs.map(([, rel]) => rel),
  "tests/lens-next-next/verify-web-workflow-successor.mjs",
  "evidence/lens-next/20260812/next-phase-integration/web-workflow-successor-terminal-receipt.json",
]);
check("proof.diff", diff.exitCode === 0, { exitCode: diff.exitCode });
const prior = JSON.parse(text(EXECUTOR_RECEIPT));
check(
  "prior.api-web-executor-rebind",
  hash(abs(EXECUTOR_RECEIPT)) ===
    "898DEEACDF1284FA7CA68575F11644CC9E4C703AE0C57C351B99872202BF4FC8" &&
    prior.status ===
      "PASS_SANDBOX_EXECUTOR_ACCEPTANCE_NO_PRODUCTION_AUTHORITY" &&
    prior.totals.failed === 0,
  {
    path: EXECUTOR_RECEIPT,
    sha256: hash(abs(EXECUTOR_RECEIPT)),
    status: prior.status,
  },
);
const badChars = new RegExp(
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
    text("tests/lens-next-next/verify-web-workflow-successor.mjs"),
  ].some((v) => badChars.test(v)),
  "No mojibake sentinel matches.",
);

const failed = checks.filter((v) => !v.passed);
const manifest = inputs
  .map(([, rel, bytes, sha]) => `${rel}|${bytes}|${sha}`)
  .join("\n");
const receipt = {
  schemaVersion: "bimlog-lens-next-web-workflow-successor-terminal-v1",
  generatedAtUtc: new Date().toISOString(),
  status: failed.length
    ? "FAIL_CLOSED"
    : "PASS_WEB_WORKFLOW_CONTRACTS_NO_MUTATION_AUTHORITY",
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
    webContractsAccepted: failed.length === 0,
    mutationAllowed: false,
    authorityGranted: false,
    productionWriteAllowed: false,
    realIoAllowed: false,
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
