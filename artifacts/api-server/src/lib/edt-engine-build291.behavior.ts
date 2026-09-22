import assert from "node:assert/strict";
import { requestEdtActivation } from "./edt-engine-activation-service";
import type { EdtTransactionClient, EdtTransactionHost } from "./edt-engine-transaction";

const calls:string[]=[];
const client:EdtTransactionClient={async query<Row>(sql:string,_values?:readonly unknown[]){calls.push(sql); if(sql.includes("FROM job_intakes")) return {rows:[{company_id:7,project_id:11,revision:3,status:"ready"}] as Row[]}; if(sql.includes("FROM job_activation_requests")) return {rows:[]}; return {rows:[]};},release(){calls.push("RELEASE")}};
const host:EdtTransactionHost={async connect(){return client}};
const actor={grants:["JOB_ACTIVATION_REQUEST"],actorUserId:9,actorCompanyId:7,actorProjectIds:[11],eligibleRole:"PMO"};
const result=await requestEdtActivation({actor,companyId:7,projectId:11,intakeId:"intake-1",intakeRevision:3,governanceVersionId:"gov-1",pricingVersionId:"apu-1",workflowVersionIds:["wf-1"],reason:"Ready for governed activation",evidence:{source:"intake"},idempotencyKey:"request-1"},host);
assert.equal(result.state,"pending"); assert.match(result.fingerprint,/^[a-f0-9]{64}$/); assert.deepEqual(calls.slice(0,2),["BEGIN ISOLATION LEVEL SERIALIZABLE","SELECT pg_advisory_xact_lock(hashtext($1))"]); assert.ok(calls.includes("COMMIT")); assert.equal(calls.at(-1),"RELEASE");
await assert.rejects(()=>requestEdtActivation({actor:{...actor,actorCompanyId:8},companyId:7,projectId:11,intakeId:"intake-1",intakeRevision:3,governanceVersionId:"gov-1",pricingVersionId:"apu-1",workflowVersionIds:["wf-1"],reason:"No",evidence:{},idempotencyKey:"request-2"},host),/authorization denied/);
console.log("EDT_ENGINE_BUILD291_RESULT=PASS");
