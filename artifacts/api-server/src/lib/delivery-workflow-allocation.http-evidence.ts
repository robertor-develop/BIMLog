import assert from "node:assert/strict";
import express from "express";
import { pool } from "@workspace/db";
import { signToken } from "../middlewares/auth";
import pricingRouter from "../routes/company-pricing-templates";
import workflowRouter from "../routes/delivery-workflow-templates";

const target = new URL(process.env.PROD_DATABASE_URL ?? "postgres://invalid/invalid");
if (target.hostname !== "127.0.0.1" || target.port !== "55449" || target.pathname !== "/economic_allocation_test")
  throw new Error("Economic allocation HTTP proof requires its dedicated localhost database.");
await pool.query(`CREATE TABLE companies(id serial PRIMARY KEY,name text NOT NULL)`);
await pool.query(`CREATE TABLE users(id serial PRIMARY KEY,email text NOT NULL,full_name text NOT NULL,
  company_id integer NOT NULL REFERENCES companies(id),is_super_admin boolean NOT NULL DEFAULT false)`);
await pool.query(`CREATE TABLE projects(id serial PRIMARY KEY,name text NOT NULL,status text NOT NULL DEFAULT 'active',
  created_by_id integer REFERENCES users(id))`);
const company = (await pool.query(`INSERT INTO companies(name) VALUES('A') RETURNING id`)).rows[0];
const otherCompany = (await pool.query(`INSERT INTO companies(name) VALUES('B') RETURNING id`)).rows[0];
async function user(email: string, companyId: number, admin = false) {
  return (await pool.query(`INSERT INTO users(email,full_name,company_id,is_super_admin)
    VALUES($1,$1,$2,$3) RETURNING *`, [email,companyId,admin])).rows[0];
}
const owner = await user("owner@test.invalid", company.id, true);
const maker = await user("maker@test.invalid", company.id);
const checker = await user("checker@test.invalid", company.id);
const member = await user("member@test.invalid", company.id);
const outsider = await user("outsider@test.invalid", otherCompany.id, true);
const token = (row: any) => signToken({ userId:row.id,email:row.email,fullName:row.full_name,
  companyId:row.company_id,companyName:"test",isSuperAdmin:row.is_super_admin });
const app = express(); app.use(express.json()); app.use("/api/v1",pricingRouter,workflowRouter);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) =>
  res.status(500).json({ code: String(error) }));
