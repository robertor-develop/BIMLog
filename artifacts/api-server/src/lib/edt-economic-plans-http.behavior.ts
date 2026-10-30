import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import express from "express";
import { pool } from "@workspace/db";
import intakeRouter from "../routes/job-intake";
import contractsRouter from "../routes/financial-contracts";
import contractItemWorkflowsRouter from "../routes/contract-item-workflows";
import edtRouter from "../routes/edt-engine";
import reportsRouter from "../routes/reports";
import financialApuRouter from "../routes/financial-apu";
import projectDirectoryRouter from "../routes/project_directory";
import { ensureEdtEngineSchema, EDT_ENGINE_ECONOMIC_SQL } from "./edt-engine-migration";
import { getTeamPerformance } from "./team-performance-service";
import { approvedLaborEvidenceSql, buildApprovedLaborEvidence, type ApprovedLaborSource } from "./approved-labor-evidence";
import { saveCostValuePerformance, getCostValuePerformance, exportCostValuePerformanceCsv } from "./cost-value-performance-service";
import { saveCostValueForecast, getCostValueForecast, exportCostValueForecastCsv } from "./cost-value-forecast-service";
import { createWorkItemEconomicPlan } from "./edt-engine-economic-service";
import { edtFingerprint } from "./edt-engine-transaction";
import { proposeManualBonus, decideManualBonus } from "./cost-value-bonus-service";
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
import { deliveryWorkflowFingerprint, validateDeliveryWorkflowDefinition } from "./delivery-workflow-template-contract";
import {loadApprovedContractEconomicSource} from "./approved-contract-economic-source";
import {freezeApprovedContractPools} from "./contract-economic-pool-service";
import {withEdtTransaction} from "./edt-engine-transaction";
import {approvedItemPhaseAllocation} from "./approved-work-item-economic-plan";
import {scaledSignedDecimal} from "./financial-budget-contract";
import {getFinancialBudgetWorkspace} from "./financial-budget-service";

// Run only against an empty, disposable database on the exact localhost target
// below. Provision its base schema with the local Drizzle CLI first; this proof
// then applies the additive runtime migrations and creates only synthetic rows.
const target = new URL(process.env.PROD_DATABASE_URL ?? "postgres://invalid/invalid");
if (target.hostname !== "127.0.0.1" || target.port !== "55439" || !["/bimlog_p150_fixture_01","/bimlog_p150_fixture_02"].includes(target.pathname))
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
await ensureEdtEngineSchema();
await pool.query(`INSERT INTO company_master_catalog_entries(id,company_id,kind,code,name,created_by_id,updated_by_id)
  VALUES('intake-discipline',$1,'discipline','MECH','Test Mechanical',$2,$2)`,[companyId,actor.id]);
const workPackage = (id:string) => ({id,packageCode:id,title:"Test Level 1",dimensionType:"floor",dimensionValue:"L1",packageType:"deliverable",
  classification:{disciplineId:"intake-discipline",disciplineCode:"MECH",disciplineName:"Test Mechanical"}});

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

