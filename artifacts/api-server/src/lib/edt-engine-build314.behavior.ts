import assert from "node:assert/strict";
import {createWorkItemEconomicPlan} from "./edt-engine-economic-service";
import type {EdtTransactionClient,EdtTransactionHost} from "./edt-engine-transaction";
import { edtFingerprint } from "./edt-engine-transaction";
import { deliveryWorkflowFingerprint, validateDeliveryWorkflowDefinition } from "./delivery-workflow-template-contract";

let intakeStatus="ready",currency="USD",versionId="apu-1";
const calls:string[]=[];
const definition = validateDeliveryWorkflowDefinition({schemaVersion:1,deliverableTypes:["SHOP_DRAWING"],
  roles:{execute:"DRAFTER",review:"QC_REVIEWER",approve:"PROJECT_MANAGER"},
  phases:[{id:"pre",code:"PRE",name:"Preparation",order:1,tasks:[{id:"draw",code:"DRAW",name:"Drawing",order:1,requiredDocuments:[]}],completionRule:"all_tasks_complete",qcRequired:true,approvalRequired:true}],
  transitions:[],reopen:{role:"approve",reasonRequired:true},economicAllocation:{sourceVersionId:"apu-1",proposal:{method:"apu_default"}}});
let workflow:any=null;
let existingPlan:{plan_fingerprint:string;source_fingerprint:string}|null=null;
const client:EdtTransactionClient={async query<Row>(sql:string){calls.push(sql);
  if(sql.includes("FROM job_activation_work_items w"))return{rows:[{id:"w1",intake_id:"i1",project_id:11,contract_id:"c1",contract_version_id:"cv1",intake_status:intakeStatus}] as Row[]};
  if(sql.includes("FROM financial_contract_versions v"))return{rows:[{currency,pricing_template_binding:{versionId}}] as Row[]};
  if(sql.includes("FROM company_delivery_workflow_work_items"))return{rows:(workflow?[workflow]:[]) as Row[]};
  if(sql.includes("FROM job_activation_work_item_economic_plans"))return{rows:(existingPlan?[existingPlan]:[]) as Row[]};
  return{rows:[]};
}};
const host:EdtTransactionHost={async connect(){return client}};
const input={actor:{grants:["JOB_OPERATE"] as const,actorUserId:41,actorCompanyId:7,actorProjectIds:[11],eligibleRole:"OPERATIONS_DIRECTOR"},companyId:7,projectId:11,intakeId:"i1",workItemId:"w1",contractId:"c1",contractVersionId:"cv1",pricingTemplateVersionId:"apu-1",deliveryWorkflowVersionId:"dw1",currency:"USD",directProductionAmount:"1",projectAdministrativeAmount:"0",incentiveReserveAmount:"0",taskEarningsAmount:"0",projectEarningsAmount:"0",resolvedAllocation:{},sourceSnapshot:{}};
await assert.rejects(()=>createWorkItemEconomicPlan(input,host),(e:unknown)=>e instanceof Error&&"code" in e&&e.code==="ECONOMIC_INTAKE_NOT_ACTIVATED");
intakeStatus="activated";currency="EUR";
await assert.rejects(()=>createWorkItemEconomicPlan(input,host),(e:unknown)=>e instanceof Error&&"code" in e&&e.code==="ECONOMIC_CONTRACT_VERSION_MISMATCH");
currency="USD";versionId="apu-other";
await assert.rejects(()=>createWorkItemEconomicPlan(input,host),(e:unknown)=>e instanceof Error&&"code" in e&&e.code==="ECONOMIC_CONTRACT_VERSION_MISMATCH");
assert.equal(calls.some(sql=>sql.includes("INSERT INTO job_activation_work_item_economic_plans")),false);
versionId="apu-1";
const rejectsWorkflow = async(code:string) => {
  calls.length=0;
  await assert.rejects(()=>createWorkItemEconomicPlan(input,host),(e:unknown)=>e instanceof Error&&"code" in e&&e.code===code);
  assert.equal(calls.some(sql=>sql.includes("INSERT INTO job_activation_work_item_economic_plans")),false);
  assert.ok(calls.includes("ROLLBACK"));
};
await rejectsWorkflow("ECONOMIC_WORKFLOW_VERSION_MISMATCH");
workflow={version_id:"other",definition,fingerprint:deliveryWorkflowFingerprint(definition)};
await rejectsWorkflow("ECONOMIC_WORKFLOW_VERSION_MISMATCH");
workflow.version_id="dw1";workflow.fingerprint="corrupt";
await rejectsWorkflow("ECONOMIC_WORKFLOW_SNAPSHOT_MISMATCH");
workflow.definition={...definition,economicAllocation:{sourceVersionId:"apu-other",proposal:{method:"apu_default"}}};
workflow.fingerprint=deliveryWorkflowFingerprint(workflow.definition);
await rejectsWorkflow("ECONOMIC_WORKFLOW_APU_MISMATCH");
workflow={version_id:"dw1",definition,fingerprint:deliveryWorkflowFingerprint(definition)};
calls.length=0;
const created=await createWorkItemEconomicPlan(input,host);
assert.equal(created.idempotent,false);
assert.equal(calls.filter(sql=>sql.includes("INSERT INTO job_activation_work_item_economic_plans")).length,1);
existingPlan={plan_fingerprint:created.planFingerprint,source_fingerprint:edtFingerprint(input.sourceSnapshot)};
calls.length=0;
assert.deepEqual(await createWorkItemEconomicPlan(input,host),{planFingerprint:created.planFingerprint,idempotent:true});
assert.equal(calls.some(sql=>sql.startsWith("INSERT")||sql.startsWith("UPDATE")),false);
calls.length=0;
await assert.rejects(()=>createWorkItemEconomicPlan({...input,sourceSnapshot:{budgetVersion:"different"}},host),
  (e:unknown)=>e instanceof Error&&"code" in e&&e.code==="ECONOMIC_PLAN_SOURCE_IMMUTABLE");
assert.ok(calls.includes("ROLLBACK"));
assert.equal(calls.some(sql=>sql.startsWith("INSERT")||sql.startsWith("UPDATE")),false);
console.log("EDT_ENGINE_BUILD314_RESULT=PASS economic plan checks canonical activated contract APU and currency");
