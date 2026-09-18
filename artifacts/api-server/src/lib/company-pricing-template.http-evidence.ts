import assert from "node:assert/strict";
import express from "express";
import { pool } from "@workspace/db";
import router from "../routes/company-pricing-templates";
import { signToken } from "../middlewares/auth";
import { resolveCompanyPricingTemplateBinding } from "./company-pricing-template-binding";
import { startFeaturePolicyMigration } from "./feature-policy-migration";

const target = new URL(process.env.PROD_DATABASE_URL ?? "postgres://invalid/invalid");
if (target.hostname !== "127.0.0.1" || target.port !== "55459" || target.pathname !== "/company_pricing_template_test")
  throw new Error("Pricing-template HTTP proof requires its isolated localhost database.");
await pool.query(`CREATE TABLE companies(id serial PRIMARY KEY,name text NOT NULL)`);
await pool.query(`CREATE TABLE users(id serial PRIMARY KEY,email text NOT NULL,full_name text NOT NULL,
  company_id integer NOT NULL REFERENCES companies(id),is_super_admin boolean NOT NULL DEFAULT false)`);
await pool.query(`CREATE TABLE projects(id serial PRIMARY KEY,name text NOT NULL,status text NOT NULL DEFAULT 'active',created_by_id integer REFERENCES users(id))`);
const a = (await pool.query(`INSERT INTO companies(name) VALUES('A') RETURNING id`)).rows[0];
const b = (await pool.query(`INSERT INTO companies(name) VALUES('B') RETURNING id`)).rows[0];
async function user(email: string, companyId: number, isSuperAdmin = false) {
  return (await pool.query(`INSERT INTO users(email,full_name,company_id,is_super_admin)
    VALUES($1,$1,$2,$3) RETURNING *`, [email,companyId,isSuperAdmin])).rows[0];
}
const owner = await user("owner@test.invalid",a.id,true);
const maker = await user("maker@test.invalid",a.id);
const checker = await user("checker@test.invalid",a.id);
const member = await user("member@test.invalid",a.id);
const nonMember = await user("nonmember@test.invalid",a.id);
const outsider = await user("outsider@test.invalid",b.id,true);
const ordinaryOutsider = await user("outsider-member@test.invalid",b.id);
const token = (row: any) => signToken({ userId:row.id,email:row.email,fullName:row.full_name,
  companyId:row.company_id,companyName:"test",isSuperAdmin:row.is_super_admin });
