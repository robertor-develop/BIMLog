import assert from "node:assert/strict";
import express from "express";
import { pool } from "@workspace/db";
import projectsRouter from "../routes/projects";
import companyMasterCatalogsRouter from "../routes/company-master-catalogs";
import { signToken } from "../middlewares/auth";
import { ensureCompanyMasterCatalogSchema } from "./company-master-catalog-migration";

const scenario = process.argv.find((value) => value.startsWith("--scenario="))?.slice(11) ?? "all";
const connection = new URL(process.env.PROD_DATABASE_URL ?? "postgres://invalid/invalid");
if (connection.hostname !== "127.0.0.1" || connection.port !== "55449" || connection.pathname !== "/bimlog_recovery_ga_http_test")
  throw new Error("Refusing to run outside the approved disposable local recovery GA HTTP database.");

const companies = await pool.query(`INSERT INTO companies(name) VALUES('Synthetic GA Tenant'),('Synthetic Other Tenant') RETURNING id`);
const companyId = Number(companies.rows[0].id);
const otherCompanyId = Number(companies.rows[1].id);
const users = await pool.query(`INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin) VALUES
  ('admin@example.test','synthetic','Synthetic Administrator',$1,false),
  ('reader@example.test','synthetic','Synthetic Reader',$1,false),
  ('outsider@example.test','synthetic','Synthetic Outsider',$2,false) RETURNING id,email,company_id`, [companyId, otherCompanyId]);
const user = new Map(users.rows.map((row) => [String(row.email), { id: Number(row.id), companyId: Number(row.company_id) }]));
await pool.query(`INSERT INTO config_options(category,value,label,label_es,sort_order,meta) VALUES
  ('project_status','active','Active','Activo',1,'{}'),
  ('member_role','project_admin','Project administrator','Administrador de proyecto',1,'{"permission":"admin"}'),
  ('member_role','read_only','Read only','Solo lectura',2,'{"permission":"read"}')`);
await ensureCompanyMasterCatalogSchema();
await pool.query(`INSERT INTO company_master_catalog_administrators(id,company_id,user_id,granted_by_id) VALUES
  ('00000000-0000-4000-8000-000000000011',$1,$2,$2)`, [companyId, user.get("admin@example.test")!.id]);

const token = (email: string) => signToken({ userId: user.get(email)!.id, email, companyId: user.get(email)!.companyId, fullName: email, companyName: "Synthetic", isSuperAdmin: false });
const app = express(); app.use(express.json({ limit: "32kb" })); app.use("/api/v1", projectsRouter); app.use("/api/v1", companyMasterCatalogsRouter);
const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => { const value = app.listen(0, "127.0.0.1", () => resolve(value)); });
const address = server.address(); if (!address || typeof address === "string") throw new Error("HTTP evidence server did not bind.");
const request = async (path: string, email?: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers); if (email) headers.set("Authorization", `Bearer ${token(email)}`); if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`http://127.0.0.1:${address.port}/api/v1${path}`, { ...init, headers });
  const text = await response.text(); return { status: response.status, body: text ? JSON.parse(text) : null };
};
const checks: Record<string, unknown> = {};
try {
  if (scenario === "project" || scenario === "all") {
    assert.equal((await request("/projects")).status, 401);
    const created = await request("/projects", "admin@example.test", { method: "POST", body: JSON.stringify({ name: "Synthetic GA Project", code: "GA-HTTP-001", description: "Disposable authenticated HTTP evidence." }) });
    assert.equal(created.status, 201); const projectId = Number(created.body.id); assert.ok(projectId > 0);
    const reopened = await request(`/projects/${projectId}`, "admin@example.test"); assert.equal(reopened.status, 200); assert.equal(reopened.body.code, "GA-HTTP-001");
    const register = await request("/projects/workspace-register", "admin@example.test"); assert.equal(register.status, 200); assert.ok(register.body.some((row: any) => Number(row.id) === projectId));
    assert.equal((await request(`/projects/${projectId}`, "outsider@example.test")).status, 403);
    const binding = await pool.query(`SELECT company_id,reason_code FROM project_company_binding_versions WHERE project_id=$1`, [projectId]);
    assert.deepEqual(binding.rows[0], { company_id: companyId, reason_code: "AUTHENTICATED_PROJECT_CREATION" });
    checks.project = { projectId, create: 201, reload: 200, workspaceRegister: true, outsider: 403, companyBound: true };
  }
  if (scenario === "catalog" || scenario === "all") {
    assert.equal((await request("/company/master-catalogs/discipline")).status, 401);
    const created = await request("/company/master-catalogs/discipline", "admin@example.test", { method: "POST", body: JSON.stringify({ code: "MEP", name: "Synthetic MEP", aliases: ["Mechanical"] }) });
    assert.equal(created.status, 201); assert.equal(created.body.entry.code, "MEP");
    const read = await request("/company/master-catalogs/discipline", "reader@example.test");
    assert.equal(read.status, 200); assert.equal(read.body.entries.length, 1); assert.equal(read.body.entries[0].name, "Synthetic MEP");
    const otherTenant = await request("/company/master-catalogs/discipline", "outsider@example.test");
    assert.equal(otherTenant.status, 200); assert.deepEqual(otherTenant.body.entries, []);
    const deniedWrite = await request("/company/master-catalogs/discipline", "reader@example.test", { method: "POST", body: JSON.stringify({ code: "ARC", name: "Architecture" }) });
    assert.equal(deniedWrite.status, 403);
    checks.catalog = { create: 201, readerRead: 200, tenantIsolation: true, unauthorizedWrite: 403 };
  }
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await pool.end();
}
console.log(JSON.stringify({ suite: "recovery-ga-authenticated-http", scenario, database: { host: "127.0.0.1", port: 55449, disposable: true }, checks }, null, 2));
