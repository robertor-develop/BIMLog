import assert from "node:assert/strict";
import express from "express";
import { randomUUID } from "node:crypto";

const target = new URL(process.env.PROD_DATABASE_URL ?? "postgres://invalid/invalid");
if (target.hostname !== "127.0.0.1" || target.port !== "55439" || target.pathname !== "/bimlog_p150_fixture_02") throw Error("Isolated fixture required");
process.env.JWT_SECRET = "p183-fixture-only";
const { pool } = await import("@workspace/db");
const { default: router } = await import("../routes/members");
const { signToken } = await import("../middlewares/auth");
const mark = `p183-${randomUUID()}`;
const id = async (query: string, args: unknown[]) => Number((await pool.query(query, args)).rows[0].id);
const company = await id("INSERT INTO companies(name) VALUES($1) RETURNING id", [mark]);
const connectedCompany = await id("INSERT INTO companies(name) VALUES($1) RETURNING id", [`${mark}-connected`]);
const foreignCompany = await id("INSERT INTO companies(name) VALUES($1) RETURNING id", [`${mark}-foreign`]);
const makeUser = async (name: string, companyId = company) => {
  const row = (await pool.query("INSERT INTO users(email,password_hash,full_name,company_id) VALUES($1,'unused',$2,$3) RETURNING id,email", [`${mark}-${name}@example.test`, name, companyId])).rows[0];
  return { ...row, companyId };
};
const admin = await makeUser("admin");
const member = await makeUser("member");
const candidate = await makeUser("candidate", connectedCompany);
const foreign = await makeUser("foreign", foreignCompany);
const project = await id("INSERT INTO projects(code,name,status,created_by_id) VALUES($1,$1,'active',$2) RETURNING id", [mark, admin.id]);
await pool.query("INSERT INTO project_company_binding_versions(id,project_id,company_id,version,bound_by_id,reason_code,explanation_en,explanation_es,audit_evidence) VALUES($1,$2,$3,1,$4,'AUTHENTICATED_PROJECT_CREATION','Fixture binding','Vinculo de prueba','{}')", [randomUUID(), project, company, admin.id]);
const adminRole = `${mark}-admin`;
await pool.query("INSERT INTO config_options(category,value,label,label_es,meta) VALUES('member_role',$1,$1,$1,'{\"permission\":\"admin\"}')", [adminRole]);
const memberId = await id("INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,$3,'active') RETURNING id", [project, admin.id, adminRole]);
const ordinaryId = await id("INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,'member','active') RETURNING id", [project, member.id]);
await pool.query("INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,$3,'active')", [project, foreign.id, adminRole]);
await pool.query("INSERT INTO project_directory(project_id,company_id,full_name,email,role,added_by_id) VALUES($1,$2,$3,$4,'none',$5)", [project, connectedCompany, "Connected company contact", `${mark}-contact@example.test`, admin.id]);
const jwt = (actor: typeof admin) => signToken({ userId: actor.id, email: actor.email, companyId: actor.companyId, companyName: mark, fullName: "Fixture" });
const app = express(); app.use(express.json()); app.use("/api/v1", router);
const server = app.listen(0, "127.0.0.1"); await new Promise<void>((resolve) => server.once("listening", resolve));
const port = (server.address() as { port: number }).port;
const request = async (actor: typeof admin | null, path: string, init: RequestInit = {}) => {
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/projects/${project}/members${path}`, { ...init, headers: { ...(init.headers || {}), ...(actor ? { Authorization: `Bearer ${jwt(actor)}` } : {}) } });
  return { status: response.status, body: await response.json().catch(() => ({})) as any, headers: response.headers };
};
try {
  assert.equal((await request(null, "")).status, 401);
  for (const path of ["", "/eligible", "/current-view/pdf", `/${ordinaryId}`]) {
    const result = await request(foreign, path, path === `/${ordinaryId}` ? { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "member" }) } : {});
    assert.equal(result.status, 403, `foreign actor must be denied ${path}`);
  }
  const list = await request(member, "");
  assert.equal(list.status, 200);
  assert.equal(list.headers.get("cache-control"), "private, no-store");
  assert.equal(list.headers.get("x-bimlog-project-id"), String(project));
  assert.equal(list.body.some((row: any) => row.id === ordinaryId), true);
  assert.equal((await request(member, "/eligible")).status, 403);
  const eligible = await request(admin, "/eligible");
  assert.equal(eligible.status, 200);
  assert.equal(eligible.body.some((row: any) => row.id === candidate.id), true);
  const pdf = await fetch(`http://127.0.0.1:${port}/api/v1/projects/${project}/members/current-view/pdf?lang=es&status=active&group_by=company`, { headers: { Authorization: `Bearer ${jwt(member)}` } });
  const pdfBytes = new Uint8Array(await pdf.arrayBuffer());
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.equal(pdf.headers.get("cache-control"), "private, no-store");
  assert.equal(pdf.headers.get("x-bimlog-project-id"), String(project));
  assert.equal(Buffer.from(pdfBytes.subarray(0, 5)).toString("ascii"), "%PDF-");
  assert.equal(pdfBytes.length > 1_000, true);
  const updated = await request(admin, `/${ordinaryId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: adminRole }) });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.role, adminRole);
  const invalid = await request(admin, `/${ordinaryId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: `${mark}-invalid` }) });
  assert.equal(invalid.status, 422);
  const removed = await request(admin, `/${ordinaryId}`, { method: "DELETE" });
  assert.equal(removed.status, 200);
  assert.equal((await pool.query("SELECT count(*)::int n FROM project_members WHERE id=$1", [ordinaryId])).rows[0].n, 0);
  assert.equal((await pool.query("SELECT count(*)::int n FROM activity_log WHERE project_id=$1 AND entity_id=$2 AND action_type='remove_member'", [project, ordinaryId])).rows[0].n, 1);
  await pool.query("UPDATE project_members SET status='inactive' WHERE id=$1", [memberId]);
  assert.equal((await request(admin, "")).status, 403);
  console.log(JSON.stringify({ suite: "P183-project-members-authority-http", currentCompanyIsolation: true, inactiveDenied: true, memberRead: true, adminEligible: true, currentViewPdf: true, roleUpdate: true, invalidRoleDenied: true, deleteAuditPersistence: true }));
} finally {
  server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); await pool.end();
}
