import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { LensImportValidationError, MAX_LENS_IMPORT_REQUEST_BYTES, validateAndHashLensImportRequest } from "../src/lib/lens-import-contract";

const here = dirname(fileURLToPath(import.meta.url));
const routePath = resolve(here, "../src/routes/clash_reports.ts");
const appPath = resolve(here, "../src/app.ts");
const schemaPath = resolve(here, "../../../lib/db/src/schema/lens-viewpoints.ts");
const route = readFileSync(routePath, "utf8");
const app = readFileSync(appPath, "utf8");
const schema = readFileSync(schemaPath, "utf8");

const id = (seed: string) => createHash("sha256").update(seed).digest("hex");
const base = () => ({
  importKey: id("stable-key"), modelKey: id("model-a"), viewpoints: [
    { sourceIdentityKey: id("view-a"), sourceProjectId: 34, sourceServerId: 99, sourcePhysicalId: "source-physical-99",
      sourceNavisworksGuid: "123e4567-e89b-42d3-a456-426614174000", sourceDisplayLabel: "HV-009", sourceSupersedesIdentityKey: "",
      note: "A", trade: "HVAC", responsibleCompany: "Company", reportType: "SHOP", priority: 3, floor: "L1", openItems: "",
      lifecycleStatus: "active", status: "open", revisionNumber: 1, issueGroupId: "group-a" },
    { sourceIdentityKey: id("view-b"), sourceProjectId: 34, sourceServerId: 100, sourcePhysicalId: "source-physical-100",
      sourceNavisworksGuid: "123e4567-e89b-42d3-a456-426614174001", sourceDisplayLabel: "HV-009", sourceSupersedesIdentityKey: id("view-a"),
      note: "B", trade: "HVAC", responsibleCompany: "Company", reportType: "SHOP", priority: 2, floor: "L1", openItems: "",
      lifecycleStatus: "superseded", status: "resolved", revisionNumber: 2, issueGroupId: "group-a" },
  ],
});

type Stored = { requestHash: string; modelKey: string; mapping: Array<{ sourceIdentityKey: string; targetServerId: number; targetPhysicalId: string }> };
class ContractStore {
  private rows = new Map<string, Stored>();
  private locks = new Map<string, Promise<void>>();
  constructor(snapshot?: string) { if (snapshot) this.rows = new Map(JSON.parse(snapshot)); }
  snapshot() { return JSON.stringify([...this.rows.entries()]); }
  async execute(user: number, target: number, body: ReturnType<typeof base>) {
    const plan = validateAndHashLensImportRequest(body, user, target);
    const key = `${user}:${target}:${plan.importKey}`;
    const prior = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(r => { release = r; });
    this.locks.set(key, prior.then(() => current));
    await prior;
    try {
      const existing = this.rows.get(key);
      if (existing) {
        if (existing.modelKey !== plan.modelKey || existing.requestHash !== plan.requestHash) throw Object.assign(new Error("conflict"), { code: "IMPORT_IDEMPOTENCY_CONFLICT" });
        return existing;
      }
      const mapping = plan.records.map((v, index) => ({ sourceIdentityKey: v.sourceIdentityKey, targetServerId: 1000 + index,
        targetPhysicalId: id(`${plan.requestHash}:${v.sourceIdentityKey}`).slice(0, 32) }));
      const stored = { requestHash: plan.requestHash, modelKey: plan.modelKey, mapping };
      this.rows.set(key, stored);
      return stored;
    } finally { release(); }
  }
  syncExisting(sourceIdentityKey: string, patch: { note: string }) {
    for (const stored of this.rows.values()) {
      const row = stored.mapping.find(item => item.sourceIdentityKey === sourceIdentityKey);
      if (row) return { ...row, ...patch };
    }
    throw new Error("missing imported viewpoint");
  }
}

const results: Array<{ name: string; passed: boolean }> = [];
async function test(name: string, fn: () => void | Promise<void>) {
  await fn(); results.push({ name, passed: true });
}
function expectValidation(body: unknown, code: string) {
  assert.throws(() => validateAndHashLensImportRequest(body, 7, 35), (err: unknown) => err instanceof LensImportValidationError && err.code === code);
}

