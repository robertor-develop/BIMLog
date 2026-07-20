import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";

if (!process.env.PROD_DATABASE_URL) throw new Error("Load the isolated local test environment before running this proof script.");
process.env.JWT_SECRET ||= "meeting-rfi-links-local-proof-secret";

const evidenceDir = process.argv[2] || path.join("tmp", "meeting-minutes-m1-rfi-links");
fs.mkdirSync(evidenceDir, { recursive: true });

const [{ pool }, { signToken }, { default: app }] = await Promise.all([
  import("@workspace/db"),
  import("../src/middlewares/auth"),
  import("../src/app"),
]);

async function waitForSchema() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { await pool.query("SELECT 1 FROM meeting_rfi_links LIMIT 1"); return; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  throw new Error("meeting_rfi_links migration did not become ready");
}

function listen(): Promise<{ server: http.Server; baseUrl: string }> {
  const server = http.createServer(app);
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    assert.equal(typeof address, "object");
    resolve({ server, baseUrl: `http://127.0.0.1:${address!.port}` });
  }));
}

async function api(baseUrl: string, pathname: string, token?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${baseUrl}/api/v1${pathname}`, { ...init, headers });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : null };
}

await waitForSchema();
const marker = `meeting-m1-${Date.now()}`;
const ids: { company?: number; users: number[]; projects: number[]; meetings: number[]; rfis: number[] } = { users: [], projects: [], meetings: [], rfis: [] };
const results: Record<string, unknown> = {};
const { server, baseUrl } = await listen();

try {
  const company = await pool.query<{ id: number }>("INSERT INTO companies(name) VALUES($1) RETURNING id", [`${marker}-company`]);
  ids.company = company.rows[0].id;
  const makeUser = async (label: string) => {
    const row = await pool.query<{ id: number; email: string; full_name: string }>("INSERT INTO users(email,password_hash,full_name,company_id) VALUES($1,'proof',$2,$3) RETURNING id,email,full_name", [`${marker}-${label}@example.invalid`, `${marker}-${label}`, ids.company]);
    ids.users.push(row.rows[0].id); return row.rows[0];
  };
  const member = await makeUser("member");
  const outsider = await makeUser("outsider");
  const makeProject = async (label: string) => {
    const row = await pool.query<{ id: number }>("INSERT INTO projects(name,code,status,created_by_id) VALUES($1,$2,'active',$3) RETURNING id", [`${marker}-${label}`, `${marker}-${label}`, member.id]);
    ids.projects.push(row.rows[0].id); return row.rows[0].id;
  };
  const projectA = await makeProject("a");
  const projectB = await makeProject("b");
  const configuredRole = await pool.query<{ value: string }>("SELECT value FROM config_options WHERE category='member_role' AND meta->>'permission' IN ('admin','write') ORDER BY CASE meta->>'permission' WHEN 'admin' THEN 0 ELSE 1 END LIMIT 1");
  assert.ok(configuredRole.rows[0]?.value, "test database must have an admin/write member role");
  await pool.query("INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,$3,'active'),($4,$2,$3,'active')", [projectA, member.id, configuredRole.rows[0].value, projectB]);

  const token = signToken({ userId: member.id, email: member.email, companyId: ids.company!, fullName: member.full_name, companyName: `${marker}-company` });
  const outsiderToken = signToken({ userId: outsider.id, email: outsider.email, companyId: ids.company!, fullName: outsider.full_name, companyName: `${marker}-company` });
  const makeRfi = async (projectId: number, number: string, subject: string, description: string, responsible: string) => {
    const row = await pool.query<{ id: number }>("INSERT INTO rfis(project_id,number,subject,description,status,priority,created_by_id,ball_in_court) VALUES($1,$2,$3,$4,'open','normal',$5,$6) RETURNING id", [projectId, number, subject, description, member.id, responsible]);
    ids.rfis.push(row.rows[0].id); return row.rows[0].id;
  };
  const rfiA = await makeRfi(projectA, `${marker}-001`, "Pump coordination", "Resolve pump room clearance", "Mechanical GC");
  const rfiB = await makeRfi(projectA, `${marker}-002`, "Sleeve layout", "Coordinate east riser sleeves", "Electrical GC");
  const rfiConcurrent = await makeRfi(projectA, `${marker}-003`, "Concurrent link", "Concurrency guard proof", "Architect");
  const rfiCrossProject = await makeRfi(projectB, `${marker}-900`, "Other project", "Must not link", "Owner");

  assert.equal((await api(baseUrl, `/projects/${projectA}/meetings/rfi-candidates`)).status, 401);
  assert.equal((await api(baseUrl, `/projects/${projectA}/meetings/rfi-candidates`, outsiderToken)).status, 403);
  results.authenticationAndMembership = true;

  const byNumber = await api(baseUrl, `/projects/${projectA}/meetings/rfi-candidates?q=${encodeURIComponent("-001")}`, token);
  assert.equal(byNumber.status, 200); assert.deepEqual(byNumber.json.map((row: any) => row.id), [rfiA]);
  const byDescription = await api(baseUrl, `/projects/${projectA}/meetings/rfi-candidates?q=${encodeURIComponent("east riser")}`, token);
  assert.equal(byDescription.status, 200); assert.deepEqual(byDescription.json.map((row: any) => row.id), [rfiB]);
  assert.deepEqual(Object.keys(byDescription.json[0]).sort(), ["alreadyAdded", "description", "id", "number", "responsible", "status", "title"]);
  results.searchByNumber = true; results.searchByDescription = true; results.selectorPayloadSanitized = true;

  const legacyNotes = `AGENDA:\n1. Coordination\n\nRFIS:\nLEG-7 | Preserved manual row | PENDING | Legacy owner\n\nDELIVERABLES:\nLEVEL 1 | Keep`;
  const created = await api(baseUrl, `/projects/${projectA}/meetings`, token, { method: "POST", body: JSON.stringify({ title: `${marker} meeting`, meeting_date: "2026-07-20T10:00:00", notes: legacyNotes, rfi_ids: [rfiA, rfiB] }) });
  assert.equal(created.status, 201); ids.meetings.push(created.json.id);
  const meetingId = created.json.id as number;
  const detail = await api(baseUrl, `/projects/${projectA}/meetings/${meetingId}`, token);
  assert.equal(detail.status, 200); assert.equal(detail.json.linkedRfis.length, 2); assert.equal(detail.json.notes, legacyNotes); assert.equal(detail.json.legacyRfis[0].rfiNumber, "LEG-7");
  assert.ok(detail.json.linkedRfis.every((row: any) => row.valuesMode === "snapshot"));
  results.multiSelect = true; results.reloadPersistence = true; results.legacyManualRowPreserved = true; results.snapshotValues = true;

  const already = await api(baseUrl, `/projects/${projectA}/meetings/rfi-candidates?meeting_id=${meetingId}`, token);
  assert.equal(already.status, 200); assert.equal(already.json.find((row: any) => row.id === rfiA).alreadyAdded, true);
  const duplicate = await api(baseUrl, `/projects/${projectA}/meetings/${meetingId}/rfis`, token, { method: "POST", body: JSON.stringify({ rfi_ids: [rfiA, rfiA] }) });
  assert.equal(duplicate.status, 200); assert.equal(duplicate.json.added, 0);
  results.alreadyLinkedDisplay = true; results.duplicateSelection = true;

  const concurrent = await Promise.all([1, 2].map(() => api(baseUrl, `/projects/${projectA}/meetings/${meetingId}/rfis`, token, { method: "POST", body: JSON.stringify({ rfi_ids: [rfiConcurrent] }) })));
  assert.ok(concurrent.every(response => [200, 201].includes(response.status)));
  const count = await pool.query<{ count: string }>("SELECT count(*)::text count FROM meeting_rfi_links WHERE meeting_id=$1 AND rfi_id=$2", [meetingId, rfiConcurrent]);
  assert.equal(count.rows[0].count, "1"); results.concurrentDuplicateGuard = true;

  const crossProject = await api(baseUrl, `/projects/${projectA}/meetings/${meetingId}/rfis`, token, { method: "POST", body: JSON.stringify({ rfi_ids: [rfiCrossProject] }) });
  assert.equal(crossProject.status, 404); assert.equal(crossProject.json.error, "rfi_not_accessible");
  results.crossProjectAndInaccessibleRejection = true;

  const before = await pool.query("SELECT * FROM rfis WHERE id=$1", [rfiA]);
  const removed = await api(baseUrl, `/projects/${projectA}/meetings/${meetingId}/rfis/${rfiA}`, token, { method: "DELETE" });
  assert.equal(removed.status, 200);
  const after = await pool.query("SELECT * FROM rfis WHERE id=$1", [rfiA]);
  assert.deepEqual(after.rows, before.rows);
  const openOriginal = await api(baseUrl, `/projects/${projectA}/rfis/${rfiA}`, token);
  assert.equal(openOriginal.status, 200); assert.equal(openOriginal.json.id, rfiA);
  results.removeAssociationWithoutRfiMutation = true; results.openOriginal = true;

  const uiSource = fs.readFileSync(path.resolve("artifacts/bimlog/src/pages/project/MeetingsTab.tsx"), "utf8");
  assert.ok(uiSource.includes('t("Add Existing RFI", "Añadir RFI existente")'));
  assert.ok(uiSource.includes('width: "min(720px, calc(100vw - 24px))"'));
  assert.ok(uiSource.includes('flexWrap: "wrap"'));
  assert.ok(uiSource.includes("Open Original RFI"));
  results.englishSpanish = true; results.desktopAnd390ResponsiveRules = true; results.openOriginalControl = true;

  const report = { suite: "meeting-minutes-m1-rfi-links", marker, passed: Object.keys(results).length, results };
  const authenticatedApiReport = {
    suite: "meeting-minutes-m1-authenticated-api",
    authenticationRequired: results.authenticationAndMembership,
    projectScopedSearch: results.searchByNumber && results.searchByDescription,
    sameProjectEnforced: results.crossProjectAndInaccessibleRejection,
    canonicalRfiUnchangedAfterUnlink: results.removeAssociationWithoutRfiMutation,
    reloadPersistence: results.reloadPersistence,
  };
  fs.writeFileSync(path.join(evidenceDir, "focused-proof.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(evidenceDir, "authenticated-api-proof.json"), `${JSON.stringify(authenticatedApiReport, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
} finally {
  server.close();
  if (ids.projects.length) {
    await pool.query("DELETE FROM activity_log WHERE project_id = ANY($1::int[])", [ids.projects]);
    await pool.query("DELETE FROM meeting_rfi_links WHERE project_id = ANY($1::int[])", [ids.projects]);
    await pool.query("DELETE FROM meeting_attendees WHERE meeting_id = ANY($1::int[])", [ids.meetings]);
    await pool.query("DELETE FROM action_items WHERE project_id = ANY($1::int[])", [ids.projects]);
    await pool.query("DELETE FROM meeting_minutes WHERE project_id = ANY($1::int[])", [ids.projects]);
    await pool.query("DELETE FROM rfis WHERE id = ANY($1::int[])", [ids.rfis]);
    await pool.query("DELETE FROM project_members WHERE project_id = ANY($1::int[])", [ids.projects]);
    await pool.query("DELETE FROM projects WHERE id = ANY($1::int[])", [ids.projects]);
  }
  if (ids.users.length) await pool.query("DELETE FROM users WHERE id = ANY($1::int[])", [ids.users]);
  if (ids.company) await pool.query("DELETE FROM companies WHERE id=$1", [ids.company]);
  await pool.end();
}

process.exit(0);