const server = app.listen(0,"127.0.0.1");
await new Promise<void>(resolve => server.once("listening",resolve));
const address = server.address(); assert.ok(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}/api/v1`;
async function call(row: any, path: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
  const response = await fetch(`${base}${path}`, { method, headers: {
    Authorization:`Bearer ${token(row)}`, "Content-Type":"application/json",
  }, body:body === undefined ? undefined : JSON.stringify(body) });
  return { status:response.status, body:await response.json() as any };
}
const pricingDefinition = { schemaVersion:1,currency:"USD",industry:"BIM Services",name:"Sleeves",
  nodes:[{ id:"labor",label:"Production labor",method:"fixed_amount",amount:"1000.00" },
    { id:"admin",label:"Administration",method:"fixed_amount",amount:"200.00" }],
  economicAllocation:{ directProductionNodeIds:["labor"], phases:[
    { phaseId:"pre",code:"PRE",name:"Preliminary",percent:"45.00" },
    { phaseId:"record",code:"RECORD",name:"For Record",percent:"55.00" },
  ] } };
const workflowPhases = [
  { id:"pre",code:"PRE",name:"Preliminary",order:1,
    tasks:[{ id:"draft",code:"DRAFT",name:"Prepare",order:1,requiredDocuments:[] }],
    completionRule:"all_tasks_complete",qcRequired:false,approvalRequired:false },
  { id:"record",code:"RECORD",name:"For Record",order:2,
    tasks:[{ id:"release",code:"RELEASE",name:"Release",order:1,requiredDocuments:[] }],
    completionRule:"all_tasks_complete",qcRequired:false,approvalRequired:true },
];
try {
  assert.equal((await call(member,"/company/pricing-templates/preview",{ definition:pricingDefinition })).status,403);
  const pricingPreview = await call(owner,"/company/pricing-templates/preview",{ definition:pricingDefinition });
  assert.equal(pricingPreview.status,200,JSON.stringify(pricingPreview.body));
  assert.equal(pricingPreview.body.total,"1200.00");
  await pool.query(`INSERT INTO company_master_catalog_administrators(id,company_id,user_id,granted_by_id)
    VALUES('maker',$1,$2,$3),('checker',$1,$4,$3)`, [company.id,maker.id,owner.id,checker.id]);
  const createdApu = await call(maker,"/company/pricing-templates",
    { code:"SLEEVES",reason:"Economic QA draft",definition:pricingDefinition });
  assert.equal(createdApu.status,201,JSON.stringify(createdApu.body));
  const apuId = createdApu.body.templateId;
  const deniedFinance = await call(checker,`/company/pricing-templates/${apuId}/publish`,
    { expectedVersion:1,reason:"Check economic defaults" });
  assert.equal(deniedFinance.body.code,"PRICING_TEMPLATE_FINANCE_APPROVER_REQUIRED");
  await pool.query(`INSERT INTO financial_authority_grants
    (id,user_id,company_id,project_id,scope_type,authority,version,effective_from,reason,granted_by_id)
    VALUES('checker-finance',$1,$2,NULL,'company','cost_approver',1,now()-interval '1 day','Economic QA',$3)`,
    [checker.id,company.id,owner.id]);
  const publishedApu = await call(checker,`/company/pricing-templates/${apuId}/publish`,
    { expectedVersion:1,reason:"Checked phase defaults" });
  assert.equal(publishedApu.status,201,JSON.stringify(publishedApu.body));
  const sourceVersionId = publishedApu.body.versionId;
  const options = await call(maker,"/company/pricing-templates/options");
  assert.equal(options.body.options[0].versionId,sourceVersionId);
  assert.deepEqual(options.body.options[0].provenance.definition.economicAllocation,pricingDefinition.economicAllocation);
  const definition = { schemaVersion:1,deliverableTypes:["SLEEVE"],
    roles:{ execute:"PRODUCER",review:"REVIEWER",approve:"APPROVER" },phases:workflowPhases,
    transitions:[{ from:"pre",to:"record",gate:"tasks_complete",requiredDocuments:[] }],
    reopen:{ role:"approve",reasonRequired:true },
    economicAllocation:{ sourceVersionId,proposal:{ method:"apu_default" } } };
  assert.equal((await call(member,"/company/delivery-workflows/preview",{ definition })).status,403);
  const preview = await call(maker,"/company/delivery-workflows/preview",{ definition });
  assert.equal(preview.status,200,JSON.stringify(preview.body));
  assert.equal(preview.body.allocation.directProductionAmount,"1000.00");
  assert.deepEqual(preview.body.allocation.rows.map((row: any) => [row.workflowPercent,row.amount]),
    [["45.00","450.00"],["55.00","550.00"]]);
  assert.equal((await call(outsider,"/company/delivery-workflows/preview",{ definition })).status,404);
  const mismatched = { ...definition, phases:[{ ...workflowPhases[0],id:"different" },workflowPhases[1]],
    transitions:[{ from:"different",to:"record",gate:"tasks_complete",requiredDocuments:[] }] };
  assert.equal((await call(maker,"/company/delivery-workflows/preview",{ definition:mismatched })).body.code,
    "WORKFLOW_ALLOCATION_PHASE_MISMATCH");
  const createdWorkflow = await call(maker,"/company/delivery-workflows",
    { code:"SLEEVE_QA",name:"Sleeve QA",definition });
  assert.equal(createdWorkflow.status,201,JSON.stringify(createdWorkflow.body));
  const workflowId = createdWorkflow.body.templateId, versionId = createdWorkflow.body.versionId;
  const saved = await call(maker,`/company/delivery-workflows/${workflowId}/versions/${versionId}`,
    { expectedRevision:1,definition },"PATCH");
  assert.equal(saved.status,200,JSON.stringify(saved.body));
  assert.equal((await call(checker,`/company/delivery-workflows/${workflowId}/versions/${versionId}/approve`,
    { expectedRevision:1 })).status,409);
  assert.equal((await call(maker,`/company/delivery-workflows/${workflowId}/versions/${versionId}/approve`,
    { expectedRevision:2 })).body.code,"DELIVERY_WORKFLOW_FINANCE_CHECKER_REQUIRED");
  const approved = await call(checker,`/company/delivery-workflows/${workflowId}/versions/${versionId}/approve`,
    { expectedRevision:2 });
  assert.equal(approved.status,200,JSON.stringify(approved.body));
  const published = await call(checker,`/company/delivery-workflows/${workflowId}/versions/${versionId}/publish`,
    { expectedRevision:3 });
  assert.equal(published.status,200,JSON.stringify(published.body));
  const reloaded = await call(maker,`/company/delivery-workflows/${workflowId}`);
  assert.equal(reloaded.body.versions[0].fingerprint,published.body.fingerprint);
  assert.equal(reloaded.body.versions[0].definition.economicAllocation.sourceVersionId,sourceVersionId);
  assert.ok(reloaded.body.history.some((event: any) => event.action === "approved" &&
    event.details.economicAllocationFingerprint === preview.body.allocation.fingerprint));
  assert.equal((await call(outsider,`/company/delivery-workflows/${workflowId}`)).status,404);
  const nextPricing = { ...pricingDefinition, nodes:[
    { ...pricingDefinition.nodes[0],amount:"1100.00" },pricingDefinition.nodes[1],
  ] };
  const nextDraft = await call(maker,`/company/pricing-templates/${apuId}/versions`,
    { expectedVersion:2,reason:"Supersede source in QA",definition:nextPricing });
  assert.equal(nextDraft.status,201,JSON.stringify(nextDraft.body));
  const nextPublished = await call(checker,`/company/pricing-templates/${apuId}/publish`,
    { expectedVersion:3,reason:"Approve new APU source" });
  assert.equal(nextPublished.status,201,JSON.stringify(nextPublished.body));
  const stalePreview = await call(maker,"/company/delivery-workflows/preview",{ definition });
  assert.equal(stalePreview.status,409);
  assert.equal(stalePreview.body.code,"PRICING_TEMPLATE_VERSION_SUPERSEDED");
  assert.equal((await call(member,`/company/delivery-workflows/${workflowId}`)).body.versions[0].fingerprint,
    published.body.fingerprint);
  console.log("Economic allocation HTTP: canonical APU, PMO/tenant, preview amounts, phase identity, maker-checker Finance, stale revision/source, save/reload, immutable publish/audit PASS");
} finally {
  await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
  await pool.end();
}
