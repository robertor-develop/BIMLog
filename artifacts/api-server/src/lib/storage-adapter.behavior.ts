import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "bimlog-feedback-storage-"));
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
  await assert.rejects(() => reopened.downloadBounded(key, bytes.length - 1), (error: NodeJS.ErrnoException) => error.code === "STORAGE_OBJECT_TOO_LARGE" && !error.message.includes(root), "one byte over must be denied without leaking paths");
  for (const invalid of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER]) await assert.rejects(() => reopened.downloadBounded(key, invalid), (error: NodeJS.ErrnoException) => error.code === "STORAGE_MAX_BYTES_INVALID");
  const mutableBytes = Buffer.alloc(128 * 1024, 7); const mutableKey = await first.upload(mutableBytes, 101, "mutable.bin"); const mutablePath = path.join(root, ...mutableKey.split("/"));
  const originalRead = fs.readSync, originalOpen = fs.openSync, originalFstat = fs.fstatSync, originalClose = fs.closeSync;
  let changed = false; fs.readSync = ((...args: Parameters<typeof fs.readSync>) => { const count = originalRead(...args); if (!changed) { changed = true; fs.appendFileSync(mutablePath, Buffer.from([8])); } return count; }) as typeof fs.readSync;
  await assert.rejects(() => reopened.downloadBounded(mutableKey, mutableBytes.length + 1), (error: NodeJS.ErrnoException) => error.code === "STORAGE_OBJECT_CHANGED"); fs.readSync = originalRead;
  fs.writeFileSync(mutablePath, mutableBytes); changed = false; fs.readSync = ((...args: Parameters<typeof fs.readSync>) => { const count = originalRead(...args); if (!changed) { changed = true; fs.truncateSync(mutablePath, 1); } return count; }) as typeof fs.readSync;
  await assert.rejects(() => reopened.downloadBounded(mutableKey, mutableBytes.length), (error: NodeJS.ErrnoException) => error.code === "STORAGE_OBJECT_CHANGED"); fs.readSync = originalRead;
  fs.writeFileSync(mutablePath, mutableBytes); changed = false; fs.readSync = ((...args: Parameters<typeof fs.readSync>) => { const count = originalRead(...args); if (!changed) { changed = true; fs.renameSync(mutablePath, `${mutablePath}.old`); fs.writeFileSync(mutablePath, mutableBytes); } return count; }) as typeof fs.readSync;
  await assert.rejects(() => reopened.downloadBounded(mutableKey, mutableBytes.length), (error: NodeJS.ErrnoException) => error.code === "STORAGE_OBJECT_CHANGED"); fs.readSync = originalRead; fs.rmSync(`${mutablePath}.old`); fs.writeFileSync(mutablePath, mutableBytes);
  for (const fault of ["open", "fstat", "read", "close"] as const) {
    let openedDescriptor: number | undefined;
    if (fault === "open") fs.openSync = (() => { throw new Error(`private ${root}`); }) as typeof fs.openSync;
    if (fault === "fstat") fs.fstatSync = (() => { throw new Error(`private ${root}`); }) as typeof fs.fstatSync;
    if (fault === "read") fs.readSync = (() => { throw new Error(`private ${root}`); }) as typeof fs.readSync;
    if (fault === "close") fs.closeSync = ((fd: number) => { originalClose(fd); throw new Error(`private ${root}`); }) as typeof fs.closeSync;
    fs.openSync = fault === "open" ? fs.openSync : ((...args: Parameters<typeof fs.openSync>) => { openedDescriptor = originalOpen(...args); return openedDescriptor; }) as typeof fs.openSync;
    await assert.rejects(() => reopened.downloadBounded(mutableKey, mutableBytes.length), (error: NodeJS.ErrnoException) => error.code === "STORAGE_OBJECT_READ_FAILED" && !error.message.includes(root), `${fault} failure must be sanitized`);
    fs.openSync = originalOpen; fs.fstatSync = originalFstat; fs.readSync = originalRead; fs.closeSync = originalClose;
    if (openedDescriptor !== undefined) assert.throws(() => originalFstat(openedDescriptor!), "failed reads must close their descriptor");
  }
  for (let attempt = 0; attempt < 5; attempt++) { fs.readSync = ((...args: Parameters<typeof fs.readSync>) => { const count = originalRead(...args); fs.unlinkSync(mutablePath); return count; }) as typeof fs.readSync; await assert.rejects(() => reopened.downloadBounded(mutableKey, mutableBytes.length)); fs.readSync = originalRead; fs.writeFileSync(mutablePath, mutableBytes); }
  await assert.rejects(() => reopened.downloadBounded(`../${mutableKey}`, mutableBytes.length), /STORAGE_KEY_INVALID/, "Windows traversal must stay contained");
  const moduleUrl = new URL("./storage-adapter.ts", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", `const {LocalDiskStorageAdapter}=await import(${JSON.stringify(moduleUrl)});const bytes=await new LocalDiskStorageAdapter(process.env.PROOF_ROOT).download(process.env.PROOF_KEY);process.stdout.write(bytes.toString("hex"));`], { cwd: path.resolve(import.meta.dirname, "../.."), env: { ...process.env, PROOF_ROOT: root, PROOF_KEY: key }, encoding: "utf8" });
  assert.equal(child.status, 0, child.error?.message || child.stderr); assert.equal(child.stdout, bytes.toString("hex"));
  await assert.rejects(() => reopened.delete(key, { retentionHold: true }), /STORAGE_RETENTION_HOLD_ACTIVE/);
  assert.deepEqual((await reopened.health()).backupContract, { required: true, format: "opaque-key-v1", integrity: "sha256", restoreVerification: "exact-bytes-and-sha256" });
  const keys = await Promise.all(Array.from({ length: 12 }, (_, index) => first.upload(Buffer.from(`instance-${index}`), 101, "same.txt")));
  assert.equal(new Set(keys).size, keys.length);
  assert.throws(() => createStorageFromEnvironment({ NODE_ENV: "production" }), /FEEDBACK_DURABLE_STORAGE_REQUIRED/);
  assert.throws(() => createStorageFromEnvironment({ NODE_ENV: "production", BIMLOG_FEEDBACK_STORAGE_BACKEND: "local-test", BIMLOG_FEEDBACK_UPLOAD_ROOT: root }), /FEEDBACK_DURABLE_STORAGE_REQUIRED/);
  assert.throws(() => createStorageFromEnvironment({ NODE_ENV: "production", BIMLOG_FEEDBACK_STORAGE_BACKEND: "durable-filesystem", BIMLOG_FEEDBACK_STORAGE_BACKEND_ID: "approved-fixture", BIMLOG_FEEDBACK_UPLOAD_ROOT: root }), /FEEDBACK_STORAGE_AUTHORITY_REQUIRED/);
  const failedWriteRoot = path.join(root, "failed-write"); const failedWrite = new LocalDiskStorageAdapter(failedWriteRoot, { faultAt: "write" }); await assert.rejects(() => failedWrite.upload(bytes, 1, "x"), /FORCED_WRITE/); assert.equal(fs.readdirSync(failedWriteRoot, { recursive: true }).filter(value => String(value).includes(".pending") || /^[a-f0-9]{64}$/.test(path.basename(String(value)))).length, 0);
  const failedSyncRoot = path.join(root, "failed-sync"); const failedSync = new LocalDiskStorageAdapter(failedSyncRoot, { faultAt: "fsync" }); await assert.rejects(() => failedSync.upload(bytes, 1, "x"), /FORCED_FSYNC/); assert.equal(fs.readdirSync(failedSyncRoot, { recursive: true }).filter(value => String(value).includes(".pending") || /^[a-f0-9]{64}$/.test(path.basename(String(value)))).length, 0);
  const backup = path.join(root, "backup"), restore = path.join(root, "restore"); fs.cpSync(path.join(root, key.slice(0, 2)), path.join(backup, key.slice(0, 2)), { recursive: true }); fs.cpSync(backup, restore, { recursive: true }); const restored = new LocalDiskStorageAdapter(restore); assert.deepEqual(await restored.download(key), bytes);
  const linkRoot = path.join(root, "link-root"), outside = path.join(root, "outside"); fs.mkdirSync(linkRoot); fs.mkdirSync(outside); try { fs.symlinkSync(outside, path.join(linkRoot, "aa"), "junction"); const linked = new LocalDiskStorageAdapter(linkRoot); await assert.rejects(() => linked.download(`aa/bb/${"a".repeat(64)}`), /REPARSE/); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error; }
  console.log("feedback durable storage contract: 20/20 passed");
} finally { fs.rmSync(root, { recursive: true, force: true }); }
