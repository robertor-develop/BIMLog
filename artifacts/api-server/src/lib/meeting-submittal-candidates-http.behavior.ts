import assert from "node:assert/strict";
import express from "express";
import { randomUUID } from "node:crypto";

const url = new URL(process.env.PROD_DATABASE_URL ?? "postgres://invalid/invalid");
if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/bimlog_p150_fixture_02") {
  throw Error("Isolated fixture required");
}
process.env.JWT_SECRET = "p181-fixture-only";

const { pool } = await import("@workspace/db");
const { default: router } = await import("../routes/meeting_minutes");
const { signToken } = await import("../middlewares/auth");
const mark = `p181-${randomUUID()}`;
const id = async (query: string, args: unknown[]) => Number((await pool.query(query, args)).rows[0].id);
const company = await id("INSERT INTO companies(name) VALUES($1) RETURNING id", [mark]);
const foreignCompany = await id("INSERT INTO companies(name) VALUES($1) RETURNING id", [`${mark}-other`]);
const user = async (name: string, companyId = company) => {
  const row = (await pool.query(
    "INSERT INTO users(email,password_hash,full_name,company_id) VALUES($1,'unused',$2,$3) RETURNING id,email",
    [`${mark}-${name}@example.test`, name, companyId],
  )).rows[0];
  return { ...row, companyId };
};
const owner = await user("owner");
const foreign = await user("foreign", foreignCompany);
const project = await id("INSERT INTO projects(code,name,status,created_by_id) VALUES($1,$1,'active',$2) RETURNING id", [mark, owner.id]);
const otherProject = await id("INSERT INTO projects(code,name,status,created_by_id) VALUES($1,$1,'active',$2) RETURNING id", [`${mark}-other`, owner.id]);
const meeting = await id("INSERT INTO meeting_minutes(project_id,title,meeting_date,created_by_id) VALUES($1,$2,now(),$3) RETURNING id", [project, "Canonical meeting", owner.id]);
const foreignMeeting = await id("INSERT INTO meeting_minutes(project_id,title,meeting_date,created_by_id) VALUES($1,$2,now(),$3) RETURNING id", [otherProject, "Foreign meeting", owner.id]);
const writerRole = `${mark}-writer`;
await pool.query("INSERT INTO config_options(category,value,label,label_es,meta) VALUES('member_role',$1,$1,$1,'{\"permission\":\"write\"}')", [writerRole]);
await pool.query("INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,$4,'active'),($1,$3,$4,'active')", [project, owner.id, foreign.id, writerRole]);
await pool.query(
  "INSERT INTO project_company_binding_versions(id,project_id,company_id,version,bound_by_id,reason_code,explanation_en,explanation_es,audit_evidence) VALUES($1,$2,$3,1,$4,'AUTHENTICATED_PROJECT_CREATION','Fixture current company binding','Vinculo actual de prueba','{}'),($5,$6,$3,1,$4,'AUTHENTICATED_PROJECT_CREATION','Fixture other binding','Otro vinculo de prueba','{}')",
  [randomUUID(), project, company, owner.id, randomUUID(), otherProject],
);
const submittal = await id(
  "INSERT INTO submittals(project_id,number,title,description,status,submittal_type,submitted_by_id,assigned_to_id,trade,floor,responsible_company,attachments_json) VALUES($1,'SUB-001','Fixture pump package','Source description','pending','product_data',$2,$2,'Plumbing','L2','Fixture Company','[\"private-file\"]') RETURNING id",
  [project, owner.id],
);
await pool.query(
  "INSERT INTO submittals(project_id,number,title,status,submittal_type,submitted_by_id,deleted_at) VALUES($1,'SUB-DELETED','Deleted private','pending','product_data',$2,now()),($3,'SUB-FOREIGN','Foreign secret','pending','product_data',$2,null)",
  [project, owner.id, otherProject],
);
const jwt = (actor: typeof owner) => signToken({ userId: actor.id, email: actor.email, companyId: actor.companyId, companyName: mark, fullName: "Fixture" });
const app = express();
app.use(express.json());
app.use("/api/v1", router);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const port = (server.address() as { port: number }).port;
const get = async (actor: typeof owner | null, query = "", projectId = project) => {
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/projects/${projectId}/meetings/submittal-candidates${query}`, {
    headers: actor ? { Authorization: `Bearer ${jwt(actor)}` } : {},
  });
  return { status: response.status, body: await response.json() as any, headers: response.headers };
};

try {
  assert.equal((await get(foreign)).status, 403);
  assert.equal((await get(null)).status, 401);
  assert.equal((await get(owner, "", otherProject)).status, 403);
  for (const value of ["bad", "0", "-1", "1.5"]) {
    assert.equal((await get(owner, `?meeting_id=${value}`)).status, 400);
  }
  assert.equal((await get(owner, `?meeting_id=${foreignMeeting}`)).status, 404);
  const expectedKeys = ["id", "number", "title", "description", "floor", "discipline", "disciplineBucket", "status", "responsible", "deadline", "alreadyAdded"].sort();
  for (const role of ["member", "finance", "project_admin", "company_admin"]) {
    const actor = await user(role);
    await pool.query("INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,$3,'active')", [project, actor.id, role]);
    const result = await get(actor);
    assert.equal(result.status, 200);
    assert.equal(result.body.length, 1);
    assert.deepEqual(Object.keys(result.body[0]).sort(), expectedKeys);
    assert.equal(result.body[0].id, submittal);
    assert.equal(result.body[0].responsible, "owner");
    assert.equal(result.body[0].alreadyAdded, false);
    assert.equal((await get(actor, "?q=pump&floor=L2&discipline=Plumbing&status=pending&responsible=owner")).body.length, 1);
    assert.equal((await get(actor, "?q=NO_MATCH")).body.length, 0);
  }
  const link = await fetch(`http://127.0.0.1:${port}/api/v1/projects/${project}/meetings/${meeting}/submittals`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt(owner)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ submittal_ids: [submittal] }),
  });
  assert.equal(link.status, 201);
  assert.equal((await get(owner, `?meeting_id=${meeting}`)).body[0].alreadyAdded, true);
  await pool.query("UPDATE meeting_minutes SET deleted_at=now() WHERE id=$1", [meeting]);
  assert.equal((await get(owner, `?meeting_id=${meeting}`)).status, 404);
  await pool.query("UPDATE submittals SET title='Fresh package after reopen' WHERE id=$1", [submittal]);
  assert.equal((await get(owner, "?q=Fresh")).body[0].title, "Fresh package after reopen");
  await pool.query("UPDATE users SET company_id=$1 WHERE id=$2", [foreignCompany, owner.id]);
  assert.equal((await get(owner)).status, 403);
  await pool.query("UPDATE users SET company_id=$1 WHERE id=$2", [company, owner.id]);
  await pool.query("UPDATE project_members SET status='inactive' WHERE project_id=$1 AND user_id=$2", [project, owner.id]);
  assert.equal((await get(owner)).status, 403);
  assert.equal((await pool.query("SELECT status FROM submittals WHERE id=$1", [submittal])).rows[0].status, "pending");
  console.log(JSON.stringify({ suite: "P181-real-submittal-candidates-http", roleClasses: 4, companyAndProjectIsolation: true, inactiveDenied: true, deletedSourcesExcluded: true, strictMeetingContext: true, linkedState: true, privateFieldsExcluded: true, persistence: true }));
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
