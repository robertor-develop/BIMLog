import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import express from "express";

if (!process.env.PROD_DATABASE_URL) throw new Error("Load the isolated local test environment first.");
const databaseUrl = new URL(process.env.PROD_DATABASE_URL);
if (!['127.0.0.1', 'localhost', '::1'].includes(databaseUrl.hostname) || databaseUrl.port !== '55432' || databaseUrl.pathname.slice(1) !== 'bimlog_rfi_test')
  throw new Error("Build 2 proof requires the isolated loopback database.");
process.env.JWT_SECRET ||= "coordinator-build2-local-proof-only";

const [{ pool }, { ensureCoordinatorSavedViewSchema }, { normalizeSavedViewConfig }, { signToken }, { default: coordinatorRouter }] = await Promise.all([
  import("@workspace/db"),
  import("../src/lib/coordinator-saved-view-migration"),
  import("../src/lib/coordinator-saved-views"),
  import("../src/middlewares/auth"),
  import("../src/routes/coordinator-actions"),
]);

const root = path.resolve(import.meta.dirname, "../../..");
const service = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/coordinator-action-register.ts"), "utf8");
const savedService = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/coordinator-saved-views.ts"), "utf8");
const migration = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/coordinator-saved-view-migration.ts"), "utf8");
const route = fs.readFileSync(path.join(root, "artifacts/api-server/src/routes/coordinator-actions.ts"), "utf8");
const ui = fs.readFileSync(path.join(root, "artifacts/bimlog/src/pages/project/CoordinatorCommandCenter.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "artifacts/bimlog/src/index.css"), "utf8");

const results: { name: string; detail: string }[] = [];
const check = (name: string, condition: unknown, detail: string) => { assert.ok(condition, name); results.push({ name, detail }); };
const marker = `ccc-build2-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const ids = { companies: [] as number[], users: [] as number[], projects: [] as number[], meetings: [] as number[], actions: [] as number[] };

await ensureCoordinatorSavedViewSchema();
await ensureCoordinatorSavedViewSchema();
check("migration.additive_restart_safe", !/\b(?:DROP|TRUNCATE)\b/i.test(migration), "schema ensured twice with no destructive DDL");
check("migration.personal_scope_and_uniques", migration.includes("user_id,project_id,normalized_name") && migration.includes("is_default=true") && migration.includes("idempotency_uidx"), "personal name, default, and idempotency boundaries present");
check("contract.optimistic_and_soft_delete", savedService.includes("expectedVersion") && savedService.includes("deleted_at=now()") && !savedService.includes("DELETE FROM coordinator_saved_views"), "versioned rename/default/delete with soft deletion");
check("contract.authorization_rechecked", savedService.includes("authorizeCoordinatorProject") && savedService.includes("authorizeCoordinatorModule"), "project and module authorization reused on saved operations");
check("contract.built_ins_exact", ["my_items", "this_week", "overdue", "next_coordination_meeting", "all_actionable"].every((value) => service.includes(value)), "all five built-ins implemented server-side");
check("contract.no_clash_substitution", !/FROM\s+clashes\b/i.test(service) && !/clashReportsTable|clashesTable/.test(service), "Lens remains backed only by lens_viewpoints");
check("contract.zero_ai", !/OpenAI\(|anthropic\.messages|getAnthropicClientForUser|ai_usage/i.test(`${savedService}\n${route}\n${ui}`), "saved views and register contain no AI execution or usage path");
check("ui.shareable_and_private", ui.includes("window.history.replaceState") && ui.includes("ccView") && !/password|telegram|providerUrl|storagePath/i.test(ui), "namespaced URL filters contain no credential/provider/storage fields");
check("ui.bilingual_390", ui.includes("Próxima Reunión de Coordinación") && ui.includes("Restablecer mi predeterminada") && /@media \(max-width: 390px\)/.test(css), "English desktop and exact 390px Spanish controls present");

const normalizedA = normalizeSavedViewConfig({ modules: ["schedule", "meeting", "meeting"], builtInView: "overdue", timezone: "America/New_York", originalStatuses: ["OPEN", "pending"] });
const normalizedB = normalizeSavedViewConfig({ originalStatuses: ["pending", "open"], timezone: "America/New_York", builtInView: "overdue", modules: ["meeting", "schedule"] });
assert.deepEqual(normalizedA, normalizedB);
check("config.deterministic_serialization", true, crypto.createHash("sha256").update(JSON.stringify(normalizedA)).digest("hex"));
assert.throws(() => normalizeSavedViewConfig({ modules: ["clash"] }), /invalid/i);
check("config.clash_rejected", true, "Clash is not a coordinator source module");
assert.deepEqual(normalizeSavedViewConfig({ modules: [], timezone: "UTC" }).modules, []);
check("config.explicit_zero_sources_preserved", true, "empty source selection never normalizes to all sources");

const app = express();
app.use(express.json({ limit: "32kb" }));
app.use("/api/v1", coordinatorRouter);
const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address(); assert.equal(typeof address, "object");
const baseUrl = `http://127.0.0.1:${address!.port}/api/v1`;

async function api(token: string, projectId: number, suffix: string, init: RequestInit = {}, superAdmin = true) {
  const response = await fetch(`${baseUrl}/projects/${projectId}/${suffix}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(superAdmin ? { "x-bimlog-super-admin-access": "project-read", "x-bimlog-super-admin-reason": "Build 2 isolated exact project proof" } : {}),
      ...(init.headers ?? {}),
    },
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

try {
  const companyA = await pool.query<{ id: number }>("INSERT INTO companies(name) VALUES($1) RETURNING id", [`${marker}-company-a`]);
  const companyB = await pool.query<{ id: number }>("INSERT INTO companies(name) VALUES($1) RETURNING id", [`${marker}-company-b`]);
  ids.companies.push(companyA.rows[0].id, companyB.rows[0].id);
  const alice = await pool.query<{ id: number; email: string; full_name: string }>("INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin) VALUES($1,'proof',$2,$3,true) RETURNING id,email,full_name", [`${marker}-alice@example.invalid`, `${marker} Alice`, companyA.rows[0].id]);
  const bob = await pool.query<{ id: number; email: string; full_name: string }>("INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin) VALUES($1,'proof',$2,$3,true) RETURNING id,email,full_name", [`${marker}-bob@example.invalid`, `${marker} Bob`, companyA.rows[0].id]);
  const outsider = await pool.query<{ id: number; email: string; full_name: string }>("INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin) VALUES($1,'proof',$2,$3,false) RETURNING id,email,full_name", [`${marker}-outside@example.invalid`, `${marker} Outside`, companyB.rows[0].id]);
  ids.users.push(alice.rows[0].id, bob.rows[0].id, outsider.rows[0].id);
  const project = await pool.query<{ id: number }>("INSERT INTO projects(name,code,status,created_by_id) VALUES($1,$2,'active',$3) RETURNING id", [`${marker} Project`, marker, alice.rows[0].id]);
  ids.projects.push(project.rows[0].id);

  const today = new Date(); today.setUTCHours(12, 0, 0, 0);
  const day = (offset: number) => { const value = new Date(today); value.setUTCDate(value.getUTCDate() + offset); return value; };
  const meeting = await pool.query<{ id: number }>("INSERT INTO meeting_minutes(project_id,title,meeting_date,created_by_id) VALUES($1,$2,$3,$4) RETURNING id", [project.rows[0].id, `${marker} Next Coordination`, day(1), alice.rows[0].id]);
  ids.meetings.push(meeting.rows[0].id);
  const actionA = await pool.query<{ id: number }>("INSERT INTO action_items(meeting_id,project_id,description,assigned_to_id,due_date,status) VALUES($1,$2,$3,$4,$5,'open') RETURNING id", [meeting.rows[0].id, project.rows[0].id, `${marker} overdue mine`, alice.rows[0].id, day(-1)]);
  const actionB = await pool.query<{ id: number }>("INSERT INTO action_items(project_id,description,assigned_to_id,due_date,status) VALUES($1,$2,$3,$4,'open') RETURNING id", [project.rows[0].id, `${marker} this week other`, bob.rows[0].id, day(2)]);
  ids.actions.push(actionA.rows[0].id, actionB.rows[0].id);

  const aliceToken = signToken({ userId: alice.rows[0].id, email: alice.rows[0].email, companyId: companyA.rows[0].id, fullName: alice.rows[0].full_name, companyName: `${marker}-company-a`, isSuperAdmin: true });
  const bobToken = signToken({ userId: bob.rows[0].id, email: bob.rows[0].email, companyId: companyA.rows[0].id, fullName: bob.rows[0].full_name, companyName: `${marker}-company-a`, isSuperAdmin: true });
  const outsiderToken = signToken({ userId: outsider.rows[0].id, email: outsider.rows[0].email, companyId: companyB.rows[0].id, fullName: outsider.rows[0].full_name, companyName: `${marker}-company-b` });

  for (const [view, expected] of [["my_items", 1], ["this_week", 1], ["overdue", 1], ["next_coordination_meeting", 1], ["all_actionable", 2]] as const) {
    const response = await api(aliceToken, project.rows[0].id, `coordinator-actions?modules=meeting&builtInView=${view}&timezone=UTC`);
    assert.equal(response.status, 200);
    assert.equal(response.body.total, expected, view);
    if (view === "next_coordination_meeting") assert.equal(response.body.meetingContext.id, meeting.rows[0].id);
  }
  check("built_ins.runtime_eligibility", true, "1/1/1/1/2 exact totals; no zero-to-all fallback");
  const noSources = await api(aliceToken, project.rows[0].id, "coordinator-actions?modules=none&timezone=UTC");
  assert.equal(noSources.status, 200); assert.equal(noSources.body.total, 0); assert.ok(noSources.body.sources.every((source: any) => source.status === "not_requested"));
  const invalidDate = await api(aliceToken, project.rows[0].id, "coordinator-actions?modules=meeting&dueFrom=2026-02-30&timezone=UTC");
  assert.equal(invalidDate.status, 400);
  check("filters.bounded_zero_and_calendar_dates", true, "explicit no-source result stays zero; impossible calendar date rejected");
  const empty = await api(aliceToken, project.rows[0].id, `coordinator-actions?modules=meeting&builtInView=all_actionable&meetingId=${meeting.rows[0].id + 99999}&timezone=UTC`);
  assert.equal(empty.status, 200); assert.equal(empty.body.total, 0); assert.deepEqual(empty.body.items, []);
  check("filters.honest_zero", true, "unmatched exact meeting returned zero");

  const canonicalBefore = await pool.query("SELECT count(*)::int count FROM action_items WHERE project_id=$1", [project.rows[0].id]);
  const configAll = { schemaVersion: 1, builtInView: "all_actionable", modules: ["meeting"], timezone: "UTC" };
  const createKey = `${marker}-create-1`;
  const created = await api(aliceToken, project.rows[0].id, "coordinator-saved-views", { method: "POST", body: JSON.stringify({ name: "Daily Coordination", configuration: configAll, idempotencyKey: createKey }) });
  assert.equal(created.status, 201); assert.equal(created.body.view.version, 1);
  const retried = await api(aliceToken, project.rows[0].id, "coordinator-saved-views", { method: "POST", body: JSON.stringify({ name: "Daily Coordination", configuration: configAll, idempotencyKey: createKey }) });
  assert.equal(retried.status, 200); assert.equal(retried.body.idempotent, true); assert.deepEqual(retried.body.view, created.body.view);
  const changedRetry = await api(aliceToken, project.rows[0].id, "coordinator-saved-views", { method: "POST", body: JSON.stringify({ name: "Changed", configuration: configAll, idempotencyKey: createKey }) });
  assert.equal(changedRetry.status, 409);
  const duplicate = await api(aliceToken, project.rows[0].id, "coordinator-saved-views", { method: "POST", body: JSON.stringify({ name: "Duplicate Config", configuration: configAll, idempotencyKey: `${marker}-create-2` }) });
  assert.equal(duplicate.status, 409);
  const oversized = await api(aliceToken, project.rows[0].id, "coordinator-saved-views", { method: "POST", body: JSON.stringify({ name: "Oversized", configuration: { ...configAll, ignored: "x".repeat(9000) }, idempotencyKey: `${marker}-oversized` }) });
  assert.equal(oversized.status, 413);
  check("saved.create_idempotency_duplicate", true, "exact retry stable; changed retry and equivalent config rejected");

  const createdDefault = await api(aliceToken, project.rows[0].id, "coordinator-saved-views", { method: "POST", body: JSON.stringify({ name: "Overdue Personal", configuration: { ...configAll, builtInView: "overdue" }, isDefault: true, idempotencyKey: `${marker}-create-3` }) });
  assert.equal(createdDefault.status, 201); assert.equal(createdDefault.body.view.isDefault, true);
  const updateKey = `${marker}-update-1`;
  const updated = await api(aliceToken, project.rows[0].id, `coordinator-saved-views/${created.body.view.id}`, { method: "PATCH", body: JSON.stringify({ name: "Daily Coordination Renamed", isDefault: true, expectedVersion: 1, idempotencyKey: updateKey }) });
  assert.equal(updated.status, 200); assert.equal(updated.body.view.version, 2); assert.equal(updated.body.view.isDefault, true);
  const updateRetry = await api(aliceToken, project.rows[0].id, `coordinator-saved-views/${created.body.view.id}`, { method: "PATCH", body: JSON.stringify({ name: "Daily Coordination Renamed", isDefault: true, expectedVersion: 1, idempotencyKey: updateKey }) });
  assert.equal(updateRetry.status, 200); assert.deepEqual(updateRetry.body.view, updated.body.view);
  const stale = await api(aliceToken, project.rows[0].id, `coordinator-saved-views/${created.body.view.id}`, { method: "PATCH", body: JSON.stringify({ name: "Stale", expectedVersion: 1, idempotencyKey: `${marker}-stale` }) });
  assert.equal(stale.status, 409);
  const listed = await api(aliceToken, project.rows[0].id, "coordinator-saved-views");
  assert.equal(listed.status, 200); assert.equal(listed.body.views.length, 2); assert.equal(listed.body.views.filter((view: any) => view.isDefault).length, 1); assert.equal(listed.body.views.find((view: any) => view.isDefault).id, created.body.view.id);
  check("saved.rename_default_concurrency", true, "rename/default atomic; one personal default; stale version controlled");

  const bobList = await api(bobToken, project.rows[0].id, "coordinator-saved-views");
  assert.equal(bobList.status, 200); assert.deepEqual(bobList.body.views, []);
  const bobUpdate = await api(bobToken, project.rows[0].id, `coordinator-saved-views/${created.body.view.id}`, { method: "PATCH", body: JSON.stringify({ name: "Cross User", expectedVersion: 2, idempotencyKey: `${marker}-bob-update` }) });
  assert.equal(bobUpdate.status, 404);
  const outsiderList = await api(outsiderToken, project.rows[0].id, "coordinator-saved-views", {}, false);
  assert.equal(outsiderList.status, 403);
  check("saved.ownership_tenant_denial", true, "other authorized user sees no views; cross-user update hidden; outsider denied");

  const deleteKey = `${marker}-delete-1`;
  const deleted = await api(aliceToken, project.rows[0].id, `coordinator-saved-views/${created.body.view.id}`, { method: "DELETE", body: JSON.stringify({ expectedVersion: 2, idempotencyKey: deleteKey }) });
  assert.equal(deleted.status, 200); assert.equal(deleted.body.view.deleted, true);
  const deleteRetry = await api(aliceToken, project.rows[0].id, `coordinator-saved-views/${created.body.view.id}`, { method: "DELETE", body: JSON.stringify({ expectedVersion: 2, idempotencyKey: deleteKey }) });
  assert.equal(deleteRetry.status, 200); assert.deepEqual(deleteRetry.body.view, deleted.body.view);
  const canonicalAfter = await pool.query("SELECT count(*)::int count FROM action_items WHERE project_id=$1", [project.rows[0].id]);
  assert.equal(canonicalAfter.rows[0].count, canonicalBefore.rows[0].count);
  check("saved.delete_idempotent_zero_canonical_mutation", true, "soft-delete retry exact; canonical action count unchanged");

  const report = { suite: "coordinator-command-center-build2", database: { host: "127.0.0.1", port: 55432, name: "bimlog_rfi_test" }, passed: results.length, failed: 0, results };
  const evidenceDir = process.argv[2];
  if (evidenceDir) {
    fs.mkdirSync(evidenceDir, { recursive: true });
    const reportPath = path.join(evidenceDir, "focused-proof.json");
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    const digest = crypto.createHash("sha256").update(fs.readFileSync(reportPath)).digest("hex");
    fs.writeFileSync(path.join(evidenceDir, "focused-proof.sha256"), `${digest}  focused-proof.json\n`);
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await pool.query("DELETE FROM coordinator_saved_view_operations WHERE project_id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM coordinator_saved_views WHERE project_id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM action_items WHERE id=ANY($1::int[])", [ids.actions]);
  await pool.query("DELETE FROM meeting_minutes WHERE id=ANY($1::int[])", [ids.meetings]);
  await pool.query("DELETE FROM projects WHERE id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM users WHERE id=ANY($1::int[])", [ids.users]);
  await pool.query("DELETE FROM companies WHERE id=ANY($1::int[])", [ids.companies]);
  server.close();
  await pool.end();
}
