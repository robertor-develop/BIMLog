import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { pool } from "@workspace/db";
import router from "../routes/delivery-workflow-templates";
import { signToken } from "../middlewares/auth";
import { workflowGovernancePolicyFingerprint } from "./workflow-governance-policy-contract";

const target = new URL(process.env.PROD_DATABASE_URL ?? "postgres://invalid/invalid");
if (target.hostname !== "127.0.0.1" || !((target.port === "55439" && target.pathname === "/delivery_workflow_test") || (target.port === "55449" && target.pathname === "/delivery_template_test"))) {
  throw new Error("Delivery Workflow HTTP proof requires its isolated local PostgreSQL test database.");
}
await pool.query(`CREATE TABLE companies(id serial PRIMARY KEY,name text NOT NULL)`);
await pool.query(`CREATE TABLE users(id serial PRIMARY KEY,email text NOT NULL,full_name text NOT NULL,company_id integer NOT NULL REFERENCES companies(id),is_super_admin boolean NOT NULL DEFAULT false)`);
const a = (await pool.query(`INSERT INTO companies(name) VALUES('A') RETURNING id`)).rows[0];
const b = (await pool.query(`INSERT INTO companies(name) VALUES('B') RETURNING id`)).rows[0];
async function user(email: string, companyId: number, isSuperAdmin = false) {
  return (await pool.query(`INSERT INTO users(email,full_name,company_id,is_super_admin) VALUES($1,$1,$2,$3) RETURNING *`, [email,companyId,isSuperAdmin])).rows[0];
}
const owner = await user("owner@test.invalid",a.id,true);
const pmo = await user("pmo@test.invalid",a.id);
const member = await user("member@test.invalid",a.id);
const outsider = await user("outsider@test.invalid",b.id);
const token = (row: any) => signToken({ userId: row.id, email: row.email, fullName: row.full_name, companyId: row.company_id, companyName: "test", isSuperAdmin: row.is_super_admin });
const app = express(); app.use(express.json()); app.use("/api/v1",router);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(500).json({ code: String(error) }));
const server = app.listen(0,"127.0.0.1");
await new Promise<void>(resolve => server.once("listening",resolve));
const address = server.address(); assert.ok(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}/api/v1`;
async function call(row: any, path: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
  const response = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token(row)}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() as any };
}
const definition = {
  schemaVersion: 1,
  deliverableTypes: ["SHOP_DRAWING"],
  roles: { execute: "DRAFTER", review: "QC_REVIEWER", approve: "PROJECT_MANAGER" },
  phases: [
    { id: "pre", code: "PRE", name: "Preliminary", order: 1, tasks: [{ id: "draw", code: "DRAW", name: "Draw", order: 1, requiredDocuments: ["MODEL"] }], completionRule: "all_tasks_complete", qcRequired: true, approvalRequired: false },
    { id: "record", code: "RECORD", name: "For Record", order: 2, tasks: [{ id: "submit", code: "SUBMIT", name: "Submit", order: 1, requiredDocuments: ["PDF"] }], completionRule: "all_tasks_reviewed", qcRequired: true, approvalRequired: true },
  ],
  transitions: [{ from: "pre", to: "record", gate: "qc_approved", requiredDocuments: ["PDF"] }],
  reopen: { role: "approve", reasonRequired: true },
};
try {
  assert.equal((await call(member,"/company/delivery-workflows",{ code: "SHOP", name: "Shop", definition })).status,403);
  assert.equal((await call(member,"/company/delivery-workflows/preview",{ definition })).status,403);
  assert.equal((await call(owner,"/company/delivery-workflows/preview",{ definition })).status,200);
  assert.equal((await call(owner,"/company/delivery-workflows/preview",{ definition: { schemaVersion: 1 } })).status,400);
  assert.equal((await call(member,"/company/delivery-workflows/options")).body.options.length,3);
  await pool.query(`INSERT INTO company_master_catalog_administrators(id,company_id,user_id,granted_by_id) VALUES('grant-a',$1,$2,$3)`, [a.id,pmo.id,owner.id]);
  const created = await call(pmo,"/company/delivery-workflows",{ code: "SHOP", name: "Shop", definition: { schemaVersion: 1 } });
  assert.equal(created.status,201); const id = created.body.templateId; const v1 = created.body.versionId;
  assert.equal((await call(outsider,`/company/delivery-workflows/${id}`)).status,404);
  assert.equal((await call(outsider,`/company/delivery-workflows/${id}/versions/${v1}/approve`,{ expectedRevision: 1 })).status,403);
  assert.equal((await call(member,`/company/delivery-workflows/${id}`)).status,404); // draft invisible
  assert.equal((await call(pmo,`/company/delivery-workflows/${id}/versions/${v1}/approve`,{ expectedRevision: 1 })).status,400);
  const edited = await call(pmo,`/company/delivery-workflows/${id}/versions/${v1}`,{ expectedRevision: 1, definition },"PATCH");
  assert.equal(edited.status,200); assert.equal(edited.body.version.revision,2);
  assert.equal((await call(pmo,`/company/delivery-workflows/${id}/versions/${v1}`,{ expectedRevision: 1, definition },"PATCH")).status,409);
  const selfApproval = await call(pmo,`/company/delivery-workflows/${id}/versions/${v1}/approve`,{ expectedRevision: 2 });
  assert.equal(selfApproval.status,403); assert.equal(selfApproval.body.code,"DELIVERY_WORKFLOW_INDEPENDENT_CHECKER_REQUIRED");
  const approved = await call(owner,`/company/delivery-workflows/${id}/versions/${v1}/approve`,{ expectedRevision: 2 });
  assert.equal(approved.status,200); assert.equal(approved.body.state,"approved");
  assert.equal((await call(pmo,`/company/delivery-workflows/${id}/versions/${v1}`,{ expectedRevision: 3, definition },"PATCH")).status,409);
  const published = await call(pmo,`/company/delivery-workflows/${id}/versions/${v1}/publish`,{ expectedRevision: 3 });
  assert.equal(published.status,200); assert.equal(published.body.state,"published");
  assert.equal((await call(member,`/company/delivery-workflows/${id}`)).body.versions[0].fingerprint,published.body.fingerprint);
  assert.equal((await call(member,"/company/delivery-workflows/options")).body.options.filter((x: any) => x.source === "company").length,1);
  const second = await call(pmo,`/company/delivery-workflows/${id}/versions`,{});
  assert.equal(second.status,201); assert.equal(second.body.version,2);
  const v2 = second.body.versionId;
  assert.equal((await call(pmo,`/company/delivery-workflows/${id}/versions`,{})).status,409);
  assert.equal((await call(pmo,`/company/delivery-workflows/${id}/versions/${v2}/approve`,{ expectedRevision: 1 })).status,403);
  assert.equal((await call(owner,`/company/delivery-workflows/${id}/versions/${v2}/approve`,{ expectedRevision: 1 })).status,200);
  assert.equal((await call(pmo,`/company/delivery-workflows/${id}/versions/${v2}/publish`,{ expectedRevision: 2 })).status,200);
  const history = await call(pmo,`/company/delivery-workflows/${id}`);
  assert.equal(history.body.versions.find((x: any) => x.versionId === v1).state,"superseded");
  assert.equal(history.body.versions.find((x: any) => x.versionId === v2).state,"published");
  assert.ok(history.body.history.some((x: any) => x.action === "superseded"));
  assert.equal((await call(pmo,`/company/delivery-workflows/${id}/versions/${v1}/retire`,{ expectedRevision: 4 })).status,400);
  assert.equal((await call(pmo,`/company/delivery-workflows/${id}/versions/${v1}/retire`,{ expectedRevision: 4, reason:"Superseded by reviewed version two" })).status,200);
  const retirement = await call(pmo,`/company/delivery-workflows/${id}`);
  assert.ok(retirement.body.history.some((x: any) => x.action === "retired" && x.details?.reason === "Superseded by reviewed version two" && x.actorName));
  const policyDefinition = {
    schemaVersion: 1, scope: { allWorkflows: false, workflowTemplateIds: [id] },
    approvalRules: ["create_work_item", "complete_phase", "complete_deliverable", "economic_change", "template_update", "activate_version"].map(action => ({ action, roles: ["PROJECT_MANAGER"], threshold: null })),
    changeRules: ["edit_phases", "edit_tasks_roles", "edit_allocation", "change_apu", "edit_approved_work_item", "retire_version"].map(action => ({ action, allowed: true, requiresReapproval: true, requiresNewVersion: action === "edit_phases" || action === "change_apu" })),
    versioning: { lockActivatedSnapshot: true, structuralChangeCreatesVersion: true, preserveHistory: true },
    permissions: [{ role: "PROJECT_MANAGER", actions: ["view", "edit_draft", "approve", "publish", "manage"] }],
    validation: { allocation_total_100: true, task_execute_role: true, phase_review_role: true, final_approval: true, required_documents: true, valid_apu: true, unique_phase_codes: true },
  };
  const policyId = randomUUID(), policyVersionId = randomUUID();
  await pool.query(`INSERT INTO company_workflow_governance_policies(id,company_id,code,name,created_by_id)
    VALUES($1,$2,'POLICY-TEST','Policy test',$3)`, [policyId,a.id,owner.id]);
  await pool.query(`INSERT INTO company_workflow_governance_versions(id,policy_id,version,state,definition,fingerprint,
    approved_by_id,approved_at,published_by_id,published_at,created_by_id,updated_by_id)
    VALUES($1,$2,1,'published',$3::jsonb,$4,$5,now(),$5,now(),$5,$5)`, [policyVersionId,policyId,JSON.stringify(policyDefinition),workflowGovernancePolicyFingerprint(policyDefinition),owner.id]);
  const third = await call(pmo,`/company/delivery-workflows/${id}/versions`,{});
  assert.equal(third.status,201);
  assert.equal((await call(owner,`/company/delivery-workflows/${id}/versions/${third.body.versionId}/approve`,{
    expectedRevision: 1 })).status,200);
  const compatiblePublication = await call(pmo,`/company/delivery-workflows/${id}/versions/${third.body.versionId}/publish`,{
    expectedRevision: 2 });
  assert.equal(compatiblePublication.status,200);
  const fourth = await call(pmo,`/company/delivery-workflows/${id}/versions`,{});
  assert.equal(fourth.status,201);
  const invalidUnderPolicy = structuredClone(definition);
  invalidUnderPolicy.phases[1].approvalRequired = false;
  assert.equal((await call(pmo,`/company/delivery-workflows/${id}/versions/${fourth.body.versionId}`,{
    expectedRevision: 1, definition: invalidUnderPolicy },"PATCH")).status,200);
  const deniedApproval = await call(owner,`/company/delivery-workflows/${id}/versions/${fourth.body.versionId}/approve`,{
    expectedRevision: 2 });
  assert.equal(deniedApproval.status,409);
  assert.equal(deniedApproval.body.code,"WORKFLOW_POLICY_FINAL_APPROVAL_REQUIRED");
  const afterDenial = await call(pmo,`/company/delivery-workflows/${id}`);
  assert.equal(afterDenial.body.versions.find((x: any) => x.versionId === third.body.versionId).state,"published");
  assert.equal(afterDenial.body.versions.find((x: any) => x.versionId === fourth.body.versionId).state,"draft");
  await assert.rejects(pool.query(`UPDATE company_delivery_workflow_versions SET definition='{}'::jsonb WHERE id=$1`,[v2]));
  await assert.rejects(pool.query(`DELETE FROM company_delivery_workflow_events WHERE template_id=$1`,[id]));
  assert.equal((await call(member,"/company/delivery-workflows")).body.versions.length,1);
  assert.equal((await call(outsider,"/company/delivery-workflows")).body.versions.length,0);
  console.log("Delivery Workflow isolated HTTP: tenancy, PMO, independent approval, immutable history, compatible governed publish, incompatible governed denial PASS");
} finally {
  await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
  await pool.end();
}
