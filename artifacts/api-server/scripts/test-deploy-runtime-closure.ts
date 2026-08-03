import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  access,
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { deployRuntimeClosure } from "../build";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "../../..");
const testRoot = path.join(workspaceRoot, "tmp", "deploy-runtime-closure-nosqlite-focused");
const tsxCli = path.join(workspaceRoot, "artifacts", "api-server", "node_modules", "tsx", "dist", "cli.mjs");

type Fixture = {
  root: string;
  sourceRoot: string;
  runtimeDir: string;
  evidenceDir: string;
  storeDir: string;
  fakePnpm: string;
  fakePnpmMarker: string;
  externalPackage: string;
  transitivePackage: string;
  lockPath: string;
};

async function writeFixtureFile(root: string, relative: string, content: string | Uint8Array) {
  const target = path.join(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}

async function createFixture(
  label: string,
  largeFiles: { count: number; bytes: number } | null = null,
): Promise<Fixture> {
  await mkdir(testRoot, { recursive: true });
  const root = await mkdtemp(path.join(testRoot, `${label}-`));
  const sourceRoot = path.join(root, "source");
  const apiRoot = path.join(sourceRoot, "artifacts", "api-server");
  await writeFixtureFile(sourceRoot, "package.json", JSON.stringify({ private: true }));
  await writeFixtureFile(
    sourceRoot,
    "pnpm-lock.yaml",
    `lockfileVersion: '9.0'
importers:
  artifacts/api-server:
    dependencies:
      '@workspace/api-zod':
        specifier: workspace:*
        version: link:../../lib/api-zod
      '@workspace/db':
        specifier: workspace:*
        version: link:../../lib/db
      fixture-external:
        specifier: 1.0.0
        version: 1.0.0
packages:
  fixture-external@1.0.0:
    resolution: {integrity: sha512-fixture-external}
    dependencies:
      fixture-transitive: 1.0.0
  fixture-transitive@1.0.0:
    resolution: {integrity: sha512-fixture-transitive}
snapshots:
  fixture-external@1.0.0:
    dependencies:
      fixture-transitive: 1.0.0
  fixture-transitive@1.0.0: {}
`,
  );
  await writeFixtureFile(
    sourceRoot,
    "artifacts/api-server/package.json",
    JSON.stringify({
      name: "@workspace/api-server",
      version: "1.0.0",
      type: "module",
      dependencies: {
        "@workspace/api-zod": "workspace:*",
        "@workspace/db": "workspace:*",
        "fixture-external": "1.0.0",
      },
    }),
  );
  await writeFixtureFile(sourceRoot, "artifacts/api-server/dist/index.cjs", "module.exports = {};\n");
  await writeFixtureFile(sourceRoot, "artifacts/api-server/dist/index.meta.json", "{}\n");
  await writeFixtureFile(sourceRoot, "lib/api-zod/package.json", JSON.stringify({ name: "@workspace/api-zod", version: "1.0.0" }));
  await writeFixtureFile(sourceRoot, "lib/api-zod/src/index.ts", "export {};\n");
  await writeFixtureFile(sourceRoot, "lib/db/package.json", JSON.stringify({ name: "@workspace/db", version: "1.0.0" }));
  await writeFixtureFile(sourceRoot, "lib/db/src/index.ts", "export {};\n");
  const virtualStore = path.join(sourceRoot, "node_modules", ".pnpm");
  const externalPackage = path.join(
    virtualStore,
    "fixture-external@1.0.0",
    "node_modules",
    "fixture-external",
  );
  const transitivePackage = path.join(
    virtualStore,
    "fixture-transitive@1.0.0",
    "node_modules",
    "fixture-transitive",
  );
  await writeFixtureFile(
    externalPackage,
    "package.json",
    JSON.stringify({ name: "fixture-external", version: "1.0.0", dependencies: { "fixture-transitive": "1.0.0" } }),
  );
  await writeFixtureFile(externalPackage, "index.js", "module.exports = require('fixture-transitive');\n");
  await writeFixtureFile(
    transitivePackage,
    "package.json",
    JSON.stringify({ name: "fixture-transitive", version: "1.0.0" }),
  );
  await writeFixtureFile(transitivePackage, "index.js", "module.exports = 'ok';\n");
  await mkdir(path.join(externalPackage, "node_modules"), { recursive: true });
  await symlink(
    transitivePackage,
    path.join(externalPackage, "node_modules", "fixture-transitive"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await mkdir(path.join(apiRoot, "node_modules"), { recursive: true });
  await symlink(
    externalPackage,
    path.join(apiRoot, "node_modules", "fixture-external"),
    process.platform === "win32" ? "junction" : "dir",
  );
  if (largeFiles) {
    const bytes = Buffer.alloc(largeFiles.bytes, 0x5a);
    for (let index = 0; index < largeFiles.count; index += 1) {
      await writeFixtureFile(
        externalPackage,
        `material/large-${String(index).padStart(3, "0")}.bin`,
        bytes,
      );
    }
  }
  const storeDir = path.join(root, "read-only-store");
  await writeFixtureFile(storeDir, "v11/index.db", "immutable-store-sentinel\n");
  await chmod(path.join(storeDir, "v11", "index.db"), 0o444);
  const fakePnpmMarker = path.join(root, "fake-pnpm-invoked.txt");
  const fakePnpm = path.join(root, "must-not-run-pnpm.cjs");
  await writeFile(
    fakePnpm,
    `require("node:fs").writeFileSync(${JSON.stringify(fakePnpmMarker)}, "invoked\\n"); process.exit(97);\n`,
  );
  return {
    root,
    sourceRoot,
    runtimeDir: path.join(root, "output", "runtime"),
    evidenceDir: path.join(root, "output", "runtime-closure-evidence"),
    storeDir,
    fakePnpm,
    fakePnpmMarker,
    externalPackage,
    transitivePackage,
    lockPath: path.join(sourceRoot, "pnpm-lock.yaml"),
  };
}

async function sha256(filePath: string) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function pathExists(filePath: string) {
  return access(filePath).then(
    () => true,
    () => false,
  );
}

async function waitForPath(filePath: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (!(await pathExists(filePath)) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(await pathExists(filePath), true, `${filePath} was not materialized within ${timeoutMs}ms`);
}

function processExists(processId: number) {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function invokeFixture(
  fixture: Fixture,
  options: {
    timeoutMs?: number;
    signal?: AbortSignal;
    onPhaseChange?: (phase: "assembly-copy" | "assembly-hash" | "validation") => void | Promise<void>;
  } = {},
) {
  const previousTemp = process.env.BIMLOG_BUILD_TEMP_ROOT;
  const previousStore = process.env.npm_config_store_dir;
  const previousNpmExecPath = process.env.npm_execpath;
  process.env.BIMLOG_BUILD_TEMP_ROOT = path.join(fixture.root, "build-temp");
  process.env.npm_config_store_dir = fixture.storeDir;
  process.env.npm_execpath = fixture.fakePnpm;
  try {
    await deployRuntimeClosure(fixture.runtimeDir, ["fixture-external"], {
      workspaceRoot: fixture.sourceRoot,
      evidenceDir: fixture.evidenceDir,
      timeoutMs: options.timeoutMs ?? 5_000,
      signal: options.signal,
      onPhaseChange: options.onPhaseChange,
    });
  } finally {
    if (previousTemp === undefined) delete process.env.BIMLOG_BUILD_TEMP_ROOT;
    else process.env.BIMLOG_BUILD_TEMP_ROOT = previousTemp;
    if (previousStore === undefined) delete process.env.npm_config_store_dir;
    else process.env.npm_config_store_dir = previousStore;
    if (previousNpmExecPath === undefined) delete process.env.npm_execpath;
    else process.env.npm_execpath = previousNpmExecPath;
  }
}

async function readReceipt(fixture: Fixture) {
  return JSON.parse(await readFile(path.join(fixture.evidenceDir, "runtime-closure-receipt.json"), "utf8"));
}

async function runChildNonzero(fixtureRoot: string) {
  const fixture: Fixture = {
    root: fixtureRoot,
    sourceRoot: path.join(fixtureRoot, "source"),
    runtimeDir: path.join(fixtureRoot, "child-output", "runtime"),
    evidenceDir: path.join(fixtureRoot, "child-output", "evidence"),
    storeDir: path.join(fixtureRoot, "read-only-store"),
    fakePnpm: path.join(fixtureRoot, "must-not-run-pnpm.cjs"),
    fakePnpmMarker: path.join(fixtureRoot, "fake-pnpm-invoked.txt"),
    externalPackage: path.join(fixtureRoot, "source", "node_modules", ".pnpm", "fixture-external@1.0.0", "node_modules", "fixture-external"),
    transitivePackage: path.join(fixtureRoot, "source", "node_modules", ".pnpm", "fixture-transitive@1.0.0", "node_modules", "fixture-transitive"),
    lockPath: path.join(fixtureRoot, "source", "pnpm-lock.yaml"),
  };
  await rm(path.join(fixture.sourceRoot, "lib", "db", "src"), { recursive: true, force: true });
  await mkdir(path.join(fixture.sourceRoot, "lib", "db", "src"), { recursive: true });
  try {
    await invokeFixture(fixture);
    process.exit(0);
  } catch {
    process.exit(7);
  }
}

if (process.argv[2] === "--child-nonzero") {
  await runChildNonzero(process.argv[3]);
}

const results: Array<Record<string, unknown>> = [];

const success = await createFixture("success");
const storeSentinel = path.join(success.storeDir, "v11", "index.db");
const storeBefore = await sha256(storeSentinel);
const lockBefore = await sha256(success.lockPath);
await invokeFixture(success);
const successReceipt = await readReceipt(success);
assert.equal(successReceipt.status, "PASS");
assert.equal(successReceipt.process, null);
assert.equal(successReceipt.assembly.strategy, "installed-package-graph");
assert.equal(successReceipt.assembly.timeoutSemantics, "abortable-stream-copy");
assert.equal(successReceipt.assembly.childProcessCount, 0);
assert.equal(successReceipt.assembly.processTreeClosed, true);
assert.equal(successReceipt.assembly.lockfileSha256, lockBefore);
assert.deepEqual(
  successReceipt.assembly.graphBindings.map((binding: { name: string }) => binding.name).sort(),
  ["@workspace/api-zod", "@workspace/db", "fixture-external", "fixture-transitive"],
);
for (const binding of successReceipt.assembly.graphBindings) {
  assert.match(binding.contentSha256, /^[a-f0-9]{64}$/);
  assert.equal(path.isAbsolute(binding.sourceRealpath), true);
}
const externalBinding = successReceipt.assembly.graphBindings.find(
  (binding: { name: string }) => binding.name === "fixture-external",
);
const transitiveBinding = successReceipt.assembly.graphBindings.find(
  (binding: { name: string }) => binding.name === "fixture-transitive",
);
assert.equal(externalBinding.version, "1.0.0");
assert.equal(externalBinding.declaredSpec, "1.0.0");
assert.equal(externalBinding.lockKey, "fixture-external@1.0.0");
assert.equal(externalBinding.sourceRealpath, await realpath(success.externalPackage));
assert.equal(transitiveBinding.lockKey, "fixture-transitive@1.0.0");
assert.equal(transitiveBinding.sourceRealpath, await realpath(success.transitivePackage));
assert.ok(successReceipt.closure.dependencyCount >= 3);
assert.ok(successReceipt.closure.workspaceSourceCounts["@workspace/api-zod"] > 0);
assert.ok(successReceipt.closure.workspaceSourceCounts["@workspace/db"] > 0);
assert.equal(await sha256(storeSentinel), storeBefore);
assert.equal(await sha256(success.lockPath), lockBefore);
assert.equal(await pathExists(success.fakePnpmMarker), false);
assert.equal(
  (await lstat(path.join(success.sourceRoot, "artifacts", "api-server", "node_modules", "fixture-external"))).isSymbolicLink(),
  true,
);
assert.equal(
  (await lstat(path.join(success.externalPackage, "node_modules", "fixture-transitive"))).isSymbolicLink(),
  true,
);
assert.equal(
  JSON.parse(await readFile(path.join(success.runtimeDir, "node_modules", "fixture-external", "node_modules", "fixture-transitive", "package.json"), "utf8")).name,
  "fixture-transitive",
);
results.push({ label: "success-read-only-store", status: "PASS" });

const fileDescriptor = await createFixture("file-descriptor-lock-binding");
await writeFixtureFile(
  fileDescriptor.sourceRoot,
  "artifacts/api-server/package.json",
  JSON.stringify({
    name: "@workspace/api-server",
    version: "1.0.0",
    type: "module",
    dependencies: {
      "@workspace/api-zod": "workspace:*",
      "@workspace/db": "workspace:*",
      "fixture-external": "file:../../vendor/fixture-external.tgz",
    },
  }),
);
await writeFixtureFile(
  fileDescriptor.sourceRoot,
  "pnpm-lock.yaml",
  (await readFile(fileDescriptor.lockPath, "utf8"))
    .replace(
      "      fixture-external:\n        specifier: 1.0.0\n        version: 1.0.0",
      "      fixture-external:\n        specifier: file:../../vendor/fixture-external.tgz\n        version: file:vendor/fixture-external.tgz",
    )
    .replaceAll("fixture-external@1.0.0", "fixture-external@file:vendor/fixture-external.tgz")
    .replace(
      "  fixture-external@file:vendor/fixture-external.tgz:\n    resolution: {integrity: sha512-fixture-external}",
      "  fixture-external@file:vendor/fixture-external.tgz:\n    resolution: {integrity: sha512-fixture-external}\n    version: 1.0.0",
    ),
);
await invokeFixture(fileDescriptor);
const fileDescriptorReceipt = await readReceipt(fileDescriptor);
assert.equal(fileDescriptorReceipt.status, "PASS");
assert.equal(
  fileDescriptorReceipt.assembly.graphBindings.find(
    (binding: { name: string }) => binding.name === "fixture-external",
  ).lockKey,
  "fixture-external@file:vendor/fixture-external.tgz",
);
results.push({ label: "file-descriptor-lock-binding", status: "PASS" });

const peerQualified = await createFixture("peer-qualified-direct-importer");
const peerLockText = (await readFile(peerQualified.lockPath, "utf8")).replace(
  "      fixture-external:\n        specifier: 1.0.0\n        version: 1.0.0",
  "      fixture-external:\n        specifier: 1.0.0\n        version: 1.0.0(peer-helper@2.0.0)",
);
const peerSnapshotsOffset = peerLockText.indexOf("snapshots:\n");
assert.notEqual(peerSnapshotsOffset, -1);
await writeFixtureFile(
  peerQualified.sourceRoot,
  "pnpm-lock.yaml",
  peerLockText.slice(0, peerSnapshotsOffset) +
    peerLockText.slice(peerSnapshotsOffset).replace(
      "  fixture-external@1.0.0:",
      "  fixture-external@1.0.0(peer-helper@2.0.0):",
    ),
);
await invokeFixture(peerQualified);
const peerReceipt = await readReceipt(peerQualified);
const peerBinding = peerReceipt.assembly.graphBindings.find(
  (binding: { name: string }) => binding.name === "fixture-external",
);
assert.equal(peerBinding.packageLockKey, "fixture-external@1.0.0");
assert.equal(peerBinding.snapshotLockKey, "fixture-external@1.0.0(peer-helper@2.0.0)");
assert.equal(peerBinding.lockKey, peerBinding.snapshotLockKey);
assert.equal(
  JSON.parse(await readFile(path.join(
    peerQualified.runtimeDir,
    "node_modules",
    "fixture-external",
    "node_modules",
    "fixture-transitive",
    "package.json",
  ), "utf8")).name,
  "fixture-transitive",
);
results.push({ label: "peer-qualified-snapshot-transitive-issuer", status: "PASS" });

const peerSnapshotMismatch = await createFixture("peer-qualified-snapshot-missing");
await writeFixtureFile(
  peerSnapshotMismatch.sourceRoot,
  "pnpm-lock.yaml",
  (await readFile(peerSnapshotMismatch.lockPath, "utf8")).replace(
    "      fixture-external:\n        specifier: 1.0.0\n        version: 1.0.0",
    "      fixture-external:\n        specifier: 1.0.0\n        version: 1.0.0(peer-helper@2.0.0)",
  ),
);
await assert.rejects(
  invokeFixture(peerSnapshotMismatch),
  /pnpm-lock\.yaml exact snapshot is missing: fixture-external@1\.0\.0\(peer-helper@2\.0\.0\)/,
);
assert.equal((await readReceipt(peerSnapshotMismatch)).status, "FAIL");
results.push({ label: "peer-qualified-snapshot-mismatch", status: "PASS" });

const incomplete = await createFixture("incomplete");
await rm(path.join(incomplete.sourceRoot, "lib", "db", "src", "index.ts"));
await mkdir(path.join(incomplete.sourceRoot, "lib", "db", "src", "directory-only"));
await assert.rejects(invokeFixture(incomplete), /contains no regular files: @workspace\/db/);
assert.equal((await readReceipt(incomplete)).status, "FAIL");
assert.equal(await pathExists(incomplete.fakePnpmMarker), false);
results.push({ label: "incomplete-closure", status: "PASS" });

const staleManifest = await createFixture("stale-manifest-version");
await writeFixtureFile(
  staleManifest.externalPackage,
  "package.json",
  JSON.stringify({
    name: "fixture-external",
    version: "0.9.0",
    dependencies: { "fixture-transitive": "1.0.0" },
  }),
);
await assert.rejects(
  invokeFixture(staleManifest),
  /(?:installed package|manifest).*version.*fixture-external|fixture-external.*version.*(?:lock|expected)/i,
);
assert.equal((await readReceipt(staleManifest)).status, "FAIL");
assert.equal(await pathExists(staleManifest.fakePnpmMarker), false);
results.push({ label: "stale-manifest-version", status: "PASS" });

const lockMismatch = await createFixture("lock-version-mismatch");
await writeFixtureFile(
  lockMismatch.sourceRoot,
  "pnpm-lock.yaml",
  (await readFile(lockMismatch.lockPath, "utf8")).replaceAll(
    "fixture-external@1.0.0",
    "fixture-external@2.0.0",
  ),
);
await assert.rejects(
  invokeFixture(lockMismatch),
  /Installed package is not unambiguously bound to pnpm-lock\.yaml: fixture-external@1\.0\.0/,
);
assert.equal((await readReceipt(lockMismatch)).status, "FAIL");
assert.equal(await pathExists(lockMismatch.fakePnpmMarker), false);
results.push({ label: "lock-version-mismatch", status: "PASS" });

const importerEdgeMismatch = await createFixture("importer-edge-mismatch");
await writeFixtureFile(
  importerEdgeMismatch.sourceRoot,
  "pnpm-lock.yaml",
  (await readFile(importerEdgeMismatch.lockPath, "utf8")).replace(
    "      fixture-external:\n        specifier: 1.0.0\n        version: 1.0.0",
    "      fixture-external:\n        specifier: 1.0.0\n        version: 2.0.0",
  ),
);
await assert.rejects(
  invokeFixture(importerEdgeMismatch),
  /pnpm-lock\.yaml importer version mismatch for fixture-external@1\.0\.0/,
);
assert.equal((await readReceipt(importerEdgeMismatch)).status, "FAIL");
results.push({ label: "importer-edge-version-mismatch", status: "PASS" });

const issuerEdgeMismatch = await createFixture("issuer-edge-mismatch");
const issuerLockText = await readFile(issuerEdgeMismatch.lockPath, "utf8");
const snapshotsMarker = "snapshots:\n";
const snapshotsOffset = issuerLockText.indexOf(snapshotsMarker);
assert.notEqual(snapshotsOffset, -1);
await writeFixtureFile(
  issuerEdgeMismatch.sourceRoot,
  "pnpm-lock.yaml",
  issuerLockText.slice(0, snapshotsOffset + snapshotsMarker.length) +
    issuerLockText.slice(snapshotsOffset + snapshotsMarker.length).replace(
      "      fixture-transitive: 1.0.0",
      "      fixture-transitive: 2.0.0",
    ),
);
await assert.rejects(
  invokeFixture(issuerEdgeMismatch),
  /pnpm-lock\.yaml dependency edge mismatch: fixture-external@1\.0\.0 -> fixture-transitive@1\.0\.0/,
);
assert.equal((await readReceipt(issuerEdgeMismatch)).status, "FAIL");
results.push({ label: "issuer-edge-version-mismatch", status: "PASS" });

const outOfRange = await createFixture("out-of-range-present-in-lock");
await writeFixtureFile(
  outOfRange.externalPackage,
  "package.json",
  JSON.stringify({
    name: "fixture-external",
    version: "9.0.0",
    dependencies: { "fixture-transitive": "1.0.0" },
  }),
);
await writeFixtureFile(
  outOfRange.sourceRoot,
  "artifacts/api-server/package.json",
  JSON.stringify({
    name: "@workspace/api-server",
    version: "1.0.0",
    type: "module",
    dependencies: {
      "@workspace/api-zod": "workspace:*",
      "@workspace/db": "workspace:*",
      "fixture-external": "^8.20.0",
    },
  }),
);
await writeFixtureFile(
  outOfRange.sourceRoot,
  "pnpm-lock.yaml",
  (await readFile(outOfRange.lockPath, "utf8"))
    .replace("specifier: 1.0.0\n        version: 1.0.0\npackages:", "specifier: ^8.20.0\n        version: 9.0.0\npackages:")
    .replaceAll("fixture-external@1.0.0", "fixture-external@9.0.0"),
);
await assert.rejects(
  invokeFixture(outOfRange),
  /does not satisfy its declared spec: fixture-external expected \^8\.20\.0, received 9\.0\.0/,
);
assert.equal((await readReceipt(outOfRange)).status, "FAIL");
assert.equal(await pathExists(outOfRange.fakePnpmMarker), false);
results.push({ label: "out-of-range-version-present-in-lock", status: "PASS" });

const escaped = await createFixture("escape");
const outside = path.join(escaped.root, "outside-package");
await writeFixtureFile(outside, "outside.txt", "outside\n");
await symlink(
  outside,
  path.join(escaped.sourceRoot, "artifacts", "api-server", "node_modules", "fixture-external", "escape"),
  process.platform === "win32" ? "junction" : "dir",
);
await assert.rejects(invokeFixture(escaped), /Package content link escapes its package/);
assert.equal((await readReceipt(escaped)).status, "FAIL");
assert.equal(await pathExists(escaped.fakePnpmMarker), false);
results.push({ label: "path-escape", status: "PASS" });

const cancellation = await createFixture("cancel-large-file", {
  count: 4,
  bytes: 32 * 1024 * 1024,
});
const controller = new AbortController();
const cancellationInvocation = invokeFixture(cancellation, {
  signal: controller.signal,
  timeoutMs: 30_000,
});
const cancellationSettled = cancellationInvocation.then(
  () => null,
  error => error,
);
await waitForPath(
  path.join(
    cancellation.runtimeDir,
    "node_modules",
    "fixture-external",
    "material",
    "large-000.bin",
  ),
  10_000,
);
controller.abort();
const cancellationError = await cancellationSettled;
assert(cancellationError instanceof Error);
assert.match(cancellationError.message, /cancelled/i);
const cancelReceipt = await readReceipt(cancellation);
assert.equal(cancelReceipt.status, "FAIL");
assert.equal(cancelReceipt.process, null);
assert.equal(cancelReceipt.assembly.childProcessCount, 0);
assert.equal(cancelReceipt.assembly.processTreeClosed, true);
assert.equal(cancelReceipt.assembly.cancelled, true);
assert.equal(await pathExists(cancellation.fakePnpmMarker), false);
results.push({ label: "large-file-cooperative-cancellation-zero-children", status: "PASS" });

const hashCancellation = await createFixture("hash-cancellation", {
  count: 4,
  bytes: 32 * 1024 * 1024,
});
const hashController = new AbortController();
let hashPhaseCount = 0;
await assert.rejects(
  invokeFixture(hashCancellation, {
    signal: hashController.signal,
    timeoutMs: 30_000,
    onPhaseChange: phase => {
      if (phase === "assembly-hash" && ++hashPhaseCount === 3) hashController.abort();
    },
  }),
  /hashing was cancelled/i,
);
const hashCancelReceipt = await readReceipt(hashCancellation);
assert.equal(hashCancelReceipt.status, "FAIL");
assert.equal(hashCancelReceipt.assembly.cancelled, true);
assert.equal(hashCancelReceipt.process, null);
assert.equal(hashCancelReceipt.assembly.childProcessCount, 0);
assert.equal(await pathExists(hashCancellation.fakePnpmMarker), false);
results.push({ label: "hashing-phase-cancellation-zero-children", status: "PASS" });

const hashTimeout = await createFixture("hash-timeout", {
  count: 4,
  bytes: 32 * 1024 * 1024,
});
let timeoutHashCount = 0;
await assert.rejects(
  invokeFixture(hashTimeout, {
    timeoutMs: 500,
    onPhaseChange: async phase => {
      if (phase === "assembly-hash" && ++timeoutHashCount === 3) {
        await new Promise(resolve => setTimeout(resolve, 550));
      }
    },
  }),
  /timed out|hashing was cancelled/i,
);
const hashTimeoutReceipt = await readReceipt(hashTimeout);
assert.equal(hashTimeoutReceipt.status, "FAIL");
assert.equal(hashTimeoutReceipt.assembly.timedOut, true);
assert.equal(hashTimeoutReceipt.process, null);
assert.equal(hashTimeoutReceipt.assembly.childProcessCount, 0);
assert.equal(await pathExists(hashTimeout.fakePnpmMarker), false);
results.push({ label: "hashing-phase-timeout-zero-children", status: "PASS" });

const validationTimeout = await createFixture("validation-timeout");
let validationPhaseObserved = false;
await assert.rejects(
  invokeFixture(validationTimeout, {
    timeoutMs: 500,
    onPhaseChange: async phase => {
      if (phase === "validation" && !validationPhaseObserved) {
        validationPhaseObserved = true;
        await new Promise(resolve => setTimeout(resolve, 550));
      }
    },
  }),
  /timed out|validation was cancelled/i,
);
assert.equal(validationPhaseObserved, true);
const validationTimeoutReceipt = await readReceipt(validationTimeout);
assert.equal(validationTimeoutReceipt.status, "FAIL");
assert.equal(validationTimeoutReceipt.assembly.timedOut, true);
assert.equal(validationTimeoutReceipt.closure, null);
assert.equal(validationTimeoutReceipt.process, null);
assert.equal(validationTimeoutReceipt.assembly.childProcessCount, 0);
assert.equal(await pathExists(validationTimeout.fakePnpmMarker), false);
results.push({ label: "validation-phase-timeout-fail-closed", status: "PASS" });

const timeout = await createFixture("timeout-large-file", {
  count: 4,
  bytes: 32 * 1024 * 1024,
});
const timeoutStartedAt = Date.now();
const timeoutError = await invokeFixture(timeout, { timeoutMs: 25 }).then(
  () => null,
  error => error,
);
const timeoutElapsedMs = Date.now() - timeoutStartedAt;
assert(timeoutError instanceof Error);
assert.match(timeoutError.message, /^Runtime graph assembly timed out after \d+ms\.$/);
assert(timeoutElapsedMs < 5_000, `timeout fixture exceeded its bounded terminal window: ${timeoutElapsedMs}ms`);
const timeoutReceipt = await readReceipt(timeout);
assert.equal(timeoutReceipt.status, "FAIL");
assert.equal(timeoutReceipt.failure, timeoutError.message);
assert.equal(timeoutReceipt.process, null);
assert.equal(timeoutReceipt.assembly.timeoutSemantics, "abortable-stream-copy");
assert.equal(timeoutReceipt.assembly.timedOut, true);
assert.equal(timeoutReceipt.assembly.cancelled, false);
assert.equal(timeoutReceipt.assembly.childProcessCount, 0);
assert.equal(timeoutReceipt.assembly.processTreeClosed, true);
assert(timeoutReceipt.assembly.elapsedMs < 5_000);
assert.equal(await pathExists(timeout.fakePnpmMarker), false);
results.push({
  label: "large-file-timeout-zero-children",
  status: "PASS",
  elapsedMs: timeoutElapsedMs,
});

const nonzero = await createFixture("nonzero");
const child = spawnSync(process.execPath, [tsxCli, __filename, "--child-nonzero", nonzero.root], {
  cwd: workspaceRoot,
  encoding: "utf8",
  timeout: 30_000,
  windowsHide: true,
});
assert.equal(child.status, 7, `expected child exit 7; stdout=${child.stdout}; stderr=${child.stderr}`);
assert.equal(child.signal, null);
assert.equal(processExists(child.pid), false, `failure-injection child ${child.pid} survived`);
assert.equal(await pathExists(nonzero.fakePnpmMarker), false);
const childReceipt = JSON.parse(
  await readFile(
    path.join(nonzero.root, "child-output", "evidence", "runtime-closure-receipt.json"),
    "utf8",
  ),
);
assert.equal(childReceipt.status, "FAIL");
assert.equal(childReceipt.process, null);
assert.equal(childReceipt.assembly.childProcessCount, 0);
assert.equal(childReceipt.assembly.processTreeClosed, true);
results.push({ label: "invalid-graph-nonzero-exit", status: "PASS", exitCode: child.status });

console.log(JSON.stringify({ status: "PASS", cases: results, pnpmInvoked: false, networkOrInstallInvoked: false }, null, 2));
