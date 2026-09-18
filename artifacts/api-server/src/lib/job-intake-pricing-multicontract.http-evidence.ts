import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { pool } from "@workspace/db";
import intakeRouter from "../routes/job-intake";
import contractsRouter from "../routes/financial-contracts";
import { signToken } from "../middlewares/auth";
import { startFeaturePolicyMigration } from "./feature-policy-migration";
import { startCommercialEntitlementMigration } from "./commercial-entitlement";
import { startFinancialControlMigration } from "./financial-control-migration";
import { startFinancialBudgetMigration } from "./financial-budget-migration";
import { startFinancialContractMigration } from "./financial-contract-migration";
import { startContractItemWorkflowMigration } from "./contract-item-workflow-migration";
import { startGenericApuPersistenceMigration } from "./generic-apu-persistence-migration";
import { startJobIntakeMigration } from "./job-intake-migration";
import { ensureCompanyMasterCatalogSchema } from "./company-master-catalog-migration";
import { ensureDeliveryWorkflowRuntimeSchema } from "./delivery-workflow-template-migration";
import { validatePricingTemplate } from "./company-pricing-template-contract";

// Run only against an empty, disposable database on the exact localhost target
// below. Provision its base schema with the local Drizzle CLI first; this proof
// then applies the additive runtime migrations and creates only synthetic rows.
const target = new URL(process.env.PROD_DATABASE_URL ?? "postgres://invalid/invalid");
if (target.hostname !== "127.0.0.1" || target.port !== "55460" || target.pathname !== "/bimlog_intake_integration_test")
  throw new Error("Refusing to use any database except the exact isolated Intake integration fixture.");

const companyId = Number((await pool.query(`INSERT INTO companies(name) VALUES('Intake integration company') RETURNING id`)).rows[0].id);
const actor = (await pool.query(`INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin)
  VALUES('intake-owner@test.invalid','unused','Intake Owner',$1,true) RETURNING *`,[companyId])).rows[0];
const checker = (await pool.query(`INSERT INTO users(email,password_hash,full_name,company_id)
  VALUES('intake-checker@test.invalid','unused','Intake Checker',$1) RETURNING *`,[companyId])).rows[0];
const projectId = Number((await pool.query(`INSERT INTO projects(name,code,status,created_by_id)
  VALUES('Two-contract integration sample','INT-2','active',$1) RETURNING id`,[actor.id])).rows[0].id);
await pool.query(`INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,'admin','active'),($1,$3,'member','active')`,[projectId,actor.id,checker.id]);

await startFeaturePolicyMigration();
await startCommercialEntitlementMigration();
await startFinancialControlMigration();
await startFinancialBudgetMigration();
await startFinancialContractMigration();
await startContractItemWorkflowMigration();
await startGenericApuPersistenceMigration();
await startJobIntakeMigration();
await ensureCompanyMasterCatalogSchema();
await ensureDeliveryWorkflowRuntimeSchema();

await pool.query(`INSERT INTO company_cost_library_versions
  (id,library_id,company_id,version,effective_date,status,reason,content_fingerprint,created_by_id)
  VALUES('intake-lv','intake-lib',$1,1,current_date,'approved','Isolated library','intake-lib-fp',$2)`,[companyId,actor.id]);
await pool.query(`INSERT INTO company_cost_nodes
  (id,library_version_id,stable_node_id,hierarchical_path,company_code,name,sort_order,effective_from)
  VALUES('intake-cn1','intake-lv','intake-stable-1','01','01','Drawing',0,current_date),
        ('intake-cn2','intake-lv','intake-stable-2','02','02','Review',1,current_date)`);
await pool.query(`INSERT INTO project_cost_structure_versions
  (id,structure_id,project_id,company_id,library_version_id,version,status,reason,validation_fingerprint,content_fingerprint,created_by_id)
  VALUES('intake-sv','intake-structure',$1,$2,'intake-lv',1,'approved','Isolated structure','intake-validation','intake-structure-fp',$3)`,[projectId,companyId,actor.id]);
await pool.query(`INSERT INTO project_cost_nodes
  (id,structure_version_id,stable_project_node_id,company_stable_node_id,company_library_version_id,
   project_code,project_name,active,sort_order,effective_from,mapping_provenance)
  VALUES('intake-pn1','intake-sv','intake-project-1','intake-stable-1','intake-lv','01','Drawing',true,0,current_date,'isolated'),
        ('intake-pn2','intake-sv','intake-project-2','intake-stable-2','intake-lv','02','Review',true,1,current_date,'isolated')`);
