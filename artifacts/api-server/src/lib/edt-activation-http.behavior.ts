import assert from "node:assert/strict";
import express from "express";
import {randomUUID} from "node:crypto";
const target=new URL(process.env.PROD_DATABASE_URL??"postgres://invalid/invalid");
if(target.hostname!=="127.0.0.1"||target.port!=="55439"||target.pathname!=="/bimlog_p147_fixture")throw new Error("Only the task-owned P147 local fixture is permitted");
process.env.JWT_SECRET="local-p147-fixture-only";
const {pool}=await import("@workspace/db");
// Financial records are upstream fixture snapshots, not financial lifecycle acceptance. EDT and workflow tables use real migrations.
await pool.query(`CREATE TABLE IF NOT EXISTS financial_contracts(id text PRIMARY KEY,company_id integer NOT NULL REFERENCES companies(id),project_id integer NOT NULL REFERENCES projects(id));
 CREATE TABLE IF NOT EXISTS financial_contract_versions(id text PRIMARY KEY,contract_id text NOT NULL REFERENCES financial_contracts(id),currency text NOT NULL,content_fingerprint text NOT NULL);
 CREATE TABLE IF NOT EXISTS project_cost_nodes(id text PRIMARY KEY);`);
await (await import("./job-intake-migration")).ensureJobIntakeSchema();
const {EDT_ENGINE_HIERARCHY_SQL,EDT_ENGINE_GOVERNANCE_SQL}=await import("./edt-engine-migration");await pool.query(EDT_ENGINE_HIERARCHY_SQL);await pool.query(EDT_ENGINE_GOVERNANCE_SQL);
const {ensureDeliveryWorkflowRuntimeSchema}=await import("./delivery-workflow-template-migration");await ensureDeliveryWorkflowRuntimeSchema();
const {BIMLOG_DELIVERY_WORKFLOWS}=await import("./delivery-workflow-defaults");const workflow=BIMLOG_DELIVERY_WORKFLOWS[0];
const {default:router}=await import("../routes/edt-engine"),{signToken}=await import("../middlewares/auth");
const marker=`p147-${randomUUID()}`,company=(await pool.query("INSERT INTO companies(name) VALUES($1) RETURNING id",[marker])).rows[0];
const make=async(name:string,admin=false)=>(await pool.query("INSERT INTO users(email,full_name,company_id,is_super_admin) VALUES($1,$2,$3,$4) RETURNING id,email",[`${marker}-${name}@example.test`,name,company.id,admin])).rows[0];
const leader=await make("leader"),director=await make("director"),drafter=await make("drafter"),admin=await make("admin",true),inactive=await make("inactive"),pmo=await make("pmo"),finance=await make("finance");
const projects=(await pool.query("INSERT INTO projects(created_by_id,code,name) VALUES($1,'P147','Activation fixture'),($1,'OTHER','Foreign fixture') RETURNING id",[admin.id])).rows;const project=projects[0].id,foreign=projects[1].id;
for(const [user,role,status] of [[leader,"project_admin","active"],[director,"member","active"],[drafter,"member","active"],[inactive,"project_admin","inactive"],[pmo,"member","active"],[finance,"finance","active"]] as const)await pool.query("INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,$3,$4)",[project,user.id,role,status]);
await pool.query("INSERT INTO company_master_catalog_administrators(id,company_id,user_id,granted_by_id) VALUES($1,$2,$3,$4)",[marker+"-pmo",company.id,pmo.id,admin.id]);
const intake=marker+"-intake",contract=marker+"-contract",version=marker+"-version",wi=marker+"-wi";
await pool.query("INSERT INTO financial_contracts(id,company_id,project_id) VALUES($1,$2,$3)",[contract,company.id,project]);await pool.query("INSERT INTO financial_contract_versions(id,contract_id,currency,content_fingerprint) VALUES($1,$2,'USD',$3)",[version,contract,"a".repeat(64)]);
const trade=(await pool.query("INSERT INTO enterprise_trades(code,name,created_by_id) VALUES($1,'Fixture HVAC',$2) RETURNING id",[marker,admin.id])).rows[0];
const data={commercial:{contracts:[{id:"profile-1",contractNumber:"C1",title:"Saved Contract"}]},scopeItems:[{id:"scope-1",contractId:"profile-1",deliverableType:"SLEEVE",workPackages:[{id:"wp-1",dimensionType:"floor",dimensionValue:"L2",classification:{disciplineId:String(trade.id),disciplineCode:"HVAC"}}]}]};
const summary={configurationSnapshot:{budgetGovernancePolicy:"standard"},commercialBaselineFingerprint:"c".repeat(64),contracts:[{profileId:"profile-1",contractId:contract,contractVersionId:version}]};
await pool.query("INSERT INTO job_intakes(id,company_id,project_id,status,revision,data,activation_summary,created_by_id,updated_by_id) VALUES($1,$2,$3,'activated',4,$4::jsonb,$5::jsonb,$6,$6)",[intake,company.id,project,JSON.stringify(data),JSON.stringify(summary),leader.id]);
await pool.query("INSERT INTO job_activation_work_items(id,intake_id,project_id,stable_scope_item_id,name,unit,planned_hours,workflow_template,contract_id,contract_version_id,created_by_id) VALUES($1,$2,$3,'scope-1','Saved work','EA',8,'fixture',$4,$5,$6)",[wi,intake,project,contract,version,leader.id]);
await pool.query("INSERT INTO company_delivery_workflow_work_items(work_item_id,project_id,company_id,source,template_code,template_version,deliverable_type,definition,fingerprint,selection,activated_by_id) VALUES($1,$2,$3,'bimlog',$4,1,'SLEEVE',$5::jsonb,$6,'bimlog_default',$7)",[wi,project,company.id,workflow.code,JSON.stringify(workflow.definition),workflow.fingerprint,leader.id]);
const app=express();app.use(express.json());app.use("/api/v1",router);app.use((error:Error,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{console.error(error);res.status(500).json({error:error.message});});const server=app.listen(0,"127.0.0.1");await new Promise<void>(resolve=>server.once("listening",resolve));const address=server.address();assert.ok(address&&typeof address!=="string");
const jwt=(user=leader)=>signToken({userId:user.id,email:user.email,fullName:"Fixture member",companyId:company.id,companyName:marker});
const call=async(path:string,body?:unknown,user=leader,pid=project)=>{const response=await fetch(`http://127.0.0.1:${address.port}/api/v1/projects/${pid}/edt-engine/${path}`,{method:body?"POST":"GET",headers:{Authorization:`Bearer ${jwt(user)}`,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});return{status:response.status,body:await response.json() as any};};
const preview=()=>call(`intakes/${intake}/activation-candidate`);
try{
 assert.equal((await call(`intakes/${intake}/activation-candidate`,undefined,inactive)).status,403);assert.equal((await call(`intakes/${intake}/activation-candidate`,undefined,leader,foreign)).status,403);assert.equal((await call(`intakes/${intake}/activation-candidate`,undefined,finance)).status,403);
 const candidate=await preview();assert.equal(candidate.status,200);assert.equal(candidate.body.canRequest,true);assert.equal(candidate.body.canApprove,false);assert.equal(candidate.body.requests.length,0);assert.equal((await call(`intakes/${intake}/activation-candidate`,undefined,pmo)).body.canRequest,true);
 const request={intakeId:intake,expectedFingerprint:candidate.body.requestFingerprint,reason:"Review saved canonical evidence",idempotencyKey:marker};
 assert.equal((await call("activation-requests",request,drafter)).status,403);assert.equal((await call("activation-requests",request,admin)).status,403);assert.equal((await call("activation-requests",{...request,expectedFingerprint:"b".repeat(64)})).status,409);assert.equal((await call("activation-requests",{...request,reason:123})).status,400);
 const created=await call("activation-requests",{...request,nodes:[{forged:true}],workItems:[{id:"forged"}],companyId:999,actor:{actorUserId:999}});assert.equal(created.status,201);const requestId=created.body.id;
 assert.equal((await call("activation-requests",request)).body.id,requestId);assert.equal((await call("activation-requests",{...request,idempotencyKey:marker+"-another"})).status,409);
 const reopened=await preview();assert.equal(reopened.body.requests[0].id,requestId);assert.equal(reopened.body.requests[0].state,"pending");assert.equal(reopened.body.requests[0].requestedById,leader.id);
 const approval={expectedFingerprint:created.body.fingerprint,reason:"Independent saved version approval",nodes:[],workItems:[]};
 assert.equal((await call(`activation-requests/${requestId}/approve`,approval,director)).status,403);
 const grant=await call("operations-director-grants",{action:"grant",targetUserId:director.id,reason:"Independent director authority fixture"},admin);assert.equal(grant.status,201);
 await call("operations-director-grants",{action:"grant",targetUserId:leader.id,reason:"Self approval rejection fixture"},admin);assert.equal((await call(`activation-requests/${requestId}/approve`,approval)).body.code,"SELF_APPROVAL_PROHIBITED");
 await pool.query("UPDATE financial_contract_versions SET content_fingerprint=$2 WHERE id=$1",[version,"f".repeat(64)]);assert.equal((await call(`activation-requests/${requestId}/approve`,approval,director)).status,409);assert.equal((await pool.query("SELECT count(*)::int n FROM job_activation_edt_nodes WHERE intake_id=$1",[intake])).rows[0].n,0);await pool.query("UPDATE financial_contract_versions SET content_fingerprint=$2 WHERE id=$1",[version,"a".repeat(64)]);
 // A genuine database write failure must roll back nodes, work-item identities and the decision together.
 await pool.query(`CREATE OR REPLACE FUNCTION p147_fixture_fail_decision() RETURNS trigger AS $$ BEGIN IF NEW.request_id='${requestId}' THEN RAISE EXCEPTION 'P147 injected decision failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;CREATE TRIGGER p147_fixture_fail BEFORE INSERT ON job_activation_decisions FOR EACH ROW EXECUTE FUNCTION p147_fixture_fail_decision();`);
 try{assert.equal((await call(`activation-requests/${requestId}/approve`,approval,director)).status,500);}finally{await pool.query("DROP TRIGGER p147_fixture_fail ON job_activation_decisions;DROP FUNCTION p147_fixture_fail_decision()");}
 assert.equal((await pool.query("SELECT count(*)::int n FROM job_activation_edt_nodes WHERE intake_id=$1",[intake])).rows[0].n,0);assert.equal((await preview()).body.requests[0].state,"pending");
 const approved=await call(`activation-requests/${requestId}/approve`,approval,director);assert.equal(approved.status,200);assert.equal(approved.body.workItemCount,1);assert.equal(approved.body.nodeCount,4);
 const replay=await call(`activation-requests/${requestId}/approve`,approval,director);assert.equal(replay.body.idempotent,true);assert.equal(replay.body.decisionId,approved.body.decisionId);
 const final=await preview();assert.equal(final.body.requests[0].state,"approved");assert.equal(final.body.requests[0].decisionId,approved.body.decisionId);assert.equal(final.body.requests[0].decidedById,director.id);
 const saved=(await pool.query("SELECT edt_node_id,display_code,contract_id,status FROM job_activation_work_items WHERE id=$1",[wi])).rows[0];assert.equal(saved.display_code,candidate.body.plan.workItems[0].displayCode);assert.equal(saved.contract_id,contract);assert.equal(saved.status,"active");assert.ok(saved.edt_node_id);assert.equal((await pool.query("SELECT status,revision FROM job_intakes WHERE id=$1",[intake])).rows[0].revision,4);
 await assert.rejects(()=>pool.query("DELETE FROM job_activation_decisions WHERE request_id=$1",[requestId]),/immutable/);
 console.log("P147 actual HTTP PASS: scoped candidate, real director assignment, unchanged CEO/PMO/project/member permissions, server-derived plans, request/reopen/replay, self/stale denial, atomic injected-failure rollback, independent approval/replay, exact saved hierarchy and immutable decision. Dedicated fixture records retained; no production/provider calls.");
}finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();}
