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
  "connection-telemetry-view-terminal-receipt.json",
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
    "connection-telemetry-view",
    "artifacts/bimlog/src/features/lens-next/LensNextConnectionTelemetryView.tsx",
    9184,
    "B0B1893CECAB59942058B36FB07E6E9ABA66BE824EF8FD54A86F06EC30177A15",
  ],
  [
    "connection-telemetry-view-behavior",
    "artifacts/bimlog/scripts/lens-next/lens-next-connection-telemetry-view.behavior.tsx",
    3747,
    "63F28A428C7A6B33EF50815AB51124ABE38D73D1CE4CF11D00B3B321DB30C97A",
  ],
];
const prior = [
  "evidence/lens-next/20260812/next-phase-integration/web-workflow-successor-terminal-receipt.json",
  11098,
  "60EB976CED230800510BF10D5C49A72F13603A9A9B1F541C23D4DC0459F9E6E0",
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
const states = [
  "connected",
  "refreshing",
  "saved",
  "offline_retry",
  "conflict_blocked",
  "action_blocked",
];
check(
  "source.states-locales-single-callback",
  states.every((state) => view.includes(`\"${state}\"`)) &&
    view.includes('locale: "en" | "es"') &&
    view.includes("onRequestRefresh: () => void") &&
    !/(on[A-Z][A-Za-z]+): \(\) => void/g.test(
      view.replace("onRequestRefresh: () => void", ""),
    ),
  "Six telemetry states, two locales, and one presentational refresh callback are exposed.",
);
check(
  "source.presentational-refresh-only",
  view.includes("Request read-only refresh") &&
    /<button[\s\S]*?type="button"/.test(view) &&
    view.includes('disabled={state === "refreshing"}') &&
    !/(onSubmit|onDispatch|onExecute|onMutate|onWrite)/.test(view),
  "The only control requests a read-only refresh and is disabled while refresh is in flight.",
);
check(
  "source.default-deny",
  [
    "sessionTokenRendered: false",
    "callbackDispatchesNetwork: false",
    "mutationAllowed: false",
    "actionDraftBehavior: false",
    "storageBehavior: false",
    "persistenceBehavior: false",
    "visualMutationAllowed: false",
  ].every((value) => view.includes(value)) &&
    view.includes("never exposes a session token") &&
    view.includes("changes visual state") &&
    view.includes("enables a mutation"),
  "Token rendering, network dispatch, mutation, persistence, storage, and visual mutation are denied.",
);
check(
  "source.no-token-or-io-adapter",
  !/(sessionToken\s*:|authorization\s*:|bearer\s+|fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|navigator\.sendBeacon|\.write\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\()/i.test(
    view,
  ),
  "No token value, network, persistence, or mutation adapter exists in the view source.",
);
check(
  "source.behavior-coverage",
  behavior.includes("states: states.length") &&
    behavior.includes("locales: 2") &&
    behavior.includes("renders") &&
    behavior.includes("nativeRefreshButtons: 1") &&
    behavior.includes("sessionTokenRendered: false"),
  "The focused proof covers six states by two locales and one native refresh button.",
);

const focused = run(process.execPath, [TSX, inputs[1][1]]);
const proof = parseLastJsonLine(focused);
check(
  "proof.connection-telemetry-ssr",
  focused.exitCode === 0 &&
    proof?.result === "PASS" &&
    proof.states === 6 &&
    proof.locales === 2 &&
    proof.renders === 12 &&
    proof.nativeRefreshButtons === 1 &&
    proof.maximumIssues === 500 &&
    proof.sessionTokenRendered === false &&
    proof.callbackDispatchesNetwork === false &&
    proof.mutationAllowed === false &&
    proof.storageBehavior === false &&
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
  "tests/lens-next-next/verify-connection-telemetry-view.mjs",
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
  "tests/lens-next-next/verify-connection-telemetry-view.mjs",
  "evidence/lens-next/20260812/next-phase-integration/connection-telemetry-view-terminal-receipt.json",
]);
check("proof.diff", diff.exitCode === 0, {
  exitCode: diff.exitCode,
  stdout: diff.stdout,
  stderr: diff.stderr,
});

const [priorPath, priorBytes, priorSha256] = prior;
const priorFile = abs(priorPath);
const priorReceipt = JSON.parse(read(priorPath));
const priorActual = {
  bytes: fs.statSync(priorFile).size,
  sha256: hash(priorFile),
};
check(
  "prior.auto-refresh-workflow.rebind",
  priorActual.bytes === priorBytes &&
    priorActual.sha256 === priorSha256 &&
    priorReceipt.status ===
      "PASS_WEB_WORKFLOW_CONTRACTS_NO_MUTATION_AUTHORITY" &&
    priorReceipt.totals?.failed === 0 &&
    priorReceipt.safety?.pluginNativeBridgeSavedViewpointPathsReadOrTested ===
      false,
  {
    relativePath: priorPath,
    expected: { bytes: priorBytes, sha256: priorSha256 },
    actual: priorActual,
    status: priorReceipt.status,
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
    read("tests/lens-next-next/verify-connection-telemetry-view.mjs"),
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
  schemaVersion: "bimlog-lens-next-connection-telemetry-view-terminal-v1",
  generatedAtUtc: new Date().toISOString(),
  status: failed.length
    ? "FAIL_CLOSED"
    : "PASS_CONNECTION_TELEMETRY_PRESENTATIONAL_ZERO_IO_MUTATION",
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
    role: "auto-refresh-workflow",
    path: priorPath,
    bytes: priorBytes,
    sha256: priorSha256,
  },
  totals: {
    assertions: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
  },
  failedAssertionIds: failed.map((item) => item.id),
  checks,
  disposition: {
    connectionTelemetryViewAccepted: failed.length === 0,
    states: 6,
    locales: 2,
    presentationalRefreshCallbacks: 1,
    sessionTokenRendered: false,
    callbackDispatchesNetwork: false,
    mutationAllowed: false,
    storageOrPersistenceAllowed: false,
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