await pool.query(`INSERT INTO project_budget_versions
  (id,budget_id,project_id,company_id,structure_version_id,version,currency,status,purpose,prepared_by_id,content_fingerprint,calculated_total)
  VALUES('intake-bv','intake-budget',$1,$2,'intake-sv',1,'USD','approved','Isolated two-contract budget',$3,'intake-budget-fp',420)`,[projectId,companyId,actor.id]);
await pool.query(`INSERT INTO approved_budget_snapshots
  (id,budget_version_id,budget_id,budget_version,project_id,company_id,structure_version_id,currency,total,
   original_total,current_total,difference_from_original,approved_by_id,approved_at,approval_policy_id,
   approval_limit,content_fingerprint,snapshot_fingerprint)
  VALUES('intake-snap','intake-bv','intake-budget',1,$1,$2,'intake-sv','USD',420,420,420,0,$3,now(),
   'intake-policy',1000,'intake-budget-fp','intake-snapshot-fp')`,[projectId,companyId,actor.id]);
await pool.query(`INSERT INTO approved_budget_snapshot_lines
  (id,snapshot_id,stable_line_id,project_cost_node_id,project_code,project_name,hierarchical_path,description,amount,sort_order)
  VALUES('intake-sl1','intake-snap','drawing','intake-pn1','01','Drawing','01','Drawing labor',250,0),
        ('intake-sl2','intake-snap','review','intake-pn2','02','Review','02','Review labor',170,1)`);

for (const [version,price] of [[1,"25"],[2,"42.5"]] as const)
  await pool.query(`INSERT INTO generic_cost_value_plan_versions
    (id,project_id,version,content,evaluation,content_fingerprint,created_by_id)
    VALUES($1,$2,$3,$4::jsonb,'{}'::jsonb,$5,$6)`,
    [`intake-apu-${version}`,projectId,version,JSON.stringify({ currency:"USD",sellingPrice:price }),`intake-apu-fp-${version}`,actor.id]);

async function publishedTemplate(name: string,price: string) {
  const templateId = randomUUID(), versionId = randomUUID();
  const definition = { schemaVersion:1,currency:"USD",industry:"BIM Services",name,
    nodes:[{ id:"labor",label:"Labor",method:"fixed_amount",amount:price }] };
  const validated = validatePricingTemplate(definition);
  await pool.query(`INSERT INTO generic_apu_template_versions
    (id,template_id,company_id,project_id,version,name,industry,status,currency,reason,content_fingerprint,
     provenance,created_by_id,published_by_id,published_at)
    VALUES($1,$2,$3,NULL,1,$4,$5,'published','USD','Isolated approved reference',$6,$7::jsonb,$8,$9,now())`,
    [versionId,templateId,companyId,name,definition.industry,validated.fingerprint,
     JSON.stringify({ definition,definitionFingerprint:validated.fingerprint,code:name.toUpperCase().replaceAll(" ","-") }),actor.id,checker.id]);
  return { templateId,versionId,fingerprint:validated.fingerprint };
}
const drawingTemplate = await publishedTemplate("Drawing Reference","300");
const reviewTemplate = await publishedTemplate("Review Reference","200");

