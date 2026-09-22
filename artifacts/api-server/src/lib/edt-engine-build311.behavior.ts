import assert from "node:assert/strict";
import { approveEdtActivation } from "./edt-engine-activation-service";
import type { EdtTransactionClient, EdtTransactionHost } from "./edt-engine-transaction";

let outcome="approved";
const calls:string[]=[];
const client:EdtTransactionClient={async query<Row>(sql:string){calls.push(sql);
  if(sql.includes("FROM job_activation_requests"))return{rows:[{id:"req-1",intake_id:"intake-1",intake_revision:2,company_id:7,project_id:11,requested_by_id:30,request_fingerprint:"fingerprint",state:"approved"}] as Row[]};
  if(sql.includes("FROM job_activation_decisions"))return{rows:[{id:"decision-1",outcome,request_fingerprint:"fingerprint"}] as Row[]};
  return{rows:[]};
}};
const host:EdtTransactionHost={async connect(){return client}};
const input={actor:{grants:["JOB_ACTIVATION_APPROVE"] as const,actorUserId:41,actorCompanyId:7,actorProjectIds:[11],eligibleRole:"OPERATIONS_DIRECTOR"},companyId:7,projectId:11,requestId:"req-1",expectedFingerprint:"fingerprint",reason:"retry",evidence:{},nodes:[],workItems:[]};
assert.deepEqual(await approveEdtActivation(input,host),{decisionId:"decision-1",idempotent:true});
assert.equal(calls.some(sql=>sql.includes("FROM job_intakes")||sql.startsWith("INSERT")),false);
outcome="rejected";calls.length=0;
await assert.rejects(()=>approveEdtActivation(input,host),(error:unknown)=>error instanceof Error&&"code" in error&&error.code==="ACTIVATION_DECISION_INCONSISTENT");
assert.ok(calls.includes("ROLLBACK"));
console.log("EDT_ENGINE_BUILD311_RESULT=PASS approved retry requires matching immutable decision");
