import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
  await assert.rejects(() => reopened.delete(key, { retentionHold: true }), /STORAGE_RETENTION_HOLD_ACTIVE/);
  assert.deepEqual((await reopened.health()).backupContract, { required: true, format: "opaque-key-v1", integrity: "sha256", restoreVerification: "exact-bytes-and-sha256" });
  const keys = await Promise.all(Array.from({ length: 12 }, (_, index) => first.upload(Buffer.from(`instance-${index}`), 101, "same.txt")));
  assert.equal(new Set(keys).size, keys.length);
  assert.throws(() => createStorageFromEnvironment({ NODE_ENV: "production" }), /FEEDBACK_DURABLE_STORAGE_REQUIRED/);
  assert.throws(() => createStorageFromEnvironment({ NODE_ENV: "production", BIMLOG_FEEDBACK_STORAGE_BACKEND: "local-test", BIMLOG_FEEDBACK_UPLOAD_ROOT: root }), /FEEDBACK_DURABLE_STORAGE_REQUIRED/);
  assert.throws(() => createStorageFromEnvironment({ NODE_ENV: "production", BIMLOG_FEEDBACK_STORAGE_BACKEND: "durable-filesystem", BIMLOG_FEEDBACK_STORAGE_BACKEND_ID: "approved-fixture", BIMLOG_FEEDBACK_UPLOAD_ROOT: root }), /FEEDBACK_STORAGE_MANIFEST_REQUIRED/);
  fs.writeFileSync(path.join(root, ".bimlog-feedback-storage.json"), JSON.stringify({ schemaVersion: 1, backendId: "approved-fixture", backendType: "durable-filesystem", backupRequired: true }));
  const approved = createStorageFromEnvironment({ NODE_ENV: "production", BIMLOG_FEEDBACK_STORAGE_BACKEND: "durable-filesystem", BIMLOG_FEEDBACK_STORAGE_BACKEND_ID: "approved-fixture", BIMLOG_FEEDBACK_UPLOAD_ROOT: root });
  assert.equal((await approved.health()).backendId, "approved-fixture");
  console.log("feedback durable storage contract: 12/12 passed");
} finally { fs.rmSync(root, { recursive: true, force: true }); }
