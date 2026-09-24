import assert from "node:assert/strict";
import express from "express";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import router from "../routes/workflow-governance-policies";
import { signToken } from "../middlewares/auth";
import { deliveryWorkflowFingerprint, validateDeliveryWorkflowDefinition } from "./delivery-workflow-template-contract";

const target = new URL(process.env.PROD_DATABASE_URL ?? "postgres://invalid/invalid");
if (target.hostname !== "127.0.0.1" || target.port !== "55449" || target.pathname !== "/delivery_template_test")
  throw new Error("Workflow Governance Policy HTTP proof requires the existing disposable localhost test database.");
await pool.query(`CREATE TABLE IF NOT EXISTS projects(id serial PRIMARY KEY,name text NOT NULL)`);
const suffix = randomUUID().slice(0, 8);
const company = (await pool.query(`INSERT INTO companies(name) VALUES($1) RETURNING id`, [`Governance ${suffix}`])).rows[0];
const otherCompany = (await pool.query(`INSERT INTO companies(name) VALUES($1) RETURNING id`, [`Other ${suffix}`])).rows[0];
async function user(role: string, companyId: number, admin = false) {
  return (await pool.query(`INSERT INTO users(email,full_name,company_id,is_super_admin) VALUES($1,$2,$3,$4) RETURNING *`,
    [`${role}-${suffix}@test.invalid`,role,companyId,admin])).rows[0];
}
const owner = await user("owner",company.id,true);
const maker = await user("maker",company.id);
const checker = await user("checker",company.id);
const member = await user("member",company.id);
const outsider = await user("outsider",otherCompany.id,true);
const token = (row: any) => signToken({ userId:row.id,email:row.email,fullName:row.full_name,
  companyId:row.company_id,companyName:"test",isSuperAdmin:row.is_super_admin });
