import assert from "node:assert/strict";
import {transitionTimeEntry} from "./edt-engine-economic-service";
import type {EdtTransactionClient,EdtTransactionHost} from "./edt-engine-transaction";

let amount="-100.000000";
const calls:string[]=[];
const client:EdtTransactionClient={async query<Row>(sql:string){calls.push(sql);
  if(sql.includes("FROM job_activation_time_entries e"))return{rows:[{id:"t1",status:"submitted",optimistic_version:2,user_id:30,submitted_by_id:30,project_id:11,intake_id:"i1",work_item_id:"w1",task_id:"task1",hours:"2.000000"}] as Row[]};
  if(sql.includes("FROM job_activation_budget_accounts a"))return{rows:[{id:"account-1"}] as Row[]};
  if(sql.includes("FROM job_activation_budget_ledger_entries"))return{rows:[{budget_account_id:"account-1",pool:"direct_production",amount_delta:amount,hours_delta:"-2.000000"}] as Row[]};
  return{rows:[],rowCount:1};
}};
const host:EdtTransactionHost={async connect(){return client}};
const input={actor:{grants:["TIME_APPROVE"] as const,actorUserId:41,actorCompanyId:7,actorProjectIds:[11],eligibleRole:"OPERATIONS_DIRECTOR"},companyId:7,projectId:11,entryId:"t1",expectedVersion:2,decision:"approve" as const,budgetAccountId:"account-1",pool:"direct_production" as const,amount:"100",reason:"reviewed",evidence:{}};
assert.equal((await transitionTimeEntry(input,host)).status,"approved");
amount="-900.000000";calls.length=0;
await assert.rejects(()=>transitionTimeEntry(input,host),(e:unknown)=>e instanceof Error&&"code" in e&&e.code==="TIME_COMMITMENT_MISMATCH");
assert.equal(calls.some(sql=>sql.startsWith("UPDATE job_activation_time_entries")),false);
console.log("EDT_ENGINE_BUILD315_RESULT=PASS time decisions cannot alter submitted budget impact");