async function publishedTemplate(name: string,price: string,classified = false,
  phases=[{phaseId:"production",code:"PROD",name:"Production",percent:"100"}]) {
  const templateId = randomUUID(), versionId = randomUUID();
  const definition = { schemaVersion:1,currency:"USD",industry:"BIM Services",name,
    nodes:[{ id:"labor",label:"Labor",method:"fixed_amount",amount:price },...(classified?[{id:"reserve",label:"TEST explicit reserve",method:"fixed_amount",amount:"30"}]:[])],
    ...(classified ? {economicAllocation:{directProductionNodeIds:["labor"],phases},
      economicPools:{fixedCompanyCost:[],directProduction:["labor"],projectAdministration:[],incentiveReserve:["reserve"],projectEarnings:[]}} : {}) };
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

const app = express(); app.use(express.json()); app.use("/api/v1",intakeRouter,contractsRouter,contractItemWorkflowsRouter,edtRouter,reportsRouter,financialApuRouter,projectDirectoryRouter);
const server = app.listen(0,"127.0.0.1");
await new Promise<void>(resolve => server.once("listening",resolve));
const address = server.address(); assert.ok(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}/api/v1`;
const token = signToken({ userId:actor.id,email:actor.email,fullName:actor.full_name,companyId,
  companyName:"Intake integration company",isSuperAdmin:true });
async function request(method:string,path:string,body?:unknown,authorization=token) {
  const response = await fetch(`${base}${path}`,{ method,headers:{ Authorization:`Bearer ${authorization}`,
    "Content-Type":"application/json" },body:body == null ? undefined : JSON.stringify(body) });
  return { status:response.status,body:await response.json() as any };
}
const intakePath = `/projects/${projectId}/intake`;
try {
  // Reproduce a newly configured project: originators exist without contractor accounts.
  const choicesProject = Number((await pool.query(`INSERT INTO projects(name,code,status,created_by_id) VALUES('Synthetic company choices','CHOICES','active',$1) RETURNING id`, [actor.id])).rows[0].id);
  await pool.query(`INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,'member','active')`, [choicesProject, checker.id]);
  const conventionId = Number((await pool.query(`INSERT INTO naming_conventions(project_id,separator,company_code) VALUES($1,'-','STALE') RETURNING id`, [choicesProject])).rows[0].id);
  await pool.query(`INSERT INTO naming_fields(convention_id,label,field_order,allowed_values) VALUES($1,'Originator',1,$2::json)`, [conventionId, JSON.stringify(['BIM','DDS','WP','RL','MEGA'])]);
  const memberToken = signToken({ userId:checker.id,email:checker.email,fullName:checker.full_name,companyId,companyName:'Synthetic',isSuperAdmin:false });
  const counts = async () => (await pool.query(`SELECT (SELECT count(*) FROM companies)::int AS companies,(SELECT count(*) FROM project_members)::int AS members,(SELECT count(*) FROM project_directory)::int AS directory`)).rows[0];
  const beforeChoices = await counts();
  const options = await request('GET', `/projects/${choicesProject}/company-options`, undefined, memberToken);
  assert.equal(options.status, 200);
  for (const code of ['BIM','DDS','WP','RL','MEGA']) assert.ok(options.body.companies.includes(code));
  assert.ok(!options.body.companies.includes('STALE'));
  assert.deepEqual(await counts(), beforeChoices, 'Reading choices creates no company, membership or directory row');
  const privateProject = Number((await pool.query(`INSERT INTO projects(name,code,status,created_by_id) VALUES('Synthetic private choices','PRIVATE-CHOICES','active',$1) RETURNING id`, [actor.id])).rows[0].id);
  const deniedChoices = await request('GET', `/projects/${privateProject}/company-options`, undefined, memberToken);
  assert.ok([403,404].includes(deniedChoices.status));
  assert.equal((await fetch(`${base}/projects/${choicesProject}/company-options`)).status, 401);
  console.log('Project company choices HTTP/database PASS: saved Originator dictionary, no contractor accounts, stale scalar excluded, member access, anonymous/nonmember denial, zero read-side mutations');
  // Exercise the production renderer, not a substitute report generator.
  const pdfOutput = process.env.BIMLOG_FINANCIAL_PDF_PROOF_OUTPUT;
  if (pdfOutput) {
    assert.ok(path.resolve(pdfOutput).replaceAll("\\", "/").startsWith("F:/BIMLog/TestProof/"), "PDF evidence must remain in the F-rooted test directory");
    await mkdir(pdfOutput, { recursive: true });
  }
  for (const lang of ["en", "es"]) {
    const authority = lang === "es" ? "Solo escenario; no son ganancias ni pagos aprobados" : "Scenario only; not approved earnings or payment";
    const response = await fetch(`${base}/projects/${projectId}/reports/current-view/pdf`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ surface: "cost-value-planner", lang, columns: lang === "es" ? ["Sección", "Campo", "Valor"] : ["Section", "Field", "Value"],
        context: ["SYNTHETIC renderer regression, not live acceptance"], rows: [
          ["Forecast", "Authority", authority], ["Forecast", "Source currency / plan / performance version", "USD / 3 / 1"],
          ["Performance", "Approved labor cost / hours", "139.000000 USD / 3.000000"],
        ] }),
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /application\/pdf/);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (pdfOutput) await writeFile(path.join(pdfOutput, `financial-${lang}.pdf`), bytes);
    const parser = new PDFParse({ data: bytes });
    try {
      const extracted = (await parser.getText()).text.replace(/\s+/g, " ");
      assert.ok(extracted.includes(authority), `Financial ${lang} PDF must preserve the complete authority disclaimer`);
      assert.ok(extracted.includes("139.000000 USD / 3.000000"));
      assert.ok(extracted.includes("USD / 3 / 1"));
      assert.ok(extracted.includes(lang === "es" ? "Reportes y PDF" : "Reports & PDFs"));
      assert.ok(extracted.includes(lang === "es" ? "Página 1 de 1" : "Page 1 of 1"));
      assert.ok(extracted.includes(lang === "es" ? "Documento SHA-256:" : "Document SHA-256:"));
      if (lang === "es") assert.doesNotMatch(extracted, /Reports & PDFs|Page 1 of|Document SHA-256/);
    } finally { await parser.destroy(); }
  }
  for (const rowCount of [0, 250]) {
    const response = await fetch(`${base}/projects/${projectId}/reports/current-view/pdf`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ surface: "team-performance", lang: "es", columns: ["Usuario", "Registradas", "Pendientes", "Aprobadas", "Comprometidas", "Rechazadas"],
        context: ["SYNTHETIC 250-row boundary / empty-state renderer regression"],
        rows: Array.from({ length: rowCount }, (_, index) => [`TEST-${String(index + 1).padStart(3, "0")}`, "3.00", "1.00", "2.00", "1.00", "0.00"]),
      }),
    });
    assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (pdfOutput) await writeFile(path.join(pdfOutput, `team-${rowCount}.pdf`), bytes);
    const parser = new PDFParse({ data: bytes });
    try {
      const text = (await parser.getText()).text;
      assert.ok(text.includes("Página 1 de"));
      assert.ok(text.includes("Documento SHA-256:"));
      assert.doesNotMatch(text, /Reports & PDFs|Page \d+ of|Document SHA-256/);
      if (!rowCount) assert.ok(text.includes("No hay resultados en la vista actual."));
      for (let index = 1; index <= rowCount; index++) {
        const marker = `TEST-${String(index).padStart(3, "0")}`;
        assert.equal(text.split(marker).length - 1, 1, `Export must preserve ${marker} exactly once`);
      }
    } finally { await parser.destroy(); }
  }
  console.log("C019 production PDF renderer: bilingual financial authority/provenance, empty state and all 250 rows PASS (synthetic local, not live acceptance)");
  for (const lang of ["en","es"]) {
    const oversized=await request("POST",`/projects/${projectId}/reports/current-view/pdf`,{
      surface:"cost-value-planner",lang,columns:["TEST"],rows:Array.from({length:251},()=>["TEST"]),context:[]
    });
    assert.equal(oversized.status,400);
    assert.equal(oversized.body.code,"CURRENT_VIEW_ROW_LIMIT");
    assert.match(oversized.body.error,/250/);
  }
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
        apuPlanVersion:1,budgetSnapshotLineId:"intake-sl1",projectCostNodeId:"intake-pn1",deliverableType:"SHOP_DRAWING",workPackages:[workPackage("WP-DRAW")] },
      { id:"CI-REVIEW",name:"Review",contractId:"ADD",plannedHours:"4",billingHourlyRate:"42.5",
        apuPlanVersion:2,budgetSnapshotLineId:"intake-sl2",projectCostNodeId:"intake-pn2",deliverableType:"SHOP_DRAWING",workPackages:[workPackage("WP-REVIEW")] },
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
  const corePhases=[
    {phaseId:"pre",code:"PRE",name:"TEST Preparation",percent:"25"},
    {phaseId:"coo",code:"COO",name:"TEST Coordination",percent:"25"},
    {phaseId:"for",code:"FOR",name:"TEST Formal review",percent:"25"},
    {phaseId:"asb",code:"ASB",name:"TEST As-built",percent:"25"},
  ];
  const coreAllocationTemplate=await publishedTemplate("Core Activation Allocation","100",true,corePhases);
  const coreWorkflowId=randomUUID(),coreWorkflowVersionId=randomUUID();
  const coreWorkflowDefinition=validateDeliveryWorkflowDefinition({schemaVersion:1,deliverableTypes:["SHOP_DRAWING"],
    roles:{execute:"DRAFTER",review:"QC_REVIEWER",approve:"PROJECT_MANAGER"},
    phases:corePhases.map((phase,index)=>({id:phase.phaseId,code:phase.code,name:phase.name,order:index+1,
      tasks:[{id:`${phase.phaseId}-task`,code:`${phase.code}-TASK`,name:`${phase.name} task`,order:1,requiredDocuments:[]}],
      completionRule:"all_tasks_complete",qcRequired:true,approvalRequired:true})),
    transitions:corePhases.slice(0,-1).map((phase,index)=>({from:phase.phaseId,to:corePhases[index+1].phaseId,
      gate:"qc_approved",requiredDocuments:[]})),reopen:{role:"approve",reasonRequired:true},
    economicAllocation:{sourceVersionId:coreAllocationTemplate.versionId,proposal:{method:"apu_default"}}});
  await pool.query(`INSERT INTO company_delivery_workflow_templates(id,company_id,code,name,created_by_id)
    VALUES($1,$2,'TEST-CORE-ALLOCATED','TEST Core allocated workflow',$3)`,[coreWorkflowId,companyId,actor.id]);
  await pool.query(`INSERT INTO company_delivery_workflow_versions
    (id,template_id,version,state,revision,definition,fingerprint,effective_from,approved_at,approved_by_id,published_at,published_by_id,created_by_id,updated_by_id)
    VALUES($1,$2,1,'published',3,$3::jsonb,$4,now(),now(),$5,now(),$6,$6,$6)`,
    [coreWorkflowVersionId,coreWorkflowId,JSON.stringify(coreWorkflowDefinition),deliveryWorkflowFingerprint(coreWorkflowDefinition),checker.id,actor.id]);
  const coreProjectId=Number((await pool.query(`INSERT INTO projects(name,code,status,created_by_id) VALUES('TEST core enrichment','TEST-CORE-ENRICH','active',$1) RETURNING id`,[actor.id])).rows[0].id);
  await pool.query(`INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,'admin','active'),($1,$3,'member','active')`,[coreProjectId,actor.id,checker.id]);
  const corePath=`/projects/${coreProjectId}/intake`;
  const coreInitial=await request('POST',corePath);
  const coreData={...data,team:{...data.team,projectLeaderUserId:null,assignments:data.team.assignments.map(a=>({...a,userId:null,personName:"",plannedHours:"1"}))},commercial:{...data.commercial,budgetSnapshotId:'',contracts:data.commercial.contracts.map(({pricingTemplateVersionId,...contract})=>contract)},
    scopeItems:data.scopeItems.map(({apuPlanVersion,budgetSnapshotLineId,projectCostNodeId,...item})=>({...item,deliveryWorkflowVersionId:coreWorkflowVersionId,quantity:"12",unit:"Drawings",workPackages:item.workPackages.map(pkg=>({...pkg,id:`CORE-${pkg.id}`,packageCode:`CORE-${pkg.packageCode}`}))}))};
  const coreSaved=await request('PUT',corePath,{expectedRevision:coreInitial.body.revision,data:coreData});
  assert.equal(coreSaved.status,200,JSON.stringify(coreSaved.body));
  const coreRequest={expectedRevision:coreSaved.body.revision,confirmationFingerprint:coreSaved.body.completion.fingerprint};
  const coreActivated=await request('POST',`${corePath}/activate`,coreRequest);
  assert.equal(coreActivated.status,200,JSON.stringify(coreActivated.body));
  assert.equal(coreActivated.body.activationMode,'core');
  const pendingResourceRows=(await pool.query('SELECT user_id, person_name, billing_hourly_rate, planned_billable_value FROM job_activation_resource_assignments WHERE intake_id=$1',[coreInitial.body.id])).rows;
  assert.equal(pendingResourceRows.length,0,'Generic demand must not create fake person assignments');
  const activatedDemand=(await request('GET',corePath)).body.data.team.assignments;
  assert.ok(activatedDemand.length>0);
  assert.ok(activatedDemand.every((row:any)=>row.userId===null&&row.personName===''));
  assert.ok(activatedDemand.every((row:any)=>row.customerHourlyRate==='25'||row.customerHourlyRate==='42.5'), 'Drawing price remains a Contract Item mirror, never an assignment row');
  assert.equal(coreSaved.body.completion.totals.assignedHours,'0');
  console.log('UX025 real HTTP/database: generic roles save/reopen and activate with partial hours, no leader or employee identity PASS');
  const coreBefore=await request('GET',corePath);
  const rejectedEnrichment=await request('POST',`${corePath}/activate`,{expectedRevision:coreBefore.body.revision,confirmationFingerprint:coreBefore.body.completion.fingerprint,requireCommercial:true});
  assert.equal(rejectedEnrichment.status,409,JSON.stringify(rejectedEnrichment.body));
  assert.equal(rejectedEnrichment.body.code,'JOB_INTAKE_COMMERCIAL_BUDGET_REQUIRED');
  assert.deepEqual((await request('GET',corePath)).body.activation,coreBefore.body.activation);
  assert.equal((await pool.query('SELECT count(*)::int n FROM financial_contracts WHERE project_id=$1',[coreProjectId])).rows[0].n,0);
  const commercialMirrors = await request('PUT',corePath,{expectedRevision:coreBefore.body.revision,
    data:{...coreBefore.body.data,scopeItems:coreBefore.body.data.scopeItems.map((item:any)=>({...item,apuPlanVersion:1}))}});
  assert.equal(commercialMirrors.status,200,JSON.stringify(commercialMirrors.body));
  const persistedMirrors=await request('GET',corePath);
  assert.equal(persistedMirrors.body.data.team.assignments[0].apuPlanVersion,1);
  assert.deepEqual(persistedMirrors.body.activation,coreBefore.body.activation);
  const changedHours=await request('PUT',corePath,{expectedRevision:persistedMirrors.body.revision,
    data:{...persistedMirrors.body.data,team:{...persistedMirrors.body.data.team,
      assignments:persistedMirrors.body.data.team.assignments.map((a:any)=>({...a,plannedHours:'99'}))}}});
  assert.equal(changedHours.status,409,JSON.stringify(changedHours.body));
  assert.equal(changedHours.body.code,'JOB_INTAKE_CORE_IMMUTABLE');
  console.log('C020 live-defect regression PASS: core activation remains available; explicit Commercial request cannot silently return core success; existing activation unchanged');
  const budgetChoices=await getFinancialBudgetWorkspace({actorUserId:actor.id,projectId});
  assert.equal(budgetChoices.snapshots[0].budgetVersion,1);
  assert.equal(budgetChoices.snapshots[0].total,'420.000000');
  assert.equal(budgetChoices.snapshots[0].currency,'USD');
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
  const replacement = await publishedTemplate("Replacement Review Reference","240",true);
  // Synthetic published prerequisites, selected before activation. Never patch
  // an activated binding to manufacture a positive funding test.
  const productionWorkflowId=randomUUID(),productionWorkflowVersionId=randomUUID();
  const productionDefinition=validateDeliveryWorkflowDefinition({schemaVersion:1,deliverableTypes:["SHOP_DRAWING"],
    roles:{execute:"DRAFTER",review:"QC_REVIEWER",approve:"PROJECT_MANAGER"},
    phases:[{id:"production",code:"PROD",name:"TEST Production",order:1,
      tasks:[{id:"produce",code:"PRODUCE",name:"TEST Produce",order:1,requiredDocuments:[]}],
      completionRule:"all_tasks_complete",qcRequired:true,approvalRequired:true}],
    transitions:[],reopen:{role:"approve",reasonRequired:true},
    economicAllocation:{sourceVersionId:replacement.versionId,proposal:{method:"apu_default"}}});
  const productionWorkflowFingerprint=deliveryWorkflowFingerprint(productionDefinition);
  await pool.query(`INSERT INTO company_delivery_workflow_templates(id,company_id,code,name,created_by_id)
    VALUES($1,$2,'TEST-PRODUCTION','TEST Production',$3)`,[productionWorkflowId,companyId,actor.id]);
  await pool.query(`INSERT INTO company_delivery_workflow_versions
    (id,template_id,version,state,revision,definition,fingerprint,effective_from,approved_at,approved_by_id,published_at,published_by_id,created_by_id,updated_by_id)
    VALUES($1,$2,1,'published',3,$3::jsonb,$4,now(),now(),$5,now(),$6,$6,$6)`,
    [productionWorkflowVersionId,productionWorkflowId,JSON.stringify(productionDefinition),productionWorkflowFingerprint,checker.id,actor.id]);
  let correctedData = { ...data,scopeItems:data.scopeItems.map(item=>item.contractId==='ADD'
    ? {...item,deliveryWorkflowVersionId:productionWorkflowVersionId}
    : {...item,deliveryWorkflowVersionId:coreWorkflowVersionId}),commercial:{ ...data.commercial,contracts:[data.commercial.contracts[0],
    { ...data.commercial.contracts[1],pricingTemplateVersionId:replacement.versionId }] } };
  const recovered = await request("PUT",intakePath,{ expectedRevision:reopened.body.revision,data:correctedData });
  assert.equal(recovered.status,200,JSON.stringify(recovered.body));
  let ready = await request("GET",intakePath);
  assert.equal(ready.body.data.commercial.contracts[1].pricingTemplateVersionId,replacement.versionId);
  for (const [allocation,code] of [[undefined,"INTAKE_PRODUCTION_ALLOCATION_REQUIRED"],["239.99","INTAKE_PRODUCTION_ALLOCATION_TOTAL"]] as const) {
    if (allocation !== undefined) {
      const invalidAllocation = await request("PUT",intakePath,{expectedRevision:ready.body.revision,
        data:{...correctedData,scopeItems:correctedData.scopeItems.map(item=>item.contractId==="ADD"?{...item,productionAllocation:allocation}:item)}});
      assert.equal(invalidAllocation.status,200,JSON.stringify(invalidAllocation.body));
      ready=await request("GET",intakePath);
    }
    const rejected=await request("POST",`${intakePath}/activate`,{expectedRevision:ready.body.revision,confirmationFingerprint:ready.body.completion.fingerprint});
    assert.equal(rejected.status,409,JSON.stringify(rejected.body));
    assert.equal(rejected.body.code,code);
    assert.equal(Number((await pool.query(`SELECT count(*)::int n FROM financial_contracts WHERE project_id=$1`,[projectId])).rows[0].n),0,"Invalid production funding rolls back contracts");
    assert.equal(Number((await pool.query(`SELECT count(*)::int n FROM job_activation_work_items WHERE project_id=$1`,[projectId])).rows[0].n),0,"Invalid production funding creates no Work Items");
  }
  correctedData={...correctedData,scopeItems:correctedData.scopeItems.map(item=>item.contractId==="ADD"?{...item,productionAllocation:"240"}:item)};
  const allocated=await request("PUT",intakePath,{expectedRevision:ready.body.revision,data:correctedData});
  assert.equal(allocated.status,200,JSON.stringify(allocated.body));
  ready=await request("GET",intakePath);
  assert.equal(ready.body.data.scopeItems.find((item:any)=>item.contractId==="ADD").productionAllocation,"240");
  const activated = await request("POST",`${intakePath}/activate`,{
    expectedRevision:ready.body.revision,confirmationFingerprint:ready.body.completion.fingerprint });
  assert.equal(activated.status,200,JSON.stringify(activated.body));
  assert.equal(activated.body.contractIds.length,2);
  const packageTasks = (await pool.query(`SELECT t.id,t.planned_hours,t.task_key,t.phase_code "taskPhaseCode",
    p.package_code "packageCode",p.phase_code "packagePhaseCode" FROM job_activation_tasks t
    JOIN job_activation_work_items w ON w.id=t.work_item_id
    JOIN job_activation_work_package_tasks l ON l.task_id=t.id
    JOIN job_activation_work_packages p ON p.id=l.package_id WHERE w.project_id=$1`,[projectId])).rows;
  assert.equal(packageTasks.length,7,"Two configured packages plus five workflow-phase packages remain linked");
  const configuredPackageCodes=new Set(["WP-DRAW","WP-REVIEW"]);
  const configuredPackageTasks=packageTasks.filter((task:any)=>configuredPackageCodes.has(task.packageCode));
  assert.deepEqual(configuredPackageTasks.map((task:any)=>task.packageCode).sort(),["WP-DRAW","WP-REVIEW"]);
  const phasePackageTasks=packageTasks.filter((task:any)=>!configuredPackageCodes.has(task.packageCode));
  assert.deepEqual(phasePackageTasks.map((task:any)=>task.taskPhaseCode).sort(),["ASB","COO","FOR","PRE","PROD"]);
  assert.ok(phasePackageTasks.every((task:any)=>task.packagePhaseCode===task.taskPhaseCode),
    "Every generated workflow-phase package links to its exact allocated phase task");
  const activatedTaskHours=Number((await pool.query(`SELECT COALESCE(SUM(t.planned_hours),0)::text total FROM job_activation_tasks t
    JOIN job_activation_work_items w ON w.id=t.work_item_id WHERE w.project_id=$1`,[projectId])).rows[0].total);
  assert.equal(activatedTaskHours,14,"Verified workflow phases preserve the planned scope hours without duplication");
  assert.ok(packageTasks.every((task:any)=>Number(task.planned_hours)>0),"Each package links to a real allocated workflow task");
  await assert.rejects(pool.query(`UPDATE job_activation_tasks SET planned_hours=-1 WHERE id=$1`,[packageTasks[0].id]),
    (error:any) => error.constraint === "job_activation_task_hours_chk");
  await assert.rejects(pool.query(`UPDATE job_activation_tasks SET planned_hours=0 WHERE id=$1`,[packageTasks[1].id]),
    (error:any) => error.constraint === "job_activation_task_hours_chk");
  const activationState = async () => (await pool.query(`SELECT
    (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM financial_contracts c WHERE c.project_id=$1) contracts,
    (SELECT jsonb_agg(to_jsonb(w) ORDER BY w.id) FROM job_activation_work_items w WHERE w.project_id=$1) items,
    (SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM job_activation_execution_baselines b WHERE b.project_id=$1) baselines,
    (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM job_activation_tasks t JOIN job_activation_work_items w ON w.id=t.work_item_id WHERE w.project_id=$1) tasks`,[projectId])).rows[0];
  const firstActivationState = await activationState();
  assert.ok(firstActivationState.items?.length > 0,"Activation must generate Work Items");
  const repeated = await Promise.all(Array.from({length:4},() => request("POST",`${intakePath}/activate`,{
    expectedRevision:ready.body.revision,confirmationFingerprint:ready.body.completion.fingerprint })));
  for (const result of repeated) {
    assert.equal(result.status,200,JSON.stringify(result.body));
    assert.equal(result.body.idempotent,true);
    assert.deepEqual(result.body.contractIds,activated.body.contractIds);
  }
  assert.deepEqual(await activationState(),firstActivationState,"Concurrent retries must preserve exact contract, Work Item and baseline rows");
  const replay = await request("POST",`${intakePath}/activate`,{
    expectedRevision:ready.body.revision,confirmationFingerprint:ready.body.completion.fingerprint });
  assert.equal(replay.status,200,JSON.stringify(replay.body)); assert.equal(replay.body.idempotent,true);
  const contracts = await request("GET",`/projects/${projectId}/financial/contracts`);
  assert.equal(contracts.status,200,JSON.stringify(contracts.body));
  assert.equal(contracts.body.contracts.length,2);
  assert.ok(contracts.body.contracts.every((contract:any)=>contract.makerUserId===actor.id), 'Maker presentation uses the exact prepared version identity');
  const boundItems = (await pool.query(`SELECT w.id,w.contract_id,w.contract_version_id,w.stable_scope_item_id,b.definition,b.fingerprint
    FROM job_activation_work_items w JOIN company_delivery_workflow_work_items b ON b.work_item_id=w.id WHERE w.project_id=$1`,[projectId])).rows;
  assert.equal(boundItems.length,2);
  assert.equal(Number((await pool.query(`SELECT count(*)::int n FROM contract_item_workflows WHERE project_id=$1`,[projectId])).rows[0].n),0,
    'Activation must not duplicate the authoritative workflow with a generic contract tree');
  for (const item of boundItems) {
    const path=`/projects/${projectId}/financial/contracts/${item.contract_id}/items/${item.stable_scope_item_id}/workflow`;
    const linked=await request('GET',path);
    assert.equal(linked.status,200,JSON.stringify(linked.body));
    assert.equal(linked.body.deliveryWorkflow.workItemId,item.id);
    assert.equal(linked.body.deliveryWorkflow.fingerprint,item.fingerprint);
    assert.deepEqual(linked.body.deliveryWorkflow.phases,item.definition.phases.map((phase:any)=>({id:phase.id,name:phase.name})));
    assert.deepEqual(linked.body.nodes,[]);
    assert.equal((await request('POST',`${path}/initialize`,{})).status,409);
    assert.equal((await request('POST',`${path}/nodes`,{nodeType:'phase',name:'Forbidden duplicate phase'})).status,409);
  }
  console.log('C020 canonical workflow linkage PASS: exact frozen phases, no duplicate tree, legacy initialization and mutation denied');
  const historicalItem=boundItems[0], historicalWorkflowId=randomUUID(), historicalNodeId=randomUUID();
  await pool.query(`INSERT INTO contract_item_workflows(id,project_id,contract_id,contract_version_id,stable_line_id,display_name,template_key,created_by_id)
    VALUES($1,$2,$3,$4,$5,'Preserved legacy fixture','generic',$6)`,
    [historicalWorkflowId,projectId,historicalItem.contract_id,historicalItem.contract_version_id,historicalItem.stable_scope_item_id,actor.id]);
  await pool.query(`INSERT INTO contract_item_workflow_nodes(id,workflow_id,node_type,name,sequence,created_by_id)
    VALUES($1,$2,'phase','Historical Preliminary',1,$3)`,[historicalNodeId,historicalWorkflowId,actor.id]);
  const legacyHistory=async()=>(await pool.query(`SELECT to_jsonb(w) workflow,to_jsonb(n) node FROM contract_item_workflows w
    JOIN contract_item_workflow_nodes n ON n.workflow_id=w.id WHERE w.id=$1`,[historicalWorkflowId])).rows;
  const beforeLegacy=await legacyHistory();
  const historicalPath=`/projects/${projectId}/financial/contracts/${historicalItem.contract_id}/items/${historicalItem.stable_scope_item_id}/workflow`;
  assert.equal((await request('GET',historicalPath)).body.deliveryWorkflow.workItemId,historicalItem.id);
  assert.equal((await request('PATCH',`${historicalPath}/nodes/${historicalNodeId}`,{expectedRevision:1,status:'in_progress'})).status,409);
  assert.deepEqual(await legacyHistory(),beforeLegacy,'Legacy frozen history must not be overwritten or advanced');
  const byNumber = new Map(contracts.body.contracts.map((contract:any) => [contract.legalNumber,contract]));
  assert.equal((byNumber.get("INT-BASE-001") as any)?.pricingTemplateBinding.versionId,drawingTemplate.versionId);
  assert.equal((byNumber.get("INT-ADD-001") as any)?.pricingTemplateBinding.versionId,replacement.versionId);
  const snapshots = (await pool.query(`SELECT v.commercial_metadata,l.stable_line_id,l.contract_item_snapshot
    FROM financial_contract_versions v JOIN financial_contract_sov_lines l ON l.contract_version_id=v.id
    JOIN financial_contracts c ON c.id=v.contract_id WHERE c.project_id=$1 ORDER BY l.stable_line_id`,[projectId])).rows;
  assert.deepEqual(snapshots.map((row:any) => row.contract_item_snapshot.unitRate),["25","42.5"]);
  assert.deepEqual(snapshots.map((row:any) => row.contract_item_snapshot.apuPlanVersion),[1,2]);
  assert.equal(snapshots.find((row:any)=>row.stable_line_id==="CI-REVIEW").contract_item_snapshot.productionAllocation,"240","Approval fingerprint includes the explicit allocation in the contract line snapshot");
  assert.deepEqual(snapshots.map((row:any) => row.commercial_metadata.pricingTemplateBinding.versionId).sort(),
    [drawingTemplate.versionId,replacement.versionId].sort());
  const budget = (await pool.query(`SELECT content->'projectBudget'->>'total' total FROM job_activation_execution_baselines
    WHERE project_id=$1`,[projectId])).rows[0];
  assert.equal(budget.total,"420");
  const productionBaseline=(await pool.query(`SELECT pricing_snapshot FROM job_activation_contract_item_baselines WHERE project_id=$1 AND stable_line_id='CI-REVIEW'`,[projectId])).rows[0];
  assert.equal(productionBaseline.pricing_snapshot.productionAllocation,"240");
  assert.equal(productionBaseline.pricing_snapshot.contractValue,"170","Frozen production allocation stays distinct from commercial selling value");
  console.log("C017 explicit production allocation: missing/mismatch activation rollback, correction, save/reopen and frozen allocation distinct from selling value PASS");
  // Prove the existing independent contract lifecycle reviews the same allocation,
  // rather than relabeling the Intake save or APU reference as approval.
  const productionContract=byNumber.get("INT-ADD-001") as any;
  const loadProductionSource=async(userId=actor.id)=>{
    const client=await pool.connect();
    try{await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      const result=await loadApprovedContractEconomicSource(client,{actorUserId:userId,projectId,contractVersionId:productionContract.versionId});
      await client.query('COMMIT');return result;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  };
  await assert.rejects(()=>loadProductionSource(),(error:any)=>error.code==='ECONOMIC_CONTRACT_APPROVAL_REQUIRED');
  const freezeProductionPools=()=>withEdtTransaction(client=>freezeApprovedContractPools(client,
    {actorUserId:actor.id,projectId,contractVersionId:productionContract.versionId}));
  await assert.rejects(freezeProductionPools,(error:any)=>error.code==='ECONOMIC_CONTRACT_APPROVAL_REQUIRED');
  const allocationReviewer=(await pool.query(`INSERT INTO users(email,password_hash,full_name,company_id)
    VALUES('allocation-reviewer@test.invalid','unused','TEST allocation reviewer',$1) RETURNING *`,[companyId])).rows[0];
  await pool.query(`INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,'member','active')`,[projectId,allocationReviewer.id]);
  await pool.query(`INSERT INTO commercial_entitlement_events(event_key,user_id,enabled,reason,actor_user_id,source,feature_key)
    VALUES($1,$2,true,'TEST contract review entitlement',$3,'super_admin','contracts')`,[randomUUID(),allocationReviewer.id,actor.id]);
  await pool.query(`INSERT INTO financial_approval_policy_versions(id,company_id,project_id,scope_type,transaction_category,currency,max_amount,version,effective_from,state,reason,created_by_id)
    VALUES($1,$2,$3,'project','owner_contract_approval','USD',1000,1,now(),'active','TEST independent contract limit',$4)`,[randomUUID(),companyId,projectId,actor.id]);
  const allocationReviewerToken=signToken({userId:allocationReviewer.id,email:allocationReviewer.email,fullName:allocationReviewer.full_name,companyId,companyName:'TEST',isSuperAdmin:false});
  const productionContractPath=`/projects/${projectId}/financial/contracts/${productionContract.id}`;
  const accessPath=`${productionContractPath}/grants`;
  const access=await request('GET',accessPath);
  assert.equal(access.status,200,JSON.stringify(access.body));
  assert.ok(access.body.members.some((member:any)=>member.userId===allocationReviewer.id));
  assert.equal((await request('GET',accessPath,undefined,allocationReviewerToken)).status,403,'A reviewer cannot enumerate management-only grants');
  for(const permission of ['view','review','approve']) {
    const granted=await request('POST',accessPath,{userId:allocationReviewer.id,permission,state:'active',reason:'TEST independent record access'});
    assert.equal(granted.status,201,JSON.stringify(granted.body));
  }
  const repeatGrant=await request('POST',accessPath,{userId:allocationReviewer.id,permission:'view',state:'active',reason:'TEST idempotent retry'});
  assert.equal(repeatGrant.body.idempotent,true);
  assert.equal((await request('POST',accessPath,{userId:actor.id,permission:'manage',state:'active',reason:'TEST unauthorized escalation'},allocationReviewerToken)).status,403);
  const reopenedAccess=await request('GET',accessPath);
  assert.equal(reopenedAccess.body.grants.filter((grant:any)=>grant.userId===allocationReviewer.id&&grant.state==='active').length,3);
  console.log('C020 contract record access HTTP: named current members, manager-only read/write, persisted grants and idempotent retry PASS');
  const productionVersionPath=`${productionContractPath}/versions/${productionContract.versionId}`;
  const submitProduction=await request('POST',`${productionVersionPath}/actions`,{action:'submit',expectedRevision:productionContract.revision});
  assert.equal(submitProduction.status,200,JSON.stringify(submitProduction.body));
  const reviewProduction=await request('POST',`${productionVersionPath}/actions`,{action:'start_review',expectedRevision:submitProduction.body.revision},allocationReviewerToken);
  assert.equal(reviewProduction.status,200,JSON.stringify(reviewProduction.body));
  const reviewDetail=await request('GET',productionContractPath,undefined,allocationReviewerToken);
  assert.equal(reviewDetail.status,200);
  assert.equal(reviewDetail.body.detail.makerUserId,actor.id, 'Independent reviewer receives the original maker identity, not their own');
  assert.equal(reviewDetail.body.detail.lines.find((line:any)=>line.stableLineId==='CI-REVIEW').contractItem.productionAllocation,'240');
  const decisionPayload={expectedRevision:reviewProduction.body.revision,confirmationFingerprint:productionContract.contentFingerprint};
  const selfProduction=await request('POST',`${productionVersionPath}/approve`,decisionPayload);
  assert.equal(selfProduction.status,403);assert.equal(selfProduction.body.code,'FIN_MAKER_CHECKER_REQUIRED');
  const staleProduction=await request('POST',`${productionVersionPath}/approve`,{...decisionPayload,confirmationFingerprint:'stale'},allocationReviewerToken);
  assert.equal(staleProduction.status,409);assert.equal(staleProduction.body.code,'CONTRACT_APPROVAL_STALE');
  const approveProduction=await request('POST',`${productionVersionPath}/approve`,decisionPayload,allocationReviewerToken);
  assert.equal(approveProduction.status,200,JSON.stringify(approveProduction.body));
  const approvedProduction=await request('GET',productionContractPath,undefined,allocationReviewerToken);
  assert.equal(approvedProduction.body.contracts[0].status,'approved');
  assert.equal(approvedProduction.body.contracts[0].contentFingerprint,productionContract.contentFingerprint);
  assert.equal(approvedProduction.body.detail.lines.find((line:any)=>line.stableLineId==='CI-REVIEW').contractItem.productionAllocation,'240');
  console.log('C017 independent contract approval: regular reviewer sees exact allocation; self/stale approval denied; approved version preserves allocation PASS');
  const approvedSource=await loadProductionSource(allocationReviewer.id);
  assert.equal(approvedSource.contractPools.directProduction,'240.00');
  assert.deepEqual(approvedSource.allocations.map(item=>[item.stableLineId,item.productionAmount]),[['CI-REVIEW','240']]);
  assert.equal(approvedSource.approval.approvedById,allocationReviewer.id);
  const fractionalDefinition=validateDeliveryWorkflowDefinition({...productionDefinition,
    transitions:[{from:'a',to:'b',gate:'qc_approved',requiredDocuments:[]},{from:'b',to:'c',gate:'qc_approved',requiredDocuments:[]}],
    phases:['a','b','c'].map((id,index)=>({...productionDefinition.phases[0],id,code:id.toUpperCase(),order:index+1,
      tasks:[{...productionDefinition.phases[0].tasks[0],id:`task-${id}`,code:`TASK-${id.toUpperCase()}`}]})),
    economicAllocation:{sourceVersionId:replacement.versionId,proposal:{method:'custom',approvalReason:'TEST exact arithmetic',
      phases:['a','b','c'].map((id,index)=>({phaseId:id,code:id.toUpperCase(),name:id,percent:index===2?'33.34':'33.33'}))}}});
  for(const amount of ['0','0.000001','0.000003','1.123456','999999999.123456']){
    const projection=approvedItemPhaseAllocation({...approvedSource,allocations:[{...approvedSource.allocations[0],productionAmount:amount}]},'CI-REVIEW',
      {definition:fractionalDefinition,fingerprint:deliveryWorkflowFingerprint(fractionalDefinition)});
    assert.equal(projection.rows.reduce((sum,row)=>sum+scaledSignedDecimal(row.amount),0n),scaledSignedDecimal(amount));
    assert.ok(projection.rows.every(row=>scaledSignedDecimal(row.amount)>=0n));
  }
  assert.throws(()=>approvedItemPhaseAllocation(approvedSource,'CI-REVIEW',{definition:productionDefinition,fingerprint:'corrupt'}),
    (error:any)=>error.code==='ECONOMIC_WORKFLOW_SNAPSHOT_MISMATCH');
  const poolsPath=`${productionVersionPath}/economic-pools`;
  assert.equal((await fetch(`${base}${poolsPath}`)).status,401);
  const poolStatus=await request('GET',poolsPath);
  assert.equal(poolStatus.status,200,JSON.stringify(poolStatus.body));
  assert.equal(poolStatus.body.id,null);
  assert.equal(poolStatus.body.canPrepare,true);
  assert.equal(poolStatus.body.canPrepareItems,true);
  assert.equal(poolStatus.body.workItems[0].eligible,true);
  assert.equal(poolStatus.body.workItems[0].prepared,false);
  const readOnlyPools=await request('GET',poolsPath,undefined,allocationReviewerToken);
  assert.equal(readOnlyPools.status,200);
  assert.equal(readOnlyPools.body.canPrepare,false);
  assert.equal((await request('POST',poolsPath,{confirmationFingerprint:productionContract.contentFingerprint},allocationReviewerToken)).status,403);
  assert.equal((await request('POST',poolsPath,{confirmationFingerprint:productionContract.contentFingerprint,amount:'999'})).status,400);
  assert.equal((await request('POST',poolsPath,{confirmationFingerprint:'0'.repeat(64)})).status,409);
  const preparedPools=await request('POST',poolsPath,{confirmationFingerprint:productionContract.contentFingerprint});
  assert.equal(preparedPools.status,200,JSON.stringify(preparedPools.body));
  assert.equal(preparedPools.body.idempotent,false);
  const frozenPools=await freezeProductionPools();
  assert.equal(frozenPools.idempotent,true);
  assert.equal(frozenPools.id,preparedPools.body.id);
  assert.equal((await request('GET',poolsPath)).body.id,frozenPools.id);
  const repeatedPools=await freezeProductionPools();
  assert.equal(repeatedPools.id,frozenPools.id);
  assert.equal(repeatedPools.idempotent,true);
  assert.deepEqual(repeatedPools.source,approvedSource);
  const storedPools=(await pool.query(`SELECT * FROM job_contract_economic_pools WHERE contract_id=$1`,[productionContract.id])).rows;
  assert.equal(storedPools.length,1,'Exactly one reserve source per contract, not per Work Item or retry');
  assert.equal(edtFingerprint(storedPools[0].source_snapshot),approvedSource.sourceFingerprint);
  await assert.rejects(()=>pool.query(`UPDATE job_contract_economic_pools SET source_snapshot='{}' WHERE id=$1`,[frozenPools.id]),/append-only/);
  await assert.rejects(()=>pool.query(`DELETE FROM job_contract_economic_pools WHERE id=$1`,[frozenPools.id]),/append-only/);
  await ensureEdtEngineSchema(pool);
  assert.equal((await freezeProductionPools()).id,frozenPools.id,'Migration replay preserves exact funding identity');
  await assert.rejects(()=>pool.query(`INSERT INTO job_contract_economic_pools
    (id,company_id,project_id,contract_id,contract_version_id,currency,source_snapshot,source_fingerprint,created_by_id)
    SELECT $1,company_id,project_id,contract_id,contract_version_id,currency,source_snapshot,source_fingerprint,created_by_id
    FROM job_contract_economic_pools WHERE id=$2`,[randomUUID(),frozenPools.id]),(error:any)=>error.code==='23505');
  console.log('C017 contract pools: draft denied, approved immutable snapshot, one contract reserve, idempotent replay and update/delete denial PASS');
  const productionItem=(await pool.query(`SELECT id FROM job_activation_work_items WHERE contract_version_id=$1`,[productionContract.versionId])).rows[0];
  const economicPath=`/projects/${projectId}/edt-engine/economic-plans`;
  const economicRequest={workItemId:productionItem.id,expectedContractFingerprint:productionContract.contentFingerprint,
    expectedWorkflowFingerprint:productionWorkflowFingerprint};
  assert.equal((await fetch(`${base}${economicPath}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(economicRequest)})).status,401);
  assert.equal((await request('POST',economicPath,{...economicRequest,directProductionAmount:'999'})).status,409);
  assert.equal((await request('POST',economicPath,{...economicRequest,expectedWorkflowFingerprint:'0'.repeat(64)})).status,409);
  assert.equal((await request('POST',economicPath,economicRequest,allocationReviewerToken)).status,403);
  assert.equal(Number((await pool.query('SELECT count(*)::int n FROM job_activation_work_item_economic_plans WHERE work_item_id=$1',[productionItem.id])).rows[0].n),0);
  const preparedItem=await request('POST',economicPath,economicRequest);
  assert.equal(preparedItem.status,201,JSON.stringify(preparedItem.body));
  assert.equal(preparedItem.body.allocation.directProductionAmount,'240');
  assert.deepEqual(preparedItem.body.allocation.rows.map((row:any)=>[row.phaseId,row.amount]),[['production','240']]);
  assert.equal((await request('POST',economicPath,economicRequest)).status,200);
  const storedItemPlan=(await pool.query('SELECT * FROM job_activation_work_item_economic_plans WHERE work_item_id=$1',[productionItem.id])).rows;
  assert.equal(storedItemPlan.length,1);
  for(const name of ['project_administrative_amount','incentive_reserve_amount','task_earnings_amount','project_earnings_amount'])
    assert.equal(storedItemPlan[0][name],'0.000000','Contract reserves must not be repeated on items');
  assert.equal(edtFingerprint(storedItemPlan[0].source_snapshot),storedItemPlan[0].source_fingerprint);
  assert.equal(storedItemPlan[0].source_snapshot.workflow.versionId,productionWorkflowVersionId);
  assert.equal(storedItemPlan[0].source_snapshot.approvedContract.apu.versionId,replacement.versionId);
  const reopenedItemStatus=await request('GET',poolsPath);
  assert.equal(reopenedItemStatus.body.workItems[0].prepared,true);
  assert.equal(reopenedItemStatus.body.workItems[0].allocation.directProductionAmount,'240');
  console.log('C017 public HTTP item funding: approved source + activated workflow -> exact plan and full immutable source; injected/stale/unauthorized denial; idempotency and no duplicate pools PASS');
  assert.equal(preparedItem.body.projectId,projectId);
  assert.equal(reopenedItemStatus.body.projectId,projectId);
  assert.equal(reopenedItemStatus.body.workItems.find((row:any)=>row.id===productionItem.id).planFingerprint,preparedItem.body.planFingerprint);
  console.log('P150 actual HTTP PASS: approved canonical Contract/APU/budget/Workflow sources, exact production-only plan, permissions, stale/injected-source denial, repeat-safe immutable persistence and exact saved fingerprint reopened. No production or provider access.');
}finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await pool.end();}

