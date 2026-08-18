import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "bimlog-feedback-storage-"));
const mutableFs: { lstatSync: typeof fs.lstatSync } = fs;
const checks = new Set<string>();
function passed(name: string) { assert.ok(!checks.has(name), `duplicate check: ${name}`); checks.add(name); }
try {
  process.env.NODE_ENV = "test"; process.env.BIMLOG_FEEDBACK_STORAGE_BACKEND = "local-test"; process.env.BIMLOG_FEEDBACK_UPLOAD_ROOT = root;
  const { LocalDiskStorageAdapter, createStorageFromEnvironment } = await import("./storage-adapter");
  const first = new LocalDiskStorageAdapter(root, { backendId: "fixture-shared", backendType: "durable-filesystem" });
  const bytes = Buffer.from([0, 255, 1, 2, 10, 13, 128]);
  const key = await first.upload(bytes, 101, "secret customer name.pdf");
  assert.match(key, /^[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{64}$/);
  assert.ok(!key.includes("secret") && !key.includes("101"));
  const reopened = new LocalDiskStorageAdapter(root, { backendId: "fixture-shared", backendType: "durable-filesystem" });
  assert.deepEqual(await reopened.download(key), bytes);
  assert.deepEqual(await reopened.downloadBounded(key, bytes.length), bytes, "exact limit must succeed");
  const emptyKey = await first.upload(Buffer.alloc(0), 101, "empty.bin"); assert.deepEqual(await reopened.downloadBounded(emptyKey, 1), Buffer.alloc(0)); passed("zero-byte bounded read");
  await assert.rejects(() => reopened.downloadBounded(key, bytes.length - 1), (error: NodeJS.ErrnoException) => error.code === "STORAGE_OBJECT_TOO_LARGE" && !error.message.includes(root), "one byte over must be denied without leaking paths");
  for (const invalid of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER]) await assert.rejects(() => reopened.downloadBounded(key, invalid), (error: NodeJS.ErrnoException) => error.code === "STORAGE_MAX_BYTES_INVALID");
  const mutableBytes = Buffer.alloc(128 * 1024, 7); const mutableKey = await first.upload(mutableBytes, 101, "mutable.bin"); const mutablePath = path.join(root, ...mutableKey.split("/"));
  const originalRead = fs.readSync, originalOpen = fs.openSync, originalFstat = fs.fstatSync, originalClose = fs.closeSync, originalLstat = fs.lstatSync;
  let changed = false; fs.readSync = ((...args: Parameters<typeof fs.readSync>) => { const count = originalRead(...args); if (!changed) { changed = true; fs.appendFileSync(mutablePath, Buffer.from([8])); } return count; }) as typeof fs.readSync;
  await assert.rejects(() => reopened.downloadBounded(mutableKey, mutableBytes.length + 1), (error: NodeJS.ErrnoException) => error.code === "STORAGE_OBJECT_CHANGED"); fs.readSync = originalRead;
  fs.writeFileSync(mutablePath, mutableBytes); changed = false; fs.readSync = ((...args: Parameters<typeof fs.readSync>) => { const count = originalRead(...args); if (!changed) { changed = true; fs.truncateSync(mutablePath, 1); } return count; }) as typeof fs.readSync;
  await assert.rejects(() => reopened.downloadBounded(mutableKey, mutableBytes.length), (error: NodeJS.ErrnoException) => error.code === "STORAGE_OBJECT_CHANGED"); fs.readSync = originalRead;
  fs.writeFileSync(mutablePath, mutableBytes); changed = false; fs.readSync = ((...args: Parameters<typeof fs.readSync>) => { const count = originalRead(...args); if (!changed) { changed = true; fs.renameSync(mutablePath, `${mutablePath}.old`); fs.writeFileSync(mutablePath, mutableBytes); } return count; }) as typeof fs.readSync;
  await assert.rejects(() => reopened.downloadBounded(mutableKey, mutableBytes.length), (error: NodeJS.ErrnoException) => error.code === "STORAGE_OBJECT_CHANGED"); fs.readSync = originalRead; fs.rmSync(`${mutablePath}.old`); fs.writeFileSync(mutablePath, mutableBytes);
  const residueBeforeFailures = fs.readdirSync(root, { recursive: true }).map(String).sort();
  for (const fault of ["open", "fstat", "read", "close"] as const) {
    let openedDescriptor: number | undefined, openedCount = 0, closedCount = 0;
    if (fault === "open") fs.openSync = (() => { throw new Error(`private ${root}`); }) as typeof fs.openSync;
    if (fault === "fstat") fs.fstatSync = (() => { throw new Error(`private ${root}`); }) as typeof fs.fstatSync;
    if (fault === "read") fs.readSync = (() => { throw new Error(`private ${root}`); }) as typeof fs.readSync;
    fs.closeSync = ((fd: number) => { originalClose(fd); closedCount++; if (fault === "close") throw new Error(`private ${root}`); }) as typeof fs.closeSync;
    fs.openSync = fault === "open" ? fs.openSync : ((...args: Parameters<typeof fs.openSync>) => { openedDescriptor = originalOpen(...args); openedCount++; return openedDescriptor; }) as typeof fs.openSync;
    await assert.rejects(() => reopened.downloadBounded(mutableKey, mutableBytes.length), (error: NodeJS.ErrnoException) => error.code === "STORAGE_OBJECT_READ_FAILED" && !error.message.includes(root), `${fault} failure must be sanitized`);
    fs.openSync = originalOpen; fs.fstatSync = originalFstat; fs.readSync = originalRead; fs.closeSync = originalClose;
    assert.equal(openedCount, fault === "open" ? 0 : 1); assert.equal(closedCount, openedCount, `${fault} must close every opened descriptor exactly once`);
    if (openedDescriptor !== undefined) assert.throws(() => originalFstat(openedDescriptor!), "failed reads must close their descriptor"); passed(`${fault} failure cleanup`);
  }
  for (let attempt = 0; attempt < 5; attempt++) { fs.readSync = ((...args: Parameters<typeof fs.readSync>) => { const count = originalRead(...args); fs.unlinkSync(mutablePath); return count; }) as typeof fs.readSync; await assert.rejects(() => reopened.downloadBounded(mutableKey, mutableBytes.length)); fs.readSync = originalRead; fs.writeFileSync(mutablePath, mutableBytes); }
  assert.deepEqual(fs.readdirSync(root, { recursive: true }).map(String).sort(), residueBeforeFailures, "failed reads and retries must leave the full storage inventory unchanged"); passed("full residue inventory");
  await assert.rejects(() => reopened.downloadBounded(`../${mutableKey}`, mutableBytes.length), /STORAGE_KEY_INVALID/, "Windows traversal must stay contained");
  const capped = new LocalDiskStorageAdapter(path.join(root, "capped"), { backendId: "capped-fixture", backendType: "durable-filesystem", maxReadBytes: 4 }); const cappedKey = await capped.upload(Buffer.from("four"), 1, "four.bin"); assert.deepEqual(await capped.downloadBounded(cappedKey, 4), Buffer.from("four")); await assert.rejects(() => capped.downloadBounded(cappedKey, 5), (error: NodeJS.ErrnoException) => error.code === "STORAGE_MAX_BYTES_EXCEEDS_BACKEND_LIMIT"); passed("governed backend cap");
  const moduleUrl = new URL("./storage-adapter.ts", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", `const {LocalDiskStorageAdapter}=await import(${JSON.stringify(moduleUrl)});const bytes=await new LocalDiskStorageAdapter(process.env.PROOF_ROOT).download(process.env.PROOF_KEY);process.stdout.write(bytes.toString("hex"));`], { cwd: path.resolve(import.meta.dirname, "../.."), env: { ...process.env, PROOF_ROOT: root, PROOF_KEY: key }, encoding: "utf8" });
  assert.equal(child.status, 0, child.error?.message || child.stderr); assert.equal(child.stdout, bytes.toString("hex"));
  await assert.rejects(() => reopened.delete(key, { retentionHold: true }), /STORAGE_RETENTION_HOLD_ACTIVE/);
  const health = await reopened.health(); assert.deepEqual(health.backupContract, { required: true, format: "opaque-key-v1", integrity: "sha256", restoreVerification: "exact-bytes-and-sha256" }); assert.ok(health.capabilities.includes("bounded-read")); assert.equal(health.maxReadBytes, 0x7fffffff); passed("sanitized bounded-read health authority");
  const keys = await Promise.all(Array.from({ length: 12 }, (_, index) => first.upload(Buffer.from(`instance-${index}`), 101, "same.txt")));
  assert.equal(new Set(keys).size, keys.length);
  assert.throws(() => createStorageFromEnvironment({ NODE_ENV: "production" }), /FEEDBACK_DURABLE_STORAGE_REQUIRED/);
  assert.throws(() => createStorageFromEnvironment({ NODE_ENV: "production", BIMLOG_FEEDBACK_STORAGE_BACKEND: "local-test", BIMLOG_FEEDBACK_UPLOAD_ROOT: root }), /FEEDBACK_DURABLE_STORAGE_REQUIRED/);
  assert.throws(() => createStorageFromEnvironment({ NODE_ENV: "production", BIMLOG_FEEDBACK_STORAGE_BACKEND: "durable-filesystem", BIMLOG_FEEDBACK_STORAGE_BACKEND_ID: "approved-fixture", BIMLOG_FEEDBACK_UPLOAD_ROOT: root }), /FEEDBACK_STORAGE_AUTHORITY_REQUIRED/);
  const authorityBase = process.platform === "win32" ? path.join(path.parse(process.cwd()).root, `bimlog-storage-proof-${randomUUID()}`) : path.join(os.homedir(), `.bimlog-storage-proof-${randomUUID()}`); const authorityRoot = path.join(authorityBase, "data"); const authorityPath = path.join(authorityBase, "authority.json"); fs.mkdirSync(authorityRoot, { recursive: true });
  const productionEnvironment = (manifest: Record<string, unknown>, hashOverride?: string) => { const raw = Buffer.from(JSON.stringify(manifest)); fs.writeFileSync(authorityPath, raw); return { NODE_ENV: "production", BIMLOG_FEEDBACK_STORAGE_BACKEND: "durable-filesystem", BIMLOG_FEEDBACK_STORAGE_BACKEND_ID: "approved-fixture", BIMLOG_FEEDBACK_UPLOAD_ROOT: authorityRoot, BIMLOG_FEEDBACK_STORAGE_AUTHORITY_MANIFEST: authorityPath, BIMLOG_FEEDBACK_STORAGE_AUTHORITY_SHA256: hashOverride ?? createHash("sha256").update(raw).digest("hex") }; };
  const validManifest = { schemaVersion: 1, backendId: "approved-fixture", dataRoot: authorityRoot, backupRequired: true, capabilities: ["exact-bytes", "bounded-read"], maxReadBytes: 20 * 1024 * 1024 };
  const productionStorage = createStorageFromEnvironment(productionEnvironment(validManifest)); assert.equal((await productionStorage.health()).maxReadBytes, 20 * 1024 * 1024); passed("hash-bound production authority");
  for (const [name, manifest] of [["empty", { ...validManifest, capabilities: [] }], ["missing", { ...validManifest, capabilities: ["exact-bytes"] }], ["mismatched", { ...validManifest, capabilities: ["bounded-read", "unproven-read"] }], ["invalid-cap", { ...validManifest, maxReadBytes: 0 }]] as const) { assert.throws(() => createStorageFromEnvironment(productionEnvironment(manifest)), /FEEDBACK_STORAGE_AUTHORITY_INVALID/, `${name} production authority must fail closed`); passed(`${name} production authority refusal`); }
  assert.throws(() => createStorageFromEnvironment(productionEnvironment(validManifest, "0".repeat(64))), /FEEDBACK_STORAGE_AUTHORITY_INVALID/); passed("production authority hash mismatch"); fs.rmSync(authorityBase, { recursive: true, force: true });
  const failedWriteRoot = path.join(root, "failed-write"); const failedWrite = new LocalDiskStorageAdapter(failedWriteRoot, { faultAt: "write" }); await assert.rejects(() => failedWrite.upload(bytes, 1, "x"), /FORCED_WRITE/); assert.equal(fs.readdirSync(failedWriteRoot, { recursive: true }).filter(value => String(value).includes(".pending") || /^[a-f0-9]{64}$/.test(path.basename(String(value)))).length, 0);
  const failedSyncRoot = path.join(root, "failed-sync"); const failedSync = new LocalDiskStorageAdapter(failedSyncRoot, { faultAt: "fsync" }); await assert.rejects(() => failedSync.upload(bytes, 1, "x"), /FORCED_FSYNC/); assert.equal(fs.readdirSync(failedSyncRoot, { recursive: true }).filter(value => String(value).includes(".pending") || /^[a-f0-9]{64}$/.test(path.basename(String(value)))).length, 0);
  const backup = path.join(root, "backup"), restore = path.join(root, "restore"); fs.cpSync(path.join(root, key.slice(0, 2)), path.join(backup, key.slice(0, 2)), { recursive: true }); fs.cpSync(backup, restore, { recursive: true }); const restored = new LocalDiskStorageAdapter(restore); assert.deepEqual(await restored.download(key), bytes);
  const linkRoot = path.join(root, "link-root"), outside = path.join(root, "outside"); fs.mkdirSync(linkRoot); fs.mkdirSync(outside); try { fs.symlinkSync(outside, path.join(linkRoot, "aa"), "junction"); const linked = new LocalDiskStorageAdapter(linkRoot); await assert.rejects(() => linked.download(`aa/bb/${"a".repeat(64)}`), /REPARSE/); passed("static nested reparse denial"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error; }
  const raceRoot = path.join(root, "reparse-race"); const raceAdapter = new LocalDiskStorageAdapter(raceRoot); const raceKey = await raceAdapter.upload(mutableBytes, 1, "race.bin"); const raceFirstPath = path.join(raceRoot, raceKey.split("/")[0]); changed = false;
  fs.readSync = ((...args: Parameters<typeof fs.readSync>) => { const count = originalRead(...args); changed = true; return count; }) as typeof fs.readSync;
  mutableFs.lstatSync = ((target: fs.PathLike, options?: fs.StatSyncOptions) => { const stat = originalLstat(target, options as never); if (changed && path.resolve(String(target)) === raceFirstPath) return new Proxy(stat, { get(value, property, receiver) { return property === "isSymbolicLink" ? () => true : Reflect.get(value, property, receiver); } }); return stat; }) as typeof fs.lstatSync;
  try { await assert.rejects(() => raceAdapter.downloadBounded(raceKey, mutableBytes.length), /STORAGE_REPARSE_COMPONENT_DENIED/); passed("nested reparse replacement race"); } finally { fs.readSync = originalRead; mutableFs.lstatSync = originalLstat; }
  console.log(`feedback durable storage contract: ${checks.size}/${checks.size} dynamic checks passed`);
} finally { fs.rmSync(root, { recursive: true, force: true }); }
