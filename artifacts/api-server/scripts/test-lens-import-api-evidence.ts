import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, readdirSync, statSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import app from "../src/app";
import { pool } from "@workspace/db";

type Json = Record<string, any>;
type Check = { id: string; ok: boolean; detail: string };

const startedAt = new Date();
const runId = `lens-import-${startedAt.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;
const evidenceRoot = "C:\\Dev\\bimlog-tools\\evidence\\navisworks-project-import";
const evidenceDir = join(evidenceRoot, runId);
mkdirSync(evidenceDir, { recursive: true });

const checks: Check[] = [];
const httpEvidence: Json[] = [];
const dbEvidence: Json[] = [];

function check(id: string, condition: unknown, detail: string) {
  checks.push({ id, ok: Boolean(condition), detail });
  if (!condition) throw new Error(`${id}: ${detail}`);
}

function sha(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Json = {};
    for (const [k, v] of Object.entries(value as Json)) {
      if (/token|authorization|cookie|password|secret|jwt|database|url/i.test(k)) out[k] = "[REDACTED]";
      else out[k] = redact(v);
    }
    return out;
  }
  if (typeof value === "string" && /(postgres:\/\/|Bearer\s+|eyJ|password|stack|C:\\|\/home\/|SELECT\s|INSERT\s|UPDATE\s|DELETE\s)/i.test(value)) return "[REDACTED]";
  return value;
}

function localDbInfo(connectionString: string) {
  const url = new URL(connectionString);
  const database = url.pathname.replace(/^\//, "");
  if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname) || url.port !== "55432" || database !== "bimlog_rfi_test" || /neon|replit/i.test(url.hostname)) {
    throw new Error("Unsafe database target for Lens import evidence");
  }
  return { host: "127.0.0.1", port: 55432, database, local: true };
}

const dbUrl = process.env.PROD_DATABASE_URL;
if (!dbUrl) throw new Error("PROD_DATABASE_URL must be loaded by the protected local-test helper");
if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET must be loaded by the protected local-test helper");
const dbInfo = localDbInfo(dbUrl);

const id = (seed: string) => createHash("sha256").update(`${runId}:${seed}`).digest("hex");
const text = (name: string) => `${runId}-${name}`;
const password = `Pass-${randomBytes(8).toString("hex")}!`;

let server: Server | null = null;
let baseUrl = "";
let targetProjectId = 0;
let sourceProjectId = 0;
let otherProjectId = 0;
let ownerToken = "";
let secondToken = "";
let readOnlyToken = "";
let nonMemberToken = "";
const userIds: number[] = [];
const companyNames: string[] = [];

async function startApi() {
  server = await new Promise<Server>((resolveServer) => {
    const s = app.listen(0, "127.0.0.1", () => resolveServer(s));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("API did not bind to an isolated loopback port");
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  for (let i = 0; i < 50; i++) {
    const res = await fetch(`${baseUrl}/healthz`).catch(() => null);
    if (res?.ok) return;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error("API health route did not become ready");
}

async function stopApi() {
  if (!server) return;
  await new Promise<void>((resolveClose, reject) => server!.close(err => err ? reject(err) : resolveClose()));
  server = null;
}

function importMigrationSource(): string {
  const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../src/app.ts"), "utf8");
  const start = source.indexOf("CREATE TABLE IF NOT EXISTS lens_import_batches");
  const end = source.indexOf("[migration] lens_viewpoints lifecycle + sequence-counter migration ensured", start);
  if (start < 0 || end < 0) throw new Error("Could not locate Lens import startup migration block");
  return source.slice(start, end);
}

async function request(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const raw = await res.text();
  let json: any = null;
  try { json = raw ? JSON.parse(raw) : null; } catch { json = { raw }; }
  httpEvidence.push({ method, path: path.replace(/\d+/g, "{id}"), status: res.status, body: redact(json) });
  return { status: res.status, ok: res.ok, body: json, raw };
}

async function dbQuery<T extends Json = Json>(sql: string, params: unknown[] = []) {
  return pool.query<T>(sql, params);
}

async function seedConfig() {
  await dbQuery(`INSERT INTO config_options (category,value,label,label_es,sort_order,meta)
    VALUES
    ('project_status','active','Active','Activo',1,NULL),
    ('member_role','project_admin','Project Admin','Administrador',1,'{"permission":"admin"}'),
    ('member_role','editor','Editor','Editor',2,'{"permission":"write"}'),
    ('member_role','viewer','Viewer','Lector',3,'{"permission":"read"}')
    ON CONFLICT DO NOTHING`);
}

async function waitForStartupMigration() {
  for (let i = 0; i < 80; i++) {
    const cols = await dbQuery<{ c: string }>(`SELECT column_name AS c FROM information_schema.columns WHERE table_name='lens_import_batches' AND column_name='request_hash'
      UNION ALL SELECT column_name AS c FROM information_schema.columns WHERE table_name='lens_viewpoints' AND column_name='bimlog_physical_id'`);
    if (cols.rowCount === 2) return;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error("Lens import startup migration did not complete");
}

async function register(label: string) {
  const email = `${runId}.${label}@bimlog.test`;
  const companyName = text(`company-${label}`);
  companyNames.push(companyName);
  const reg = await request("POST", "/auth/register", { email, password, fullName: text(`user-${label}`), companyName });
  check(`auth.register.${label}`, reg.status === 201 && reg.body?.token, `registered ${label}`);
  const login = await request("POST", "/auth/login", { email, password });
  check(`auth.login.${label}`, login.status === 200 && login.body?.token, `logged in ${label}`);
  userIds.push(Number(login.body.user.id));
  return { token: String(login.body.token), userId: Number(login.body.user.id), email };
}

async function createProject(label: string, token: string) {
  const res = await request("POST", "/projects", { name: text(`project-${label}`), code: text(`P-${label}`).slice(0, 80), description: text(`description-${label}`) }, token);
  check(`project.create.${label}`, res.status === 201 && res.body?.id, `created project ${label}`);
  return Number(res.body.id);
}

async function fingerprintRows(projectId: number) {
  const rows = await dbQuery(`SELECT id, project_id, viewpoint_id, note, trade, responsible_company, report_type, priority, floor, open_items, status,
    issue_group_id, lifecycle_status, revision_number, supersedes_id, import_batch_id, source_project_id, source_server_id, source_physical_id,
    source_display_label, imported_lineage_status, bimlog_physical_id FROM lens_viewpoints WHERE project_id=$1 ORDER BY id`, [projectId]);
  return sha(rows.rows);
}

async function counts() {
  const result = await dbQuery(`SELECT
    (SELECT count(*)::int FROM lens_import_batches WHERE target_project_id = ANY($1::int[])) AS batches,
    (SELECT count(*)::int FROM lens_import_items WHERE target_project_id = ANY($1::int[])) AS items,
    (SELECT count(*)::int FROM lens_viewpoints WHERE project_id = ANY($1::int[])) AS viewpoints`, [[targetProjectId, otherProjectId]]);
  return result.rows[0] as { batches: number; items: number; viewpoints: number };
}

function importBody(seed: string, sourceIds: number[], sourcePhysical: string[]) {
  return {
    importKey: id(`${seed}:import-key`),
    modelKey: id(`${seed}:model-key`),
    viewpoints: [
      {
        sourceProjectId,
        sourceIdentityKey: id(`${seed}:source-a`),
        sourceServerId: sourceIds[0],
        sourcePhysicalId: sourcePhysical[0],
        sourceNavisworksGuid: "123e4567-e89b-42d3-a456-426614174000",
        sourceDisplayLabel: text(`${seed}-A`),
        sourceSupersedesIdentityKey: "",
        note: text(`${seed}-note-a`),
        trade: "HVAC",
        responsibleCompany: text("responsible"),
        reportType: "SHOP",
        priority: 3,
        floor: "L1",
        openItems: text(`${seed}-open-a`),
        lifecycleStatus: "active",
        status: "open",
        revisionNumber: 1,
        issueGroupId: id(`${seed}:group`).slice(0, 32),
      },
      {
        sourceProjectId,
        sourceIdentityKey: id(`${seed}:source-b`),
        sourceServerId: sourceIds[1],
        sourcePhysicalId: sourcePhysical[1],
        sourceNavisworksGuid: "123e4567-e89b-42d3-a456-426614174001",
        sourceDisplayLabel: text(`${seed}-B`),
        sourceSupersedesIdentityKey: id(`${seed}:source-a`),
        note: text(`${seed}-note-b`),
        trade: "ELEC",
        responsibleCompany: text("responsible"),
        reportType: "FIELD",
        priority: 2,
        floor: "L2",
        openItems: text(`${seed}-open-b`),
        lifecycleStatus: "active",
        status: "follow_up",
        revisionNumber: 2,
        issueGroupId: id(`${seed}:group`).slice(0, 32),
      },
    ],
  };
}

function sameMappings(a: any[], b: any[]) {
  return sha(a.map(x => [x.sourceIdentityKey, x.targetServerId, x.targetPhysicalId, x.targetViewpointId, x.lineageStatus]).sort()) ===
    sha(b.map(x => [x.sourceIdentityKey, x.targetServerId, x.targetPhysicalId, x.targetViewpointId, x.lineageStatus]).sort());
}

async function cleanup() {
  try {
    await dbQuery(`DROP TRIGGER IF EXISTS ${runId.replace(/-/g, "_")}_rollback_trigger ON lens_import_items`);
    await dbQuery(`DROP FUNCTION IF EXISTS ${runId.replace(/-/g, "_")}_rollback_fn()`);
    const projectRows = await dbQuery<{ id: number }>(`SELECT id FROM projects WHERE name LIKE $1 OR code LIKE $1`, [`${runId}%`]);
    const projectIds = projectRows.rows.map(r => r.id);
    if (projectIds.length) {
      await dbQuery(`DELETE FROM lens_import_items WHERE target_project_id = ANY($1::int[])`, [projectIds]);
      await dbQuery(`DELETE FROM lens_viewpoints WHERE project_id = ANY($1::int[])`, [projectIds]);
      await dbQuery(`DELETE FROM lens_import_batches WHERE target_project_id = ANY($1::int[])`, [projectIds]);
      await dbQuery(`DELETE FROM project_members WHERE project_id = ANY($1::int[])`, [projectIds]);
      await dbQuery(`DELETE FROM projects WHERE id = ANY($1::int[])`, [projectIds]);
    }
    await dbQuery(`DELETE FROM users WHERE email LIKE $1`, [`${runId}.%@bimlog.test`]);
    await dbQuery(`DELETE FROM companies WHERE name LIKE $1`, [`${runId}%`]);
  } catch (err) {
    checks.push({ id: "cleanup.error", ok: false, detail: err instanceof Error ? err.message : String(err) });
  }
}

async function main() {
  check("db.local-target", dbInfo.local && dbInfo.port === 55432 && dbInfo.database === "bimlog_rfi_test", "using isolated loopback PostgreSQL database");
  const source = await dbQuery(`SELECT current_database() AS database, inet_server_addr()::text AS address, inet_server_port() AS port`);
  dbEvidence.push({ dbIdentity: source.rows[0] });
  check("db.identity", source.rows[0].database === "bimlog_rfi_test" && Number(source.rows[0].port) === 55432, "database identity verified");

  await seedConfig();
  await cleanup();
  await startApi();
  await waitForStartupMigration();
  const ddlSource = await dbQuery(`SELECT indexname FROM pg_indexes WHERE tablename='lens_import_batches' ORDER BY indexname`);
  dbEvidence.push({ lensImportBatchIndexes: ddlSource.rows.map(r => r.indexname) });
  check("migration.additive-source-review", !/DROP TABLE|DROP COLUMN|DROP INDEX|ALTER TABLE\s+\S+\s+RENAME/i.test(importMigrationSource()), "Lens import startup migration source contains no table/column/index drop or rename");

  const owner = await register("owner");
  const second = await register("second");
  const readOnly = await register("readonly");
  const nonMember = await register("nonmember");
  ownerToken = owner.token; secondToken = second.token; readOnlyToken = readOnly.token; nonMemberToken = nonMember.token;

  targetProjectId = await createProject("target", ownerToken);
  sourceProjectId = await createProject("source", secondToken);
  otherProjectId = await createProject("other", ownerToken);
  await dbQuery(`INSERT INTO project_members (project_id,user_id,role,status) VALUES ($1,$2,'project_admin','active') ON CONFLICT DO NOTHING`, [targetProjectId, second.userId]);
  await dbQuery(`INSERT INTO project_members (project_id,user_id,role,status) VALUES ($1,$2,'viewer','active') ON CONFLICT DO NOTHING`, [targetProjectId, readOnly.userId]);

  const sourceRows = await dbQuery<{ id: number; bimlog_physical_id: string }>(`INSERT INTO lens_viewpoints
    (project_id, viewpoint_id, note, trade, responsible_company, report_type, priority, floor, open_items, status, issue_group_id, lifecycle_status, revision_number, synced_at, bimlog_physical_id)
    VALUES
    ($1,$2,$3,'SRC','SRC','SRC',1,'SRC','SRC','open',$4,'active',1,NOW(),$5),
    ($1,$6,$7,'SRC','SRC','SRC',1,'SRC','SRC','open',$8,'active',1,NOW(),$9)
    RETURNING id, bimlog_physical_id`, [sourceProjectId, text("source-vp-a"), text("source-note-a"), text("source-group-a"), text("source-physical-a"), text("source-vp-b"), text("source-note-b"), text("source-group-b"), text("source-physical-b")]);
  const sourceIds = sourceRows.rows.map(r => r.id);
  const sourcePhysical = sourceRows.rows.map(r => r.bimlog_physical_id);
  const sourceBefore = await fingerprintRows(sourceProjectId);
  const before = await counts();

  const context = await request("GET", `/projects/${targetProjectId}/clash-reports/lens-import-context?sourceProjectId=${sourceProjectId}`, undefined, ownerToken);
  check("context.success", context.status === 200 && context.body?.sourceProjectContacted === false, "context endpoint succeeded without contacting source project");
  check("context.source-inaccessible", context.body?.sourceAccess === false, "owner has no membership in isolated source project");

  const firstBody = importBody("first", sourceIds, sourcePhysical);
  const first = await request("POST", `/projects/${targetProjectId}/clash-reports/lens-import`, firstBody, ownerToken);
  check("A.http-success", first.status === 200 && first.body?.success === true && first.body?.reusedBatch === false, "first import succeeded");
  check("A.mapping-count", first.body.mappings.length === 2, "first import returned two mappings");
  check("A.new-target-identities", first.body.mappings.every((m: any) => !sourceIds.includes(m.targetServerId) && !sourcePhysical.includes(m.targetPhysicalId) && m.targetPhysicalId), "target server and physical IDs are new");
  const afterFirst = await counts();
  check("A.batch-count", afterFirst.batches === before.batches + 1, "one import batch added");
  check("A.item-count", afterFirst.items === before.items + 2, "two import items added");
  check("A.viewpoint-count", afterFirst.viewpoints === before.viewpoints + 2, "two target viewpoints added");
  const sourceAfterFirst = await fingerprintRows(sourceProjectId);
  check("A.source-unchanged", sourceAfterFirst === sourceBefore, "source sentinel rows unchanged");

  const retry = await request("POST", `/projects/${targetProjectId}/clash-reports/lens-import`, firstBody, ownerToken);
  const afterRetry = await counts();
  check("B.reused", retry.status === 200 && retry.body?.reusedBatch === true && retry.body.importBatchId === first.body.importBatchId, "identical retry reused same batch");
  check("B.same-mapping", sameMappings(retry.body.mappings, first.body.mappings), "identical retry returned same mappings");
  check("B.zero-mutation", sha(afterRetry) === sha(afterFirst), "identical retry added no rows");

  const changed = structuredClone(firstBody); changed.viewpoints[0].note = text("changed-note");
  const conflictPayload = await request("POST", `/projects/${targetProjectId}/clash-reports/lens-import`, changed, ownerToken);
  const afterConflictPayload = await counts();
  check("C.409", conflictPayload.status === 409 && conflictPayload.body?.error === "IMPORT_IDEMPOTENCY_CONFLICT", "changed content returns 409");
  check("C.no-prior-mapping", !("mappings" in conflictPayload.body), "conflict response does not return prior mapping");
  check("C.zero-mutation", sha(afterConflictPayload) === sha(afterFirst), "changed content conflict did not mutate rows");

  const changedModel = structuredClone(firstBody); changedModel.modelKey = id("different-model");
  const conflictModel = await request("POST", `/projects/${targetProjectId}/clash-reports/lens-import`, changedModel, ownerToken);
  const afterConflictModel = await counts();
  check("D.409", conflictModel.status === 409 && conflictModel.body?.error === "IMPORT_IDEMPOTENCY_CONFLICT", "changed model returns 409");
  check("D.zero-mutation", sha(afterConflictModel) === sha(afterFirst), "changed model conflict did not mutate rows");

  const secondUser = await request("POST", `/projects/${targetProjectId}/clash-reports/lens-import`, firstBody, secondToken);
  check("E.namespaced-success", secondUser.status === 200 && secondUser.body?.reusedBatch === false && secondUser.body.importBatchId !== first.body.importBatchId, "different authorized user has separate namespace");
  check("E.no-first-mapping", !sameMappings(secondUser.body.mappings, first.body.mappings), "second user did not retrieve first user's mapping");

  const unauth = await request("POST", `/projects/${targetProjectId}/clash-reports/lens-import`, importBody("unauth", sourceIds, sourcePhysical));
  const nonmember = await request("POST", `/projects/${targetProjectId}/clash-reports/lens-import`, importBody("nonmember", sourceIds, sourcePhysical), nonMemberToken);
  const readonly = await request("POST", `/projects/${targetProjectId}/clash-reports/lens-import`, importBody("readonly", sourceIds, sourcePhysical), readOnlyToken);
  const writable = await request("POST", `/projects/${targetProjectId}/clash-reports/lens-import`, importBody("writable", sourceIds, sourcePhysical), secondToken);
  check("F.unauthenticated", unauth.status === 401, "unauthenticated request rejected");
  check("F.nonmember", nonmember.status === 403, "authenticated nonmember rejected");
  check("F.readonly", readonly.status === 403, "read-only member rejected");
  check("F.writable", writable.status === 200, "writable member accepted");

  const concurrentBody = importBody("concurrent-same", sourceIds, sourcePhysical);
  const [ca, cb] = await Promise.all([
    request("POST", `/projects/${targetProjectId}/clash-reports/lens-import`, concurrentBody, ownerToken),
    request("POST", `/projects/${targetProjectId}/clash-reports/lens-import`, concurrentBody, ownerToken),
  ]);
  check("G.concurrent-identical-http", ca.status === 200 && cb.status === 200, "both concurrent identical imports succeeded");
  check("G.concurrent-identical-same-mapping", sameMappings(ca.body.mappings, cb.body.mappings), "concurrent identical imports returned same mapping");
  const duplicateCheck = await dbQuery(`SELECT source_identity_key, count(*)::int AS c FROM lens_import_items WHERE batch_id=$1 GROUP BY source_identity_key HAVING count(*) > 1`, [ca.body.importBatchId]);
  check("G.concurrent-identical-no-dupes", duplicateCheck.rowCount === 0, "no duplicate import items for concurrent identical import");

  const conflictA = importBody("concurrent-conflict", sourceIds, sourcePhysical);
  const conflictB = structuredClone(conflictA); conflictB.viewpoints[0].note = text("concurrent-conflict-changed");
  const [cwin, close] = await Promise.all([
    request("POST", `/projects/${targetProjectId}/clash-reports/lens-import`, conflictA, ownerToken),
    request("POST", `/projects/${targetProjectId}/clash-reports/lens-import`, conflictB, ownerToken),
  ]);
  const conflictStatuses = [cwin.status, close.status].sort();
  check("G.concurrent-conflict", conflictStatuses[0] === 200 && conflictStatuses[1] === 409, "one concurrent conflicting import wins and one receives 409");

  const fn = runId.replace(/-/g, "_");
  await dbQuery(`CREATE OR REPLACE FUNCTION ${fn}_rollback_fn() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.source_display_label LIKE '${runId}-rollback-%' THEN RAISE EXCEPTION 'controlled rollback fixture'; END IF; RETURN NEW; END $$`);
  await dbQuery(`CREATE TRIGGER ${fn}_rollback_trigger BEFORE INSERT ON lens_import_items FOR EACH ROW EXECUTE FUNCTION ${fn}_rollback_fn()`);
  const rollbackBefore = await counts();
  const rollbackBody = importBody("rollback", sourceIds, sourcePhysical);
  const rollback = await request("POST", `/projects/${targetProjectId}/clash-reports/lens-import`, rollbackBody, ownerToken);
  const rollbackAfter = await counts();
  const rollbackPublicText = JSON.stringify(rollback.body);
  check("H.sanitized-failure", rollback.status === 500 && rollback.body?.error === "LENS_IMPORT_FAILED" && /^[0-9a-f-]{36}$/i.test(String(rollback.body?.correlationId)), "controlled DB failure returned sanitized error with correlation ID");
  check("H.no-detail-leak", !/(postgres:\/\/|password|SQL|controlled rollback|C:\\|stack|at\s+)/i.test(rollbackPublicText), "failure response contains no raw DB/path/stack details");
  check("H.rollback-zero-mutation", sha(rollbackAfter) === sha(rollbackBefore), "failed transaction rolled back batch/items/viewpoints");
  check("H.source-unchanged", await fingerprintRows(sourceProjectId) === sourceBefore, "source sentinels unchanged after rollback");
  await dbQuery(`DROP TRIGGER IF EXISTS ${fn}_rollback_trigger ON lens_import_items`);
  await dbQuery(`DROP FUNCTION IF EXISTS ${fn}_rollback_fn()`);

  await stopApi();
  await startApi();
  await waitForStartupMigration();
  const restartRetry = await request("POST", `/projects/${targetProjectId}/clash-reports/lens-import`, firstBody, ownerToken);
  const afterRestartRetry = await counts();
  check("I.restart-reused", restartRetry.status === 200 && restartRetry.body?.reusedBatch === true && restartRetry.body.importBatchId === first.body.importBatchId, "restart retry reused same completed batch");
  check("I.restart-no-dupe", sha(afterRestartRetry) === sha(rollbackAfter), "restart retry created no duplicate target viewpoint");

  const pull = await request("GET", `/projects/${targetProjectId}/clash-reports/lens-pull`, undefined, ownerToken);
  check("J.pull-success", pull.status === 200 && pull.body?.success === true, "lens-pull succeeded");
  const imported = pull.body.viewpoints.filter((v: any) => v.importBatchId === first.body.importBatchId);
  check("J.pull-count", imported.length === 2, "pull returned both imported rows");
  check("J.pull-fields", imported.every((v: any) => v.projectId === targetProjectId && v.id && v.bimlogPhysicalId && v.importBatchId && v.sourceProjectId === sourceProjectId && v.sourceServerId && v.sourcePhysicalId && v.importedLineageStatus), "pull returned required identity/provenance fields");
  check("J.lineage-remapped", imported.some((v: any) => v.importedLineageStatus === "remapped" && first.body.mappings.some((m: any) => m.targetServerId === v.supersedesId)), "pull lineage remapped to new target predecessor");
  check("J.no-sensitive-output", !/(postgres:\/\/|password|SQL|C:\\|source-note)/i.test(JSON.stringify(pull.body)), "pull did not expose credentials, raw SQL, paths, or source row contents outside submitted payload");

  const otherPull = await request("GET", `/projects/${otherProjectId}/clash-reports/lens-pull`, undefined, ownerToken);
  check("K.other-project-no-mapping", otherPull.status === 200 && !otherPull.body.viewpoints.some((v: any) => v.importBatchId === first.body.importBatchId), "imported mapping cannot be fetched through another project");
  const targetMismatchBody = importBody("target-mismatch", sourceIds, sourcePhysical);
  targetMismatchBody.viewpoints[0].sourceProjectId = targetProjectId;
  const targetMismatch = await request("POST", `/projects/${targetProjectId}/clash-reports/lens-import`, targetMismatchBody, ownerToken);
  check("K.target-boundary", targetMismatch.status === 400 && targetMismatch.body?.error === "INVALID_IMPORT_SOURCE", "source equal to target project rejected");
  check("K.created-only-target", (await dbQuery(`SELECT count(*)::int AS c FROM lens_viewpoints WHERE import_batch_id IS NOT NULL AND project_id <> $1 AND project_id <> $2`, [targetProjectId, otherProjectId])).rows[0].c === 0, "created import rows belong only to target test projects");

  const inputCases: Array<[string, any, number, string]> = [
    ["over-5mb", (() => { const b = importBody("over-5mb", sourceIds, sourcePhysical); b.viewpoints[0].note = "x".repeat(5 * 1024 * 1024); return b; })(), 413, "IMPORT_REQUEST_TOO_LARGE"],
    ["over-5000", (() => { const b = importBody("over-5000", sourceIds, sourcePhysical); b.viewpoints = Array.from({ length: 5001 }, (_, i) => ({ ...b.viewpoints[0], sourceIdentityKey: id(`over-5000-${i}`) })); return b; })(), 400, "INVALID_IMPORT_COUNT"],
    ["bad-guid", (() => { const b = importBody("bad-guid", sourceIds, sourcePhysical); b.viewpoints[0].sourceNavisworksGuid = "bad"; return b; })(), 400, "INVALID_IMPORT_GUID"],
    ["bad-sha", (() => { const b = importBody("bad-sha", sourceIds, sourcePhysical); b.viewpoints[0].sourceIdentityKey = "bad"; return b; })(), 400, "INVALID_IMPORT_IDENTITY"],
    ["duplicate-source", (() => { const b = importBody("duplicate-source", sourceIds, sourcePhysical); b.viewpoints[1].sourceIdentityKey = b.viewpoints[0].sourceIdentityKey; return b; })(), 400, "INVALID_IMPORT_IDENTITY"],
    ["bad-lifecycle", (() => { const b = importBody("bad-lifecycle", sourceIds, sourcePhysical); b.viewpoints[0].lifecycleStatus = "bad"; return b; })(), 400, "INVALID_IMPORT_LIFECYCLE"],
    ["bad-status", (() => { const b = importBody("bad-status", sourceIds, sourcePhysical); b.viewpoints[0].status = "bad"; return b; })(), 400, "INVALID_IMPORT_STATUS"],
    ["bad-priority", (() => { const b = importBody("bad-priority", sourceIds, sourcePhysical); b.viewpoints[0].priority = 9; return b; })(), 400, "INVALID_IMPORT_FIELD"],
    ["bad-revision", (() => { const b = importBody("bad-revision", sourceIds, sourcePhysical); b.viewpoints[0].revisionNumber = 1000001; return b; })(), 400, "INVALID_IMPORT_FIELD"],
    ["overlong", (() => { const b = importBody("overlong", sourceIds, sourcePhysical); b.viewpoints[0].trade = "x".repeat(201); return b; })(), 400, "INVALID_IMPORT_FIELD"],
    ["zero-records", (() => { const b = importBody("zero-records", sourceIds, sourcePhysical); b.viewpoints = []; return b; })(), 400, "INVALID_IMPORT_COUNT"],
  ];
  for (const [name, body, status, code] of inputCases) {
    const res = await request("POST", `/projects/${targetProjectId}/clash-reports/lens-import`, body, ownerToken);
    check(`L.${name}`, res.status === status && res.body?.error === code, `${name} rejected as ${code}`);
  }

  const upgradeProbeKey = id("legacy-null-hash-key");
  await dbQuery(`ALTER TABLE lens_import_batches ALTER COLUMN request_hash DROP NOT NULL`);
  await dbQuery(`INSERT INTO lens_import_batches (target_project_id, import_key, model_key, request_hash, source_project_ids, status, requested_by_id)
    VALUES ($1,$2,$3,NULL,$4,'complete',$5)`, [targetProjectId, upgradeProbeKey, id("legacy-model"), String(sourceProjectId), owner.userId]);
  const legacyBody = importBody("legacy-null", sourceIds, sourcePhysical);
  legacyBody.importKey = upgradeProbeKey;
  const legacy = await request("POST", `/projects/${targetProjectId}/clash-reports/lens-import`, legacyBody, ownerToken);
  check("M.null-legacy-conflict", legacy.status === 409 && legacy.body?.error === "IMPORT_IDEMPOTENCY_CONFLICT", "legacy NULL request_hash does not return unrelated mapping");
  await dbQuery(`DELETE FROM lens_import_batches WHERE target_project_id=$1 AND import_key=$2`, [targetProjectId, upgradeProbeKey]);
  await dbQuery(`ALTER TABLE lens_import_batches ALTER COLUMN request_hash SET NOT NULL`);

  const privacyBlob = JSON.stringify({ httpEvidence, dbEvidence, checks });
  check("privacy.evidence-sanitized", !/(postgres:\/\/|Bearer\s+|eyJ|password|JWT_SECRET|PROD_DATABASE_URL|C:\\Users\\|C:\\Dev\\bimlog-tools\\local-rfi-test\\secrets)/i.test(privacyBlob), "sanitized evidence contains no credentials, JWTs, or protected helper path");

  dbEvidence.push({
    prePostCountsFingerprint: sha({ before, afterFirst, afterRetry, rollbackBefore, rollbackAfter, afterRestartRetry }),
    firstMappingFingerprint: sha(first.body.mappings),
    retryMappingFingerprint: sha(retry.body.mappings),
    restartMappingFingerprint: sha(restartRetry.body.mappings),
    sourceSentinelBefore: sourceBefore,
    sourceSentinelAfter: await fingerprintRows(sourceProjectId),
  });
}

try {
  await main();
} finally {
  await stopApi().catch(() => undefined);
  await cleanup();
  await new Promise(r => setTimeout(r, 500));
  await pool.end().catch(() => undefined);
}

const failed = checks.filter(c => !c.ok);
const matrix = { runId, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), db: dbInfo, passed: checks.length - failed.length, failed: failed.length, checks };
writeFileSync(join(evidenceDir, "acceptance-matrix.json"), JSON.stringify(matrix, null, 2));
writeFileSync(join(evidenceDir, "authenticated-http-results.redacted.json"), JSON.stringify(httpEvidence, null, 2));
writeFileSync(join(evidenceDir, "database-proof.redacted.json"), JSON.stringify(dbEvidence, null, 2));

const manifestEntries = readdirSync(evidenceDir).map(name => {
  const path = join(evidenceDir, name);
  const bytes = statSync(path).size;
  const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
  return { name, bytes, sha256: hash };
});
writeFileSync(join(evidenceDir, "manifest.json"), JSON.stringify({ runId, entries: manifestEntries }, null, 2));
const manifestHash = createHash("sha256").update(readFileSync(join(evidenceDir, "manifest.json"))).digest("hex");
console.log(JSON.stringify({ evidenceDir, manifestHash, passed: matrix.passed, failed: matrix.failed }, null, 2));
process.exit(failed.length ? 1 : 0);
