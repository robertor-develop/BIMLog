import assert from "node:assert/strict";
import express from "express";
import { randomUUID } from "node:crypto";

const target = new URL(process.env.PROD_DATABASE_URL ?? "postgres://invalid/invalid");
if (target.hostname !== "127.0.0.1" || target.port !== "55439" || target.pathname !== "/bimlog_p150_fixture_02") throw Error("Isolated fixture required");
process.env.JWT_SECRET = "p182-fixture-only";
let externalCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname !== "127.0.0.1") { externalCalls++; throw Error("External provider access forbidden"); }
  return originalFetch(input, init);
};
const { pool } = await import("@workspace/db");
const { default: router } = await import("../routes/meeting_minutes");
const { signToken } = await import("../middlewares/auth");
const mark = `p182-${randomUUID()}`;
const company = Number((await pool.query("INSERT INTO companies(name) VALUES($1) RETURNING id", [mark])).rows[0].id);
const foreignCompany = Number((await pool.query("INSERT INTO companies(name) VALUES($1) RETURNING id", [`${mark}-foreign`])).rows[0].id);
const makeUser = async (name: string, companyId = company) => {
  const row = (await pool.query("INSERT INTO users(email,password_hash,full_name,company_id) VALUES($1,'unused',$2,$3) RETURNING id,email", [`${mark}-${name}@example.test`, name, companyId])).rows[0];
  return { ...row, companyId };
};
const owner = await makeUser("owner");
const foreign = await makeUser("foreign", foreignCompany);
const project = Number((await pool.query("INSERT INTO projects(code,name,status,created_by_id) VALUES($1,$1,'active',$2) RETURNING id", [mark, owner.id])).rows[0].id);
await pool.query("INSERT INTO project_company_binding_versions(id,project_id,company_id,version,bound_by_id,reason_code,explanation_en,explanation_es,audit_evidence) VALUES($1,$2,$3,1,$4,'AUTHENTICATED_PROJECT_CREATION','Fixture binding','Vinculo de prueba','{}')", [randomUUID(), project, company, owner.id]);
const role = `${mark}-writer`;
await pool.query("INSERT INTO config_options(category,value,label,label_es,meta) VALUES('member_role',$1,$1,$1,'{\"permission\":\"write\"}')", [role]);
await pool.query("INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,$4,'active'),($1,$3,$4,'active')", [project, owner.id, foreign.id, role]);
const jwt = (actor: typeof owner) => signToken({ userId: actor.id, email: actor.email, companyId: actor.companyId, companyName: mark, fullName: "Fixture" });
const app = express(); app.use(express.json()); app.use("/api/v1", router);
const server = app.listen(0, "127.0.0.1"); await new Promise<void>((resolve) => server.once("listening", resolve));
const port = (server.address() as { port: number }).port;
const post = async (actor: typeof owner | null) => {
  const response = await originalFetch(`http://127.0.0.1:${port}/api/v1/projects/${project}/meetings/transcribe-audio`, { method: "POST", headers: actor ? { Authorization: `Bearer ${jwt(actor)}` } : {} });
  return { status: response.status, body: await response.json() as any, headers: response.headers };
};
try {
  assert.equal((await post(null)).status, 401);
  assert.equal((await post(foreign)).status, 403);
  for (const roleName of ["member", "finance", "project_admin", "company_admin"]) {
    const actor = await makeUser(roleName);
    await pool.query("INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,$3,'active')", [project, actor.id, roleName]);
    const result = await post(actor);
    assert.equal(result.status, 410);
    assert.equal(result.body.code, "LEGACY_AI_AUDIO_RETIRED");
    assert.match(result.body.nextStep, /manual meeting entry/);
    assert.equal(result.headers.get("cache-control"), "private, no-store");
    assert.equal(result.headers.get("x-bimlog-audio-capability"), "governed-provider-required");
  }
  await pool.query("UPDATE project_members SET status='inactive' WHERE project_id=$1 AND user_id=$2", [project, owner.id]);
  assert.equal((await post(owner)).status, 403);
  assert.equal(externalCalls, 0);
  console.log(JSON.stringify({ suite: "P182-real-transcribe-audio-http", roleClasses: 4, currentCompanyIsolation: true, inactiveDenied: true, honestCapabilityState: true, actionableNextStep: true, externalCalls }));
} finally {
  globalThis.fetch = originalFetch;
  server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); await pool.end();
}
