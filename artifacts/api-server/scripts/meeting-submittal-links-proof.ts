import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { PDFParse } from "pdf-parse";

if (!process.env.PROD_DATABASE_URL) throw new Error("Load the isolated local test environment before running this proof script.");
process.env.JWT_SECRET ||= "meeting-submittal-links-local-proof-secret";

const evidenceDir = process.argv[2] || path.join("tmp", "meeting-minutes-m2-submittal-links");
fs.mkdirSync(evidenceDir, { recursive: true });

const [{ pool }, { signToken }, { default: app }] = await Promise.all([
  import("@workspace/db"), import("../src/middlewares/auth"), import("../src/app"),
]);

async function waitForSchema() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { await pool.query("SELECT 1 FROM meeting_submittal_links LIMIT 1"); return; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  throw new Error("meeting_submittal_links migration did not become ready");
}

function listen(): Promise<{ server: http.Server; baseUrl: string }> {
  const server = http.createServer(app);
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => {
    const address = server.address(); assert.equal(typeof address, "object");
    resolve({ server, baseUrl: `http://127.0.0.1:${address!.port}` });
  }));
}

async function api(baseUrl: string, pathname: string, token?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers); headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${baseUrl}/api/v1${pathname}`, { ...init, headers });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : null };
}

await waitForSchema();
const marker = `meeting-m2-${Date.now()}`;
const ids: { company?: number; users: number[]; projects: number[]; meetings: number[]; submittals: number[] } = { users: [], projects: [], meetings: [], submittals: [] };
const results: Record<string, boolean> = {};
const { server, baseUrl } = await listen();

try {
  const company = await pool.query<{ id: number }>("INSERT INTO companies(name) VALUES($1) RETURNING id", [`${marker}-company`]);
  ids.company = company.rows[0].id;
  const makeUser = async (label: string) => {
    const row = await pool.query<{ id: number; email: string; full_name: string }>("INSERT INTO users(email,password_hash,full_name,company_id) VALUES($1,'proof',$2,$3) RETURNING id,email,full_name", [`${marker}-${label}@example.invalid`, `${marker}-${label}`, ids.company]);
    ids.users.push(row.rows[0].id); return row.rows[0];
  };
  const member = await makeUser("member"); const outsider = await makeUser("outsider");
  const makeProject = async (label: string) => {
    const row = await pool.query<{ id: number }>("INSERT INTO projects(name,code,status,created_by_id) VALUES($1,$2,'active',$3) RETURNING id", [`${marker}-${label}`, `${marker}-${label}`, member.id]);
    ids.projects.push(row.rows[0].id); return row.rows[0].id;
  };
  const projectA = await makeProject("a"); const projectB = await makeProject("b");
  const role = await pool.query<{ value: string }>("SELECT value FROM config_options WHERE category='member_role' AND meta->>'permission' IN ('admin','write') ORDER BY CASE meta->>'permission' WHEN 'admin' THEN 0 ELSE 1 END LIMIT 1");
  assert.ok(role.rows[0]?.value);
  await pool.query("INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,$3,'active'),($4,$2,$3,'active')", [projectA, member.id, role.rows[0].value, projectB]);
  const token = signToken({ userId: member.id, email: member.email, companyId: ids.company!, fullName: member.full_name, companyName: `${marker}-company` });
  const outsiderToken = signToken({ userId: outsider.id, email: outsider.email, companyId: ids.company!, fullName: outsider.full_name, companyName: `${marker}-company` });

  const makeSubmittal = async (projectId: number, values: { number: string; title: string; description: string; floor?: string; trade?: string; status?: string; responsible?: string; deleted?: boolean }) => {
    const row = await pool.query<{ id: number }>(`INSERT INTO submittals(project_id,number,title,description,status,submittal_type,submitted_by_id,floor,trade,responsible_company,date_required,deleted_at)
      VALUES($1,$2,$3,$4,$5,'shop_drawing',$6,$7,$8,$9,'2026-08-15T00:00:00Z',$10) RETURNING id`, [projectId, values.number, values.title, values.description, values.status || "under_review", member.id, values.floor || null, values.trade || null, values.responsible || null, values.deleted ? new Date() : null]);
    ids.submittals.push(row.rows[0].id); return row.rows[0].id;
  };
  const plumbing = await makeSubmittal(projectA, { number: `${marker}-001`, title: "Pump package", description: "Domestic water pump coordination", floor: "Level 1", trade: "Plumbing", status: "under_review", responsible: "Aqua Contractors" });
  const electrical = await makeSubmittal(projectA, { number: `${marker}-002`, title: "Panel schedules", description: "Emergency distribution panel package", floor: "Level 2", trade: "Electrical", status: "submitted", responsible: "Volt LLC" });
  const mechanical = await makeSubmittal(projectA, { number: `${marker}-003`, title: "Air handling units", description: "Rooftop AHU package", floor: "Roof", trade: "Mechanical", status: "approved", responsible: "Air Systems" });
  const unmapped = await makeSubmittal(projectA, { number: `${marker}-004`, title: "Millwork", description: "Lobby casework", floor: "Lobby", trade: "Architectural", status: "pending", responsible: "Wood Co" });
  const missingTrade = await makeSubmittal(projectA, { number: `${marker}-005`, title: "Unclassified", description: "No trade supplied", floor: "Cellar", status: "pending", responsible: "General GC" });
  const concurrentId = await makeSubmittal(projectA, { number: `${marker}-006`, title: "Concurrency", description: "Duplicate guard", trade: "Fire Protection", responsible: "Fire Safe" });
  const crossProjectId = await makeSubmittal(projectB, { number: `${marker}-900`, title: "Other project", description: "Must not link", trade: "Electrical" });
  const deletedId = await makeSubmittal(projectA, { number: `${marker}-999`, title: "Deleted", description: "Must not link", trade: "HVAC", deleted: true });
  const initialCount = await pool.query<{ count: string }>("SELECT count(*)::text count FROM submittals WHERE project_id=$1", [projectA]);

  assert.equal((await api(baseUrl, `/projects/${projectA}/meetings/submittal-candidates`)).status, 401);
  assert.equal((await api(baseUrl, `/projects/${projectA}/meetings/submittal-candidates`, outsiderToken)).status, 403);
  results.authenticationAndMembership = true;

  const candidatesPath = `/projects/${projectA}/meetings/submittal-candidates`;
  const byNumber = await api(baseUrl, `${candidatesPath}?q=${encodeURIComponent("-001")}`, token);
  assert.deepEqual(byNumber.json.map((row: any) => row.id), [plumbing]); results.searchByNumber = true;
  const byDescription = await api(baseUrl, `${candidatesPath}?q=${encodeURIComponent("Emergency distribution")}`, token);
  assert.deepEqual(byDescription.json.map((row: any) => row.id), [electrical]); results.searchByDescription = true;
  assert.deepEqual((await api(baseUrl, `${candidatesPath}?floor=${encodeURIComponent("Level 2")}`, token)).json.map((row: any) => row.id), [electrical]); results.floorFilter = true;
  assert.deepEqual((await api(baseUrl, `${candidatesPath}?discipline=Mechanical`, token)).json.map((row: any) => row.id), [mechanical]); results.disciplineFilter = true;
  assert.deepEqual((await api(baseUrl, `${candidatesPath}?status=approved`, token)).json.map((row: any) => row.id), [mechanical]); results.statusFilter = true;
  assert.deepEqual((await api(baseUrl, `${candidatesPath}?responsible=${encodeURIComponent("Volt")}`, token)).json.map((row: any) => row.id), [electrical]); results.responsibleFilter = true;
  const combined = await api(baseUrl, `${candidatesPath}?q=panel&floor=${encodeURIComponent("Level 2")}&discipline=Electrical&status=submitted&responsible=Volt`, token);
  assert.deepEqual(combined.json.map((row: any) => row.id), [electrical]); results.combinedFilters = true;
  assert.deepEqual(Object.keys(combined.json[0]).sort(), ["alreadyAdded", "deadline", "description", "discipline", "disciplineBucket", "floor", "id", "number", "responsible", "status", "title"]);
  assert.ok(!JSON.stringify(combined.json).match(/attachment|storage|url|audit|email|phone|password/i)); results.selectorPayloadSanitized = true;

  const legacyNotes = `AGENDA:\n1. Coordination\n\nDELIVERABLES:\nLEVEL 1 | Legacy manual package | PL:PENDING | HVAC: | FP: | ELE: | DEADLINE:2026-08-01`;
  const created = await api(baseUrl, `/projects/${projectA}/meetings`, token, { method: "POST", body: JSON.stringify({ title: `${marker} meeting`, meeting_date: "2026-07-20T10:00:00", notes: legacyNotes, submittal_ids: [plumbing, electrical, mechanical, unmapped, missingTrade] }) });
  assert.equal(created.status, 201); ids.meetings.push(created.json.id); const meetingId = created.json.id as number;
  let detail = await api(baseUrl, `/projects/${projectA}/meetings/${meetingId}`, token);
  assert.equal(detail.json.linkedSubmittals.length, 5); assert.equal(detail.json.notes, legacyNotes); assert.equal(detail.json.legacyDeliverables.length, 1);
  assert.ok(detail.json.linkedSubmittals.every((row: any) => row.valuesMode === "snapshot"));
  results.multiSelect = true; results.reloadPersistence = true; results.legacyManualRowPreserved = true;
  const buckets = new Map(detail.json.linkedSubmittals.map((row: any) => [row.submittalId, row.disciplineBucket]));
  assert.equal(buckets.get(plumbing), "plumbing"); assert.equal(buckets.get(electrical), "electrical"); assert.equal(buckets.get(mechanical), "hvac"); assert.equal(buckets.get(unmapped), "other"); assert.equal(buckets.get(missingTrade), null);
  results.automaticFieldAndDisciplineMapping = true;

  const already = await api(baseUrl, `${candidatesPath}?meeting_id=${meetingId}`, token);
  assert.equal(already.json.find((row: any) => row.id === plumbing).alreadyAdded, true); results.alreadyAddedState = true;
  const duplicate = await api(baseUrl, `/projects/${projectA}/meetings/${meetingId}/submittals`, token, { method: "POST", body: JSON.stringify({ submittal_ids: [plumbing, plumbing] }) });
  assert.equal(duplicate.status, 200); assert.equal(duplicate.json.added, 0); results.duplicateSelectionBlocked = true;
  const concurrent = await Promise.all([1, 2].map(() => api(baseUrl, `/projects/${projectA}/meetings/${meetingId}/submittals`, token, { method: "POST", body: JSON.stringify({ submittal_ids: [concurrentId] }) })));
  assert.ok(concurrent.every(response => [200, 201].includes(response.status)));
  const concurrentCount = await pool.query<{ count: string }>("SELECT count(*)::text count FROM meeting_submittal_links WHERE meeting_id=$1 AND submittal_id=$2", [meetingId, concurrentId]);
  assert.equal(concurrentCount.rows[0].count, "1"); results.concurrentDuplicateGuard = true;

  const crossProject = await api(baseUrl, `/projects/${projectA}/meetings/${meetingId}/submittals`, token, { method: "POST", body: JSON.stringify({ submittal_ids: [crossProjectId] }) });
  assert.equal(crossProject.status, 404); assert.equal(crossProject.json.error, "submittal_not_accessible"); results.crossProjectRejected = true;
  const deleted = await api(baseUrl, `/projects/${projectA}/meetings/${meetingId}/submittals`, token, { method: "POST", body: JSON.stringify({ submittal_ids: [deletedId] }) });
  assert.equal(deleted.status, 404); assert.equal(deleted.json.error, "submittal_not_accessible"); results.deletedOrInaccessibleRejected = true;
  assert.equal((await api(baseUrl, `/projects/${projectA}/meetings/${meetingId}/submittals`, outsiderToken, { method: "POST", body: JSON.stringify({ submittal_ids: [concurrentId] }) })).status, 403); results.unauthorizedMutationRejected = true;

  const snapshotBefore = detail.json.linkedSubmittals.find((row: any) => row.submittalId === plumbing);
  await pool.query("UPDATE submittals SET title='Changed later',status='approved',trade='Electrical',updated_at=now() WHERE id=$1", [plumbing]);
  detail = await api(baseUrl, `/projects/${projectA}/meetings/${meetingId}`, token);
  const snapshotAfter = detail.json.linkedSubmittals.find((row: any) => row.submittalId === plumbing);
  assert.deepEqual(snapshotAfter, snapshotBefore); results.meetingTimeSnapshotPreserved = true;

  const exportResponse = await fetch(`${baseUrl}/api/v1/projects/${projectA}/reports/meeting-minutes/pdf?token=${encodeURIComponent(token)}`);
  assert.equal(exportResponse.status, 200); assert.match(exportResponse.headers.get("content-type") || "", /application\/pdf/);
  const exportParser = new PDFParse({ data: new Uint8Array(await exportResponse.arrayBuffer()) });
  const exportText = await exportParser.getText(); await exportParser.destroy();
  assert.ok(exportText.text.includes("Pump package")); assert.ok(!exportText.text.includes("Changed later"));
  results.exportUsesSnapshots = true;

  const beforeUnlink = await pool.query("SELECT * FROM submittals WHERE id=$1", [plumbing]);
  const removed = await api(baseUrl, `/projects/${projectA}/meetings/${meetingId}/submittals/${plumbing}`, token, { method: "DELETE" });
  assert.equal(removed.status, 200);
  const afterUnlink = await pool.query("SELECT * FROM submittals WHERE id=$1", [plumbing]); assert.deepEqual(afterUnlink.rows, beforeUnlink.rows);
  results.unlinkWithoutCanonicalMutation = true;

  const uiSource = fs.readFileSync(path.resolve("artifacts/bimlog/src/pages/project/MeetingsTab.tsx"), "utf8");
  const submittalUiSource = fs.readFileSync(path.resolve("artifacts/bimlog/src/pages/project/SubmittalsTab.tsx"), "utf8");
  assert.ok(uiSource.includes('t("Add from Submittal Log", "Añadir desde el Registro de Submittals")'));
  assert.ok(uiSource.includes("Open Original Submittal")); assert.ok(submittalUiSource.includes('params.get("submittal")'));
  results.openOriginalDeepLink = true; results.englishSpanishControls = true; results.desktopAnd390ResponsiveRules = uiSource.includes('calc(100vw - 24px)') && uiSource.includes('overflowX: "auto"');
  const finalCount = await pool.query<{ count: string }>("SELECT count(*)::text count FROM submittals WHERE project_id=$1", [projectA]);
  assert.equal(finalCount.rows[0].count, initialCount.rows[0].count); results.noSubmittalCreated = true;

  const report = { suite: "meeting-minutes-m2-submittal-links", marker, passed: Object.keys(results).length, results };
  fs.writeFileSync(path.join(evidenceDir, "focused-proof.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
} finally {
  server.close();
  if (ids.projects.length) {
    await pool.query("DELETE FROM activity_log WHERE project_id = ANY($1::int[])", [ids.projects]);
    await pool.query("DELETE FROM meeting_submittal_links WHERE project_id = ANY($1::int[])", [ids.projects]);
    await pool.query("DELETE FROM meeting_attendees WHERE meeting_id = ANY($1::int[])", [ids.meetings]);
    await pool.query("DELETE FROM action_items WHERE project_id = ANY($1::int[])", [ids.projects]);
    await pool.query("DELETE FROM meeting_minutes WHERE project_id = ANY($1::int[])", [ids.projects]);
    await pool.query("DELETE FROM submittals WHERE id = ANY($1::int[])", [ids.submittals]);
    await pool.query("DELETE FROM project_members WHERE project_id = ANY($1::int[])", [ids.projects]);
    await pool.query("DELETE FROM projects WHERE id = ANY($1::int[])", [ids.projects]);
  }
  if (ids.users.length) await pool.query("DELETE FROM users WHERE id = ANY($1::int[])", [ids.users]);
  if (ids.company) await pool.query("DELETE FROM companies WHERE id=$1", [ids.company]);
  await pool.end();
}

process.exit(0);