const app = express(); app.use(express.json()); app.use("/api/v1",router);
const server = app.listen(0,"127.0.0.1");
await new Promise<void>(resolve => server.once("listening",resolve));
const address = server.address(); assert.ok(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}/api/v1`;
async function call(row: any, path: string, body?: unknown) {
  const response = await fetch(`${base}${path}`, { method:body === undefined ? "GET" : "POST",
    headers:{ Authorization:`Bearer ${token(row)}`,"Content-Type":"application/json" },
    body:body === undefined ? undefined : JSON.stringify(body) });
  return { status:response.status, body:await response.json() as any };
}
const definition = { schemaVersion:1,currency:"USD",industry:"BIM Services",name:"Shop Drawings",
  nodes:[{ id:"labor",label:"Drawing labor",method:"hours_hourly_rate",hours:"10",hourlyRate:"25" },
    { id:"review",label:"Review",method:"fixed_amount",amount:"50" }] };
try {
  assert.equal((await call(member,"/company/pricing-templates")).status,403);
  assert.equal((await call(member,"/company/pricing-templates/preview",{definition})).status,403);
  assert.equal((await call(member,"/company/pricing-templates/options")).status,403);
  await pool.query(`INSERT INTO company_master_catalog_administrators(id,company_id,user_id,granted_by_id)
    VALUES('maker',$1,$2,$3),('checker',$1,$4,$3)`, [a.id,maker.id,owner.id,checker.id]);
  const preview = await call(maker,"/company/pricing-templates/preview",{definition});
  assert.equal(preview.status,200); assert.equal(preview.body.total,"300.00");
  const created = await call(maker,"/company/pricing-templates",{code:"SHOP",reason:"Initial draft",definition});
  assert.equal(created.status,201); const id = created.body.templateId;
  assert.equal((await call(maker,"/company/pricing-templates/options")).body.options.length,0);
  assert.equal((await call(maker,"/company/pricing-templates",{code:"SHOP",reason:"Duplicate",definition})).status,409);
  assert.equal((await call(outsider,`/company/pricing-templates/${id}`)).status,404);
  assert.equal((await call(maker,`/company/pricing-templates/${id}/publish`,{expectedVersion:1,reason:"Approve"})).status,403);
  assert.equal((await call(checker,`/company/pricing-templates/${id}/publish`,{expectedVersion:1,reason:"Approve"})).body.code,
    "PRICING_TEMPLATE_FINANCE_APPROVER_REQUIRED");
  await pool.query(`INSERT INTO financial_authority_grants
    (id,user_id,company_id,project_id,scope_type,authority,version,effective_from,reason,granted_by_id)
    VALUES('checker-finance',$1,$2,NULL,'company','cost_approver',1,now()-interval '1 day','Test approval grant',$3)`,
    [checker.id,a.id,owner.id]);
  const published = await call(checker,`/company/pricing-templates/${id}/publish`,{expectedVersion:1,reason:"Checked pricing"});
  assert.equal(published.status,201); assert.equal(published.body.version,2); assert.equal(published.body.fingerprint,preview.body.fingerprint);
  assert.equal((await call(maker,"/company/pricing-templates/options")).body.options[0].versionId,published.body.versionId);
  await pool.query(`CREATE TABLE IF NOT EXISTS project_members(id serial PRIMARY KEY,project_id integer NOT NULL REFERENCES projects(id),
    user_id integer NOT NULL REFERENCES users(id),role text NOT NULL,status text NOT NULL DEFAULT 'active')`);
  await pool.query(`CREATE TABLE IF NOT EXISTS config_options(id serial PRIMARY KEY,category text NOT NULL,value text NOT NULL,meta jsonb)`);
  await startFeaturePolicyMigration();
  const project = (await pool.query(`INSERT INTO projects(name,created_by_id) VALUES('Pricing reference QA',$1) RETURNING id`,[owner.id])).rows[0];
  await pool.query(`INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,'admin','active'),($1,$3,'member','active')`,
    [project.id,maker.id,member.id]);
  const projectOptionsPath = `/projects/${project.id}/pricing-template-options?currency=USD`;
  assert.equal((await call(nonMember,projectOptionsPath)).status,403);
  assert.equal((await call(member,projectOptionsPath)).status,200);
  await pool.query(`INSERT INTO financial_authority_grants
    (id,user_id,company_id,project_id,scope_type,authority,version,effective_from,reason,granted_by_id)
    VALUES('maker-pricing-view',$1,$2,$3,'project','financial_viewer',1,now()-interval '1 day','Pricing options QA',$4)`,
    [maker.id,a.id,project.id,owner.id]);
  const projectOptions = await call(maker,projectOptionsPath);
  assert.equal(projectOptions.status,200,JSON.stringify(projectOptions.body));
  assert.deepEqual(projectOptions.body.options.map((option: any) => option.versionId),[published.body.versionId]);
  assert.deepEqual((await call(maker,`/projects/${project.id}/pricing-template-options?currency=EUR`)).body.options,[]);
  assert.equal((await call(ordinaryOutsider,projectOptionsPath)).status,403);
  assert.equal((await call(member,`/company/pricing-templates/${id}`)).status,403);
  const details = await call(checker,`/company/pricing-templates/${id}`);
  assert.equal(details.body.versions.length,2);
  assert.equal(details.body.versions[0].status,"published");
  const revised = { ...definition,nodes:[{ ...definition.nodes[0],hours:"12" },definition.nodes[1]] };
  const draft = await call(maker,`/company/pricing-templates/${id}/versions`,{expectedVersion:2,reason:"New labor plan",definition:revised});
  assert.equal(draft.status,201); assert.equal(draft.body.version,3);
  assert.equal((await call(maker,`/company/pricing-templates/${id}/versions`,{expectedVersion:2,reason:"Stale",definition:revised})).status,409);
  const republished = await call(checker,`/company/pricing-templates/${id}/publish`,{expectedVersion:3,reason:"Checked revision"});
  assert.equal(republished.status,201); assert.equal(republished.body.version,4);
  const binding = await resolveCompanyPricingTemplateBinding({ client:pool,companyId:a.id,currency:"USD",versionId:republished.body.versionId });
  assert.equal(binding?.fingerprint,republished.body.fingerprint);
  assert.equal(binding?.evaluatedTotal,"350.00");
  assert.equal(binding?.status,"reference_only");
  await assert.rejects(resolveCompanyPricingTemplateBinding({ client:pool,companyId:b.id,currency:"USD",versionId:republished.body.versionId }),
    (error: any) => error.code === "PRICING_TEMPLATE_VERSION_NOT_FOUND");
  await assert.rejects(resolveCompanyPricingTemplateBinding({ client:pool,companyId:a.id,currency:"EUR",versionId:republished.body.versionId }),
    (error: any) => error.code === "PRICING_TEMPLATE_CURRENCY_MISMATCH");
  await assert.rejects(resolveCompanyPricingTemplateBinding({ client:pool,companyId:a.id,currency:"USD",versionId:published.body.versionId }),
    (error: any) => error.code === "PRICING_TEMPLATE_VERSION_SUPERSEDED");
  await assert.rejects(resolveCompanyPricingTemplateBinding({ client:pool,companyId:a.id,currency:"USD",versionId:draft.body.versionId }),
    (error: any) => error.code === "PRICING_TEMPLATE_VERSION_NOT_FOUND");
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM generic_apu_template_nodes WHERE template_version_id IN($1,$2)`,
    [published.body.versionId,republished.body.versionId])).rows[0].n,4);
  await assert.rejects(pool.query(`UPDATE generic_apu_template_versions SET name='changed' WHERE id=$1`,[published.body.versionId]));
  assert.equal((await call(member,`/company/pricing-templates/${id}/retire`,{expectedVersion:4,reason:"Retire"})).status,403);
  assert.equal((await call(outsider,`/company/pricing-templates/${id}/retire`,{expectedVersion:4,reason:"Retire"})).status,404);
  assert.equal((await call(maker,`/company/pricing-templates/${id}/retire`,{expectedVersion:4,reason:"Retire"})).body.code,"PRICING_TEMPLATE_MAKER_CHECKER_REQUIRED");
  assert.equal((await call(owner,`/company/pricing-templates/${id}/retire`,{expectedVersion:4,reason:"Retire"})).body.code,"PRICING_TEMPLATE_FINANCE_APPROVER_REQUIRED");
  const retired = await call(checker,`/company/pricing-templates/${id}/retire`,{expectedVersion:4,reason:"Method no longer approved"});
  assert.equal(retired.status,201); assert.equal(retired.body.version,5);
  assert.equal((await call(checker,`/company/pricing-templates/${id}/retire`,{expectedVersion:4,reason:"Stale"})).status,409);
  assert.equal((await call(maker,"/company/pricing-templates/options")).body.options.length,0);
  assert.deepEqual((await call(maker,projectOptionsPath)).body.options,[]);
  await assert.rejects(resolveCompanyPricingTemplateBinding({ client:pool,companyId:a.id,currency:"USD",versionId:republished.body.versionId }),
    (error: any) => error.code === "PRICING_TEMPLATE_RETIRED");
  assert.equal(binding?.fingerprint,republished.body.fingerprint);
  assert.equal((await pool.query(`SELECT status FROM generic_apu_template_versions WHERE id=$1`,[republished.body.versionId])).rows[0].status,"published");
  const nextDefinition = { ...revised,nodes:[{ ...revised.nodes[0],hours:"14" },revised.nodes[1]] };
  const nextDraft = await call(maker,`/company/pricing-templates/${id}/versions`,{expectedVersion:5,reason:"Replacement pricing",definition:nextDefinition});
  assert.equal(nextDraft.status,201); assert.equal(nextDraft.body.version,6);
  assert.equal((await call(maker,"/company/pricing-templates/options")).body.options.length,0);
  const nextPublished = await call(checker,`/company/pricing-templates/${id}/publish`,{expectedVersion:6,reason:"Approved replacement"});
  assert.equal(nextPublished.status,201); assert.equal(nextPublished.body.version,7);
  assert.equal((await call(maker,"/company/pricing-templates/options")).body.options[0].versionId,nextPublished.body.versionId);
  assert.deepEqual((await call(maker,projectOptionsPath)).body.options.map((option: any) => option.versionId),[nextPublished.body.versionId]);
  console.log("company pricing-template HTTP: PMO, tenant, Finance approver, project options/permissions/currency, maker-checker, retirement, history, republish, stale, immutable PASS");
} finally {
  await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
  await pool.end();
}