const app = express(); app.use(express.json()); app.use("/api/v1",router);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(500).json({ code:String(error) }));
const server = app.listen(0,"127.0.0.1");
await new Promise<void>(resolve => server.once("listening",resolve));
const address = server.address(); assert.ok(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}/api/v1`;
async function call(row: any, path: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
  const response = await fetch(`${base}${path}`, { method, headers:{ Authorization:`Bearer ${token(row)}`,"Content-Type":"application/json" },
    body:body === undefined ? undefined : JSON.stringify(body) });
  return { status:response.status, body:await response.json() as any };
}
const approvalActions = ["create_work_item","complete_phase","complete_deliverable","economic_change","template_update","activate_version"];
const changeActions = ["edit_phases","edit_tasks_roles","edit_allocation","change_apu","edit_approved_work_item","retire_version"];
const definition = { schemaVersion:1,scope:{ allWorkflows:true,workflowTemplateIds:[] as string[] },
  approvalRules:approvalActions.map(action => ({ action,roles:["PROJECT_MANAGER"],threshold:action === "economic_change" ? { currency:"USD",amountMinor:2500000 } : null })),
  changeRules:changeActions.map(action => ({ action,allowed:true,requiresReapproval:true,requiresNewVersion:action === "edit_phases" || action === "change_apu" })),
  versioning:{ lockActivatedSnapshot:true,structuralChangeCreatesVersion:true,preserveHistory:true },
  permissions:[{ role:"PROJECT_MANAGER",actions:["view","edit_draft","approve","publish","manage"] }],
  validation:{ allocation_total_100:true,task_execute_role:true,phase_review_role:true,final_approval:true,
    required_documents:true,valid_apu:true,unique_phase_codes:true } };
try {
  assert.equal((await call(member,"/company/workflow-governance-policies",{ code:"GOV",name:"Governance",definition })).status,403);
  await pool.query(`INSERT INTO company_master_catalog_administrators(id,company_id,user_id,granted_by_id)
    VALUES($1,$2,$3,$4),($5,$2,$6,$4)`, [randomUUID(),company.id,maker.id,owner.id,randomUUID(),checker.id]);
  const invalidScope = structuredClone(definition); invalidScope.scope = { allWorkflows:false,workflowTemplateIds:[randomUUID()] };
  assert.equal((await call(maker,"/company/workflow-governance-policies",{ code:"BAD",name:"Invalid scope",definition:invalidScope })).status,400);
  const created = await call(maker,"/company/workflow-governance-policies",{ code:"GOV",name:"Governance",definition });
  assert.equal(created.status,201,JSON.stringify(created.body));
  const id = created.body.policyId; const v1 = created.body.versionId;
  assert.equal((await call(member,`/company/workflow-governance-policies/${id}`)).status,404);
  assert.equal((await call(outsider,`/company/workflow-governance-policies/${id}`)).status,404);
  const selfApproval = await call(maker,`/company/workflow-governance-policies/${id}/versions/${v1}/approve`,{ expectedRevision:1 });
  assert.equal(selfApproval.status,403);
  assert.equal(selfApproval.body.code,"WORKFLOW_POLICY_INDEPENDENT_CHECKER_REQUIRED");
  const noFinance = await call(checker,`/company/workflow-governance-policies/${id}/versions/${v1}/approve`,{ expectedRevision:1 });
  assert.equal(noFinance.status,403);
  assert.equal(noFinance.body.code,"WORKFLOW_POLICY_FINANCE_CHECKER_REQUIRED");
  await pool.query(`INSERT INTO financial_authority_grants
    (id,user_id,company_id,project_id,scope_type,authority,version,effective_from,reason,granted_by_id)
    VALUES($1,$2,$3,NULL,'company','cost_approver',1,now()-interval '1 day','Governance QA',$4)`,
    [randomUUID(),checker.id,company.id,owner.id]);
  const approved = await call(checker,`/company/workflow-governance-policies/${id}/versions/${v1}/approve`,{ expectedRevision:1 });
  assert.equal(approved.status,200,JSON.stringify(approved.body));
  assert.equal((await call(maker,`/company/workflow-governance-policies/${id}/versions/${v1}`,{ expectedRevision:2,definition },"PATCH")).status,409);
  assert.equal((await call(maker,`/company/workflow-governance-policies/${id}/versions/${v1}/publish`,{ expectedRevision:1 })).status,409);
  const published = await call(checker,`/company/workflow-governance-policies/${id}/versions/${v1}/publish`,{ expectedRevision:2 });
  assert.equal(published.status,200,JSON.stringify(published.body));
  const overlapping = await call(maker,"/company/workflow-governance-policies",{code:"GOV_OVERLAP",name:"Overlapping policy",definition});
  assert.equal(overlapping.status,201,JSON.stringify(overlapping.body));
  assert.equal((await call(checker,`/company/workflow-governance-policies/${overlapping.body.policyId}/versions/${overlapping.body.versionId}/approve`,{expectedRevision:1})).status,200);
  const overlapPublish = await call(checker,`/company/workflow-governance-policies/${overlapping.body.policyId}/versions/${overlapping.body.versionId}/publish`,{expectedRevision:2});
  assert.equal(overlapPublish.status,409,JSON.stringify(overlapPublish.body));
  assert.equal(overlapPublish.body.code,"WORKFLOW_POLICY_SCOPE_OVERLAP");
  assert.equal((await call(member,`/company/workflow-governance-policies/${id}`)).body.versions[0].fingerprint,published.body.fingerprint);
  const clone = await call(maker,`/company/workflow-governance-policies/${id}/versions`,{});
  assert.equal(clone.status,201,JSON.stringify(clone.body)); const v2 = clone.body.versionId;
  assert.equal((await call(maker,`/company/workflow-governance-policies/${id}/versions`,{})).status,409);
  const changed = structuredClone(definition); changed.approvalRules[3].threshold = { currency:"USD",amountMinor:3000000 };
  assert.equal((await call(maker,`/company/workflow-governance-policies/${id}/versions/${v2}`,{ expectedRevision:1,definition:changed },"PATCH")).status,200);
  assert.equal((await call(maker,`/company/workflow-governance-policies/${id}/versions/${v2}`,{ expectedRevision:1,definition:changed },"PATCH")).status,409);
  assert.equal((await call(checker,`/company/workflow-governance-policies/${id}/versions/${v2}/approve`,{ expectedRevision:2 })).status,200);
  assert.equal((await call(checker,`/company/workflow-governance-policies/${id}/versions/${v2}/publish`,{ expectedRevision:3 })).status,200);
  const legacyWorkflow = validateDeliveryWorkflowDefinition({ schemaVersion:1,deliverableTypes:["SHOP_DRAWING"],
    roles:{execute:"DRAFTER",review:"QC_REVIEWER",approve:"PROJECT_MANAGER"},
    phases:[{id:"only",code:"ONLY",name:"Only",order:1,
      tasks:[{id:"draft",code:"DRAFT",name:"Draft",order:1,requiredDocuments:[]}],
      completionRule:"all_tasks_complete",qcRequired:false,approvalRequired:false}],
    transitions:[],reopen:{role:"approve",reasonRequired:true} });
  const workflowId = randomUUID(), workflowVersionId = randomUUID();
  await pool.query(`INSERT INTO company_delivery_workflow_templates(id,company_id,code,name,created_by_id)
    VALUES($1,$2,'LEGACY','Legacy workflow',$3)`, [workflowId,company.id,owner.id]);
  await pool.query(`INSERT INTO company_delivery_workflow_versions(id,template_id,version,state,definition,fingerprint,
    approved_by_id,approved_at,published_by_id,published_at,created_by_id,updated_by_id)
    VALUES($1,$2,1,'published',$3::jsonb,$4,$5,now(),$5,now(),$5,$5)`,
    [workflowVersionId,workflowId,JSON.stringify(legacyWorkflow),deliveryWorkflowFingerprint(legacyWorkflow),owner.id]);
  const incompatiblePolicy = await call(maker,`/company/workflow-governance-policies/${id}/versions`,{});
  assert.equal(incompatiblePolicy.status,201,JSON.stringify(incompatiblePolicy.body));
  assert.equal((await call(checker,`/company/workflow-governance-policies/${id}/versions/${incompatiblePolicy.body.versionId}/approve`,
    {expectedRevision:1})).status,200);
  const deniedForLegacy = await call(checker,`/company/workflow-governance-policies/${id}/versions/${incompatiblePolicy.body.versionId}/publish`,
    {expectedRevision:2});
  assert.equal(deniedForLegacy.status,409,JSON.stringify(deniedForLegacy.body));
  assert.equal(deniedForLegacy.body.code,"WORKFLOW_POLICY_FINAL_APPROVAL_REQUIRED");
  const history = await call(maker,`/company/workflow-governance-policies/${id}`);
  assert.equal(history.body.versions.find((x: any) => x.versionId === v1).state,"superseded");
  assert.equal(history.body.versions.find((x: any) => x.versionId === v2).state,"published");
  assert.equal(history.body.versions.find((x: any) => x.versionId === incompatiblePolicy.body.versionId).state,"approved");
  assert.ok(history.body.history.some((x: any) => x.action === "superseded"));
  assert.ok(history.body.history.some((x: any) => x.action === "approved" && x.actorId === checker.id && x.actorName === checker.full_name));
  assert.equal(history.body.versions.find((x: any) => x.versionId === v2).approvedById,checker.id);
  await assert.rejects(pool.query(`UPDATE company_workflow_governance_versions SET definition='{}'::jsonb WHERE id=$1`,[v2]));
  await assert.rejects(pool.query(`DELETE FROM company_workflow_governance_events WHERE policy_id=$1`,[id]));
  assert.equal((await call(maker,`/company/workflow-governance-policies/${id}/versions/${v2}/retire`,{ expectedRevision:4,reason:"" })).status,400);
  assert.equal((await call(checker,`/company/workflow-governance-policies/${id}/versions/${v2}/retire`,{ expectedRevision:4,reason:"Retire after QA" })).status,200);
  assert.equal((await call(member,"/company/workflow-governance-policies")).body.versions.filter((x: any) => x.code === "GOV").length,0);
  assert.equal((await call(outsider,"/company/workflow-governance-policies")).body.versions.length,0);
  console.log("Workflow Governance Policy localhost HTTP: company scope, PMO/Finance checker, revision, version, immutable audit, publication and retirement PASS");
} finally {
  await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
  await pool.end();
}
