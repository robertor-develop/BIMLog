import assert from "node:assert/strict";
import { approveEdtActivation, makeEdtWorkItemCode } from "./edt-engine-activation-service";
import type { EdtTransactionClient, EdtTransactionHost } from "./edt-engine-transaction";

const calls: string[] = [];
let revision = 3;
const client: EdtTransactionClient = { async query<Row>(sql: string) {
  calls.push(sql);
  if (sql.includes("FROM job_activation_requests")) return { rows: [{ id:"req-1",intake_id:"intake-1",intake_revision:2,company_id:7,project_id:11,requested_by_id:30,request_fingerprint:"fingerprint",state:"pending" }] as Row[] };
  if (sql.includes("FROM job_intakes")) return { rows: [{ revision,status:"ready" }] as Row[] };
  if (sql.includes("FROM job_activation_work_items")) return { rows: [{id:"item-1",contractId:"contract-1",stableScopeItemId:"scope-1"}] as Row[] };
  return { rows: [], rowCount: 1 };
} };
const host: EdtTransactionHost = { async connect() { return client; } };
const actor = { grants:["JOB_ACTIVATION_APPROVE"] as const,actorUserId:41,actorCompanyId:7,actorProjectIds:[11],eligibleRole:"OPERATIONS_DIRECTOR" };
const nodes=[{kind:"project" as const,sourceIdentity:"project-11",code:"P11",name:"Project 11",sequence:1,snapshot:{}},{kind:"contract" as const,sourceIdentity:"contract-1",parentSourceIdentity:"project-11",code:"C1",name:"Contract 1",sequence:1,snapshot:{}},{kind:"deliverable" as const,sourceIdentity:"deliverable-1",parentSourceIdentity:"contract-1",code:"D1",name:"Deliverable",sequence:1,snapshot:{}},{kind:"location" as const,sourceIdentity:"location-1",parentSourceIdentity:"deliverable-1",code:"L1",name:"Level 1",sequence:1,snapshot:{}}];
const input = { actor,companyId:7,projectId:11,requestId:"req-1",expectedFingerprint:"fingerprint",reason:"approved",evidence:{},nodes,workItems:[{id:"item-1",edtNodeSourceIdentity:"location-1",contractSourceIdentity:"contract-1",locationIdentity:"location-1",locationSnapshot:{},tradeIdentity:"HVAC",tradeSnapshot:{},deliverableTypeIdentity:"deliverable-1",deliverableTypeSnapshot:{},displayCode:makeEdtWorkItemCode({project:nodes[0],contract:nodes[1],deliverable:nodes[2],location:nodes[3],tradeIdentity:"HVAC"})}] };
await assert.rejects(() => approveEdtActivation(input,host), (error: unknown) => error instanceof Error && "code" in error && error.code === "INTAKE_REVISION_CONFLICT");
assert.ok(calls.includes("ROLLBACK"));
assert.equal(calls.some(sql=>sql.includes("INSERT INTO job_activation_decisions")),false);
revision=2;
calls.length=0;
const result=await approveEdtActivation(input,host);
assert.equal(result.nodeCount,4);
assert.ok(calls.some(sql=>sql.includes("INSERT INTO job_activation_decisions")));
console.log("EDT_ENGINE_BUILD308_RESULT=PASS stale Intake cannot be approved into EDT");