const app = express(); app.use(express.json()); app.use("/api/v1",intakeRouter,contractsRouter);
const server = app.listen(0,"127.0.0.1");
await new Promise<void>(resolve => server.once("listening",resolve));
const address = server.address(); assert.ok(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}/api/v1`;
const token = signToken({ userId:actor.id,email:actor.email,fullName:actor.full_name,companyId,
  companyName:"Intake integration company",isSuperAdmin:true });
async function request(method:string,path:string,body?:unknown) {
  const response = await fetch(`${base}${path}`,{ method,headers:{ Authorization:`Bearer ${token}`,
    "Content-Type":"application/json" },body:body == null ? undefined : JSON.stringify(body) });
  return { status:response.status,body:await response.json() as any };
}
const intakePath = `/projects/${projectId}/intake`;
try {
  const initialized = await request("POST",intakePath);
  assert.equal(initialized.status,201,JSON.stringify(initialized.body));
  const data = {
    identity:{ jobName:"Two-contract integration sample",jobCode:"INT-2",clientName:"Sample Owner",currency:"USD" },
    commercial:{ budgetSnapshotId:"intake-snap",contracts:[
      { id:"BASE",title:"Drawing contract",contractNumber:"INT-BASE-001",counterpartyName:"Sample Owner",
        perspective:"upstream",contractType:"owner_prime",pricingTemplateVersionId:drawingTemplate.versionId },
      { id:"ADD",title:"Review contract",contractNumber:"INT-ADD-001",counterpartyName:"Sample Owner",
        perspective:"upstream",contractType:"owner_prime",pricingTemplateVersionId:reviewTemplate.versionId },
    ] },
    scopeItems:[
      { id:"CI-DRAW",name:"Drawing",contractId:"BASE",plannedHours:"10",billingHourlyRate:"25",
        apuPlanVersion:1,budgetSnapshotLineId:"intake-sl1",projectCostNodeId:"intake-pn1" },
      { id:"CI-REVIEW",name:"Review",contractId:"ADD",plannedHours:"4",billingHourlyRate:"42.5",
        apuPlanVersion:2,budgetSnapshotLineId:"intake-sl2",projectCostNodeId:"intake-pn2" },
    ],
    delivery:{ workflowTemplate:"generic",submittalStrategy:"Controlled review and delivery" },
    team:{ projectLeaderUserId:actor.id,assignments:[
      { id:"AS-DRAW",userId:actor.id,personName:"Intake Owner",role:"Coordinator",scopeItemId:"CI-DRAW",
        plannedHours:"10",internalHourlyRate:"15" },
      { id:"AS-REVIEW",userId:checker.id,personName:"Intake Checker",role:"Reviewer",scopeItemId:"CI-REVIEW",
        plannedHours:"4",internalHourlyRate:"20" },
    ] },
    review:{ scopeConfirmed:true,pricingConfirmed:true,contractConfirmed:true,deliveryConfirmed:true,teamConfirmed:true },
  };
  const invalid = await request("PUT",intakePath,{ expectedRevision:initialized.body.revision,
    data:{ ...data,commercial:{ ...data.commercial,contracts:[{ ...data.commercial.contracts[0],pricingTemplateVersionId:randomUUID() },data.commercial.contracts[1]] } } });
  assert.equal(invalid.status,404,JSON.stringify(invalid.body));
  const saved = await request("PUT",intakePath,{ expectedRevision:initialized.body.revision,data });
  assert.equal(saved.status,200,JSON.stringify(saved.body));
  assert.equal(saved.body.completion.ready,true,JSON.stringify(saved.body.completion.missingItems));
  const reopened = await request("GET",intakePath);
  assert.equal(reopened.status,200,JSON.stringify(reopened.body));
  assert.deepEqual(reopened.body.data.commercial.contracts.map((contract:any) => contract.pricingTemplateVersionId),
    [drawingTemplate.versionId,reviewTemplate.versionId]);
  assert.equal(reopened.body.revision,saved.body.revision);
  const stale = await request("PUT",intakePath,{ expectedRevision:initialized.body.revision,data });
  assert.equal(stale.status,409);
  await pool.query(`INSERT INTO generic_apu_template_versions
    (id,template_id,company_id,project_id,version,name,industry,status,currency,reason,content_fingerprint,
     supersedes_id,provenance,created_by_id,published_by_id,published_at)
    VALUES($1,$2,$3,NULL,2,'Review Reference','BIM Services','retired','USD','Isolated retirement',
     $4,$5,'{}'::jsonb,$6,$7,now())`,
    [randomUUID(),reviewTemplate.templateId,companyId,`retired-${randomUUID()}`,reviewTemplate.versionId,actor.id,checker.id]);
  const retiredAttempt = await request("POST",`${intakePath}/activate`,{
    expectedRevision:reopened.body.revision,confirmationFingerprint:reopened.body.completion.fingerprint });
  assert.equal(retiredAttempt.status,409,JSON.stringify(retiredAttempt.body));
  assert.equal(retiredAttempt.body.code,"PRICING_TEMPLATE_RETIRED");
  assert.equal(Number((await pool.query(`SELECT count(*)::int n FROM financial_contracts WHERE project_id=$1`,[projectId])).rows[0].n),0);
  assert.equal(Number((await pool.query(`SELECT count(*)::int n FROM job_activation_work_items WHERE project_id=$1`,[projectId])).rows[0].n),0);
  const replacement = await publishedTemplate("Replacement Review Reference","240");
  const correctedData = { ...data,commercial:{ ...data.commercial,contracts:[data.commercial.contracts[0],
    { ...data.commercial.contracts[1],pricingTemplateVersionId:replacement.versionId }] } };
  const recovered = await request("PUT",intakePath,{ expectedRevision:reopened.body.revision,data:correctedData });
  assert.equal(recovered.status,200,JSON.stringify(recovered.body));
  const ready = await request("GET",intakePath);
  assert.equal(ready.body.data.commercial.contracts[1].pricingTemplateVersionId,replacement.versionId);
  const activated = await request("POST",`${intakePath}/activate`,{
    expectedRevision:ready.body.revision,confirmationFingerprint:ready.body.completion.fingerprint });
  assert.equal(activated.status,200,JSON.stringify(activated.body));
  assert.equal(activated.body.contractIds.length,2);
  const replay = await request("POST",`${intakePath}/activate`,{
    expectedRevision:ready.body.revision,confirmationFingerprint:ready.body.completion.fingerprint });
  assert.equal(replay.status,200,JSON.stringify(replay.body)); assert.equal(replay.body.idempotent,true);
  const contracts = await request("GET",`/projects/${projectId}/financial/contracts`);
  assert.equal(contracts.status,200,JSON.stringify(contracts.body));
  assert.equal(contracts.body.contracts.length,2);
  const byNumber = new Map(contracts.body.contracts.map((contract:any) => [contract.legalNumber,contract]));
  assert.equal((byNumber.get("INT-BASE-001") as any)?.pricingTemplateBinding.versionId,drawingTemplate.versionId);
  assert.equal((byNumber.get("INT-ADD-001") as any)?.pricingTemplateBinding.versionId,replacement.versionId);
  const snapshots = (await pool.query(`SELECT v.commercial_metadata,l.stable_line_id,l.contract_item_snapshot
    FROM financial_contract_versions v JOIN financial_contract_sov_lines l ON l.contract_version_id=v.id
    JOIN financial_contracts c ON c.id=v.contract_id WHERE c.project_id=$1 ORDER BY l.stable_line_id`,[projectId])).rows;
  assert.deepEqual(snapshots.map((row:any) => row.contract_item_snapshot.unitRate),["25","42.5"]);
  assert.deepEqual(snapshots.map((row:any) => row.contract_item_snapshot.apuPlanVersion),[1,2]);
  assert.deepEqual(snapshots.map((row:any) => row.commercial_metadata.pricingTemplateBinding.versionId).sort(),
    [drawingTemplate.versionId,replacement.versionId].sort());
  const budget = (await pool.query(`SELECT content->'projectBudget'->>'total' total FROM job_activation_execution_baselines
    WHERE project_id=$1`,[projectId])).rows[0];
  assert.equal(budget.total,"420");
  await pool.query(`INSERT INTO generic_apu_template_versions
    (id,template_id,company_id,project_id,version,name,industry,status,currency,reason,content_fingerprint,
     supersedes_id,provenance,created_by_id,published_by_id,published_at)
    VALUES($1,$2,$3,NULL,2,'Replacement Review Reference','BIM Services','retired','USD',
     'Retired after accepted contract',$4,$5,'{}'::jsonb,$6,$7,now())`,
    [randomUUID(),replacement.templateId,companyId,`retired-${randomUUID()}`,replacement.versionId,actor.id,checker.id]);
  const historical = await request("GET",`/projects/${projectId}/financial/contracts`);
  assert.equal(historical.status,200);
  assert.equal(historical.body.contracts.find((contract:any) => contract.legalNumber === "INT-ADD-001")
    ?.pricingTemplateBinding.versionId,replacement.versionId);
  const after = await request("GET",intakePath);
  assert.equal(after.body.status,"activated");
  const immutable = await request("PUT",intakePath,{ expectedRevision:after.body.revision,data:correctedData });
  assert.equal(immutable.status,409); assert.equal(immutable.body.code,"JOB_INTAKE_ACTIVATED");
  console.log("multi-contract Intake HTTP: invalid save rollback, save/reopen, stale revision, retirement blocks activation without residue, replacement save/reopen, two contract activation, APU/rate preservation, baseline, idempotent retry, historical binding after retirement, immutable accepted Intake PASS");
} finally {
  await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
  await pool.end();
}