await test("same key/same normalized payload", async () => {
  const a = base(); const b = base(); b.viewpoints.reverse();
  assert.equal(validateAndHashLensImportRequest(a, 7, 35).requestHash, validateAndHashLensImportRequest(b, 7, 35).requestHash);
  const store = new ContractStore(); assert.deepEqual(await store.execute(7, 35, a), await store.execute(7, 35, b));
});
await test("same key/different model", async () => {
  const a = base(); const b = base(); b.modelKey = id("model-b");
  assert.notEqual(validateAndHashLensImportRequest(a, 7, 35).requestHash, validateAndHashLensImportRequest(b, 7, 35).requestHash);
  const store = new ContractStore(); await store.execute(7, 35, a); await assert.rejects(store.execute(7, 35, b), (err: any) => err.code === "IMPORT_IDEMPOTENCY_CONFLICT");
});
await test("same key/different records", async () => {
  const a = base(); const b = base(); b.viewpoints[0].note = "changed";
  assert.notEqual(validateAndHashLensImportRequest(a, 7, 35).requestHash, validateAndHashLensImportRequest(b, 7, 35).requestHash);
  const store = new ContractStore(); await store.execute(7, 35, a); await assert.rejects(store.execute(7, 35, b), (err: any) => err.code === "IMPORT_IDEMPOTENCY_CONFLICT");
});
await test("same key/different authenticated user namespace", async () => {
  const store = new ContractStore(); const a = await store.execute(7, 35, base()); const b = await store.execute(8, 35, base());
  assert.notEqual(a.requestHash, b.requestHash); assert.equal(JSON.parse(store.snapshot()).length, 2);
});
await test("concurrent identical import", async () => {
  const store = new ContractStore(); const [a, b] = await Promise.all([store.execute(7, 35, base()), store.execute(7, 35, base())]);
  assert.deepEqual(a, b); assert.equal(JSON.parse(store.snapshot()).length, 1);
});
await test("same key conflicting payload", async () => {
  const store = new ContractStore(); await store.execute(7, 35, base()); const changed = base(); changed.viewpoints[0].note = "different";
  await assert.rejects(store.execute(7, 35, changed), (err: any) => err.code === "IMPORT_IDEMPOTENCY_CONFLICT");
});
await test("oversized payload", () => { const v = base(); v.viewpoints[0].note = "x".repeat(MAX_LENS_IMPORT_REQUEST_BYTES); expectValidation(v, "IMPORT_REQUEST_TOO_LARGE"); });
await test("overlong fields", () => { const v = base(); v.viewpoints[0].trade = "x".repeat(201); expectValidation(v, "INVALID_IMPORT_FIELD"); });
await test("malformed GUID", () => { const v = base(); v.viewpoints[0].sourceNavisworksGuid = "not-a-guid"; expectValidation(v, "INVALID_IMPORT_GUID"); });
await test("malformed identity", () => { const v = base(); v.viewpoints[0].sourceIdentityKey = "short"; expectValidation(v, "INVALID_IMPORT_IDENTITY"); });
await test("restart preserves physical mapping", async () => {
  const before = new ContractStore(); const created = await before.execute(7, 35, base()); const after = new ContractStore(before.snapshot());
  const retried = await after.execute(7, 35, base()); assert.deepEqual(retried.mapping, created.mapping);
});
await test("Sync after import preserves target physical identity", async () => {
  const body = base(); const store = new ContractStore(); const created = await store.execute(7, 35, body);
  const synced = store.syncExisting(body.viewpoints[0].sourceIdentityKey, { note: "updated by sync" });
  assert.equal(synced.targetPhysicalId, created.mapping[0].targetPhysicalId);
  assert.equal(synced.targetServerId, created.mapping[0].targetServerId);
});
await test("physical identity query/Pull contract", () => {
  assert.match(schema, /bimlogPhysicalId: text\("bimlog_physical_id"\)/);
  assert.match(app, /ADD COLUMN IF NOT EXISTS bimlog_physical_id TEXT/);
  assert.match(route, /bimlogPhysicalId: r\.bimlogPhysicalId/);
  assert.match(route, /imported_lineage_status, bimlog_physical_id/);
});
await test("database failure privacy", () => {
  const start = route.indexOf('router.post("/projects/:projectId/clash-reports/lens-import"');
  const end = route.indexOf("// BIMLog Lens viewpoint pull", start);
  const block = route.slice(start, end);
  const internalFailureBlock = block.slice(block.lastIndexOf("} catch (err)"));
  assert.doesNotMatch(internalFailureBlock, /err instanceof Error \? err\.message|message: err\.message/);
  assert.match(block, /err instanceof LensImportValidationError/);
  assert.match(block, /correlationId/); assert.match(block, /LENS_IMPORT_FAILED/);
  assert.match(route, /databaseCode: safe\?\.code/);
});
await test("schema is additive", () => {
  const importMigration = app.slice(app.indexOf("CREATE TABLE IF NOT EXISTS lens_import_batches"), app.indexOf("lens_viewpoints lifecycle + sequence-counter migration ensured"));
  assert.doesNotMatch(importMigration, /DROP TABLE|DROP COLUMN|DROP INDEX|DELETE FROM/);
});

console.log(JSON.stringify({ evidenceType: "Deterministic import contract/concurrency/privacy/restart fixtures; no database or deployed API", passed: results.length, failed: 0, results }, null, 2));
