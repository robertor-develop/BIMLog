import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { pool } from "@workspace/db";
import router from "../routes/company-master-catalogs";
import selectorRouter from "../routes/master-catalogs";
import { signToken } from "../middlewares/auth";

const target = new URL(process.env.PROD_DATABASE_URL ?? "postgres://invalid/invalid");
if (target.hostname !== "127.0.0.1" || target.port !== "55439") throw new Error("This test runs only against the isolated local PostgreSQL port 55439.");
await pool.query(`CREATE TABLE IF NOT EXISTS enterprise_trades(id serial PRIMARY KEY,code text NOT NULL,name text NOT NULL,state text NOT NULL DEFAULT 'active',created_by_id integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`);
await pool.query(`CREATE TABLE IF NOT EXISTS enterprise_services(id text PRIMARY KEY,code text NOT NULL,name text NOT NULL,state text NOT NULL DEFAULT 'active',version integer NOT NULL DEFAULT 1,created_by_id integer NOT NULL,updated_by_id integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),retired_at timestamptz)`);
await pool.query(`CREATE TABLE IF NOT EXISTS enterprise_phases(id text PRIMARY KEY,code text NOT NULL,name text NOT NULL,state text NOT NULL DEFAULT 'active',version integer NOT NULL DEFAULT 1,created_by_id integer NOT NULL,updated_by_id integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),retired_at timestamptz)`);
await pool.query(`CREATE TABLE IF NOT EXISTS projects(id serial PRIMARY KEY,status text NOT NULL DEFAULT 'active',created_by_id integer NOT NULL)`);
await pool.query(`CREATE TABLE IF NOT EXISTS project_members(project_id integer NOT NULL,user_id integer NOT NULL,status text NOT NULL DEFAULT 'active')`);
await pool.query(`CREATE TABLE IF NOT EXISTS project_company_binding_versions(project_id integer NOT NULL,company_id integer NOT NULL,version integer NOT NULL)`);
const marker = `catalog-${randomUUID()}`;
const companyA = (await pool.query(`INSERT INTO companies(name) VALUES($1) RETURNING id`, [`${marker}-A`])).rows[0];
const companyB = (await pool.query(`INSERT INTO companies(name) VALUES($1) RETURNING id`, [`${marker}-B`])).rows[0];
async function user(name: string, companyId: number, superAdmin = false) {
  return (await pool.query(`INSERT INTO users(email,full_name,company_id,is_super_admin) VALUES($1,$2,$3,$4) RETURNING id,email,full_name,company_id,is_super_admin`, [`${marker}-${name}@example.test`,name,companyId,superAdmin])).rows[0];
}
const owner = await user("owner",companyA.id,true);
const pmo = await user("pmo",companyA.id);
const ordinary = await user("ordinary",companyA.id);
const outsider = await user("outsider",companyB.id);
await pool.query(`INSERT INTO enterprise_services(id,code,name,created_by_id,updated_by_id) VALUES($1,$2,'BIMLog Shop',$3,$3)`, [randomUUID(),`G_${randomUUID().slice(0,8).toUpperCase()}`,owner.id]);
const projectA = (await pool.query(`INSERT INTO projects(created_by_id) VALUES($1) RETURNING id`, [owner.id])).rows[0];
await pool.query(`INSERT INTO project_members(project_id,user_id,status) VALUES($1,$2,'active'),($1,$3,'active')`, [projectA.id,ordinary.id,outsider.id]);
await pool.query(`INSERT INTO project_company_binding_versions(project_id,company_id,version) VALUES($1,$2,1)`, [projectA.id,companyA.id]);
const token = (row: any) => signToken({ userId: row.id, email: row.email, companyId: row.company_id, fullName: row.full_name, companyName: "test", isSuperAdmin: row.is_super_admin });
const app = express(); app.use(express.json()); app.use("/api/v1",router); app.use("/api/v1",selectorRouter);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(500).json({ code: String(error) }));
const server = app.listen(0,"127.0.0.1");
await new Promise<void>(resolve => server.once("listening",resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}/api/v1`;
async function call(row: any, path: string, body?: unknown, method = body ? "POST" : "GET") {
  const response = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token(row)}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() as any };
}
try {
  assert.equal((await call(ordinary,"/company/master-catalogs/capabilities")).body.canManage,false);
  assert.equal((await call(ordinary,"/company/master-catalogs/service",{code:"SHOP",name:"Shop"})).status,403);
  assert.equal((await call(owner,"/admin/company-master-catalog-grants",{email:pmo.email})).status,201);
  const cap = await call(pmo,"/company/master-catalogs/capabilities");
  assert.equal(cap.body.canManage,true); assert.equal(cap.body.isSuperAdmin,false); assert.equal(cap.body.mode,"defaults_allowed");
  assert.equal((await call(ordinary,"/master-catalogs/services")).body.entries.some((row: any) => row.source === "bimlog"),true);
  assert.equal((await call(owner,"/master-catalogs/services?scope=global")).body.entries.some((row: any) => row.code.startsWith("G_")),true);
  assert.equal((await call(ordinary,"/master-catalogs/services?scope=global")).status,403);
  const created = await call(pmo,"/company/master-catalogs/service",{code:"SHOP",name:"Shop Drawings"});
  assert.equal(created.status,201);
  assert.equal((await call(pmo,"/company/master-catalogs/policy",{mode:"approved_only",expectedVersion:1},"PATCH")).status,200);
  assert.equal((await call(ordinary,"/company/master-catalogs/service")).body.entries.length,1);
  assert.equal((await call(ordinary,"/master-catalogs/services")).body.entries.some((row: any) => row.id === created.body.entry.id),true);
  assert.equal((await call(ordinary,"/master-catalogs/services")).body.entries.some((row: any) => row.source === "bimlog"),false);
  assert.equal((await call(pmo,"/company/master-catalogs/policy",{mode:"defaults_allowed",expectedVersion:2},"PATCH")).status,200);
  assert.equal((await call(ordinary,"/master-catalogs/services")).body.entries.some((row: any) => row.source === "bimlog"),true);
  assert.equal((await call(pmo,"/company/master-catalogs/policy",{mode:"approved_only",expectedVersion:3},"PATCH")).status,200);
  assert.equal((await call(outsider,"/company/master-catalogs/service")).body.entries.length,0);
  assert.equal((await call(outsider,"/master-catalogs/services")).body.entries.some((row: any) => row.id === created.body.entry.id),false);
  assert.equal((await call(ordinary,`/master-catalogs/services?projectId=${projectA.id}`)).status,200);
  assert.equal((await call(outsider,`/master-catalogs/services?projectId=${projectA.id}`)).status,403);
  assert.equal((await call(outsider,`/company/master-catalogs/service/${created.body.entry.id}`,{state:"inactive",expectedVersion:1},"PATCH")).status,403);
  assert.equal((await call(pmo,"/company/master-catalogs/service",{code:"SHOP",name:"Duplicate"})).status,409);
  assert.equal((await call(pmo,`/company/master-catalogs/service/${created.body.entry.id}`,{state:"inactive",expectedVersion:2},"PATCH")).status,409);
  assert.equal((await call(pmo,`/company/master-catalogs/service/${created.body.entry.id}`,{state:"inactive",expectedVersion:1},"PATCH")).status,200);
  assert.equal((await call(ordinary,"/company/master-catalogs/service")).body.entries.length,0);
  assert.equal((await call(pmo,"/company/master-catalogs/service?includeInactive=true")).body.entries.length,1);
  const client = await call(pmo,"/company/master-catalogs/client",{code:"C001",name:`${marker}-client`});
  assert.equal(client.status,201);
  assert.ok(Number(client.body.entry.canonicalCompanyId)>0);
  const approvedClients = await call(ordinary,"/master-catalogs/clients");
  assert.equal(approvedClients.body.governed,true);
  assert.equal(approvedClients.body.entries[0].id,client.body.entry.canonicalCompanyId);
  assert.equal((await call(outsider,"/master-catalogs/clients")).body.entries.length,0);
  assert.equal((await call(owner,"/admin/company-master-catalog-grants/revoke-by-email",{email:pmo.email})).status,200);
  assert.equal((await call(pmo,"/company/master-catalogs/capabilities")).body.canManage,false);
  assert.equal((await call(pmo,"/company/master-catalogs/capabilities")).body.mode,"approved_only");
  assert.equal((await call(ordinary,"/master-catalogs/clients")).body.governed,true);
  assert.equal((await call(ordinary,"/master-catalogs/services")).body.entries.some((row: any) => row.source === "bimlog"),false);
  assert.equal((await call(pmo,"/company/master-catalogs/policy",{mode:"defaults_allowed",expectedVersion:4},"PATCH")).status,403);
  assert.equal((await call(pmo,"/company/master-catalogs/phase",{code:"PRE",name:"Preliminary"})).status,403);
  console.log("Company master catalog local HTTP: persistent policy, approved-only choices, grant/revoke isolation, four-kind API, optimistic version, client identity PASS");
} finally {
  await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
  await pool.end();
}
