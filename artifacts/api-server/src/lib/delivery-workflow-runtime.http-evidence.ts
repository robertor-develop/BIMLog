import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { ensureDeliveryWorkflowRuntimeSchema } from "./delivery-workflow-template-migration";
import { BIMLOG_DELIVERY_WORKFLOWS } from "./delivery-workflow-defaults";
import { deliveryWorkflowFingerprint, validateDeliveryWorkflowDefinition } from "./delivery-workflow-template-contract";
import { advanceWorkItemDeliveryPhase, approveWorkItemDeliveryPhase, bindDeliveryWorkflowWithClient, getWorkItemDeliveryWorkflow, linkWorkItemDeliveryEvidence, reopenWorkItemDeliveryPhase, setWorkItemDeliveryStep } from "./delivery-workflow-runtime";

const target = new URL(process.env.PROD_DATABASE_URL ?? "postgres://invalid/invalid");
if (target.hostname !== "127.0.0.1" || target.port !== "55449" || target.pathname !== "/delivery_runtime_test") throw new Error("Delivery Workflow runtime proof requires the isolated local PostgreSQL database on port 55449.");
await pool.query(`CREATE TABLE IF NOT EXISTS companies(id serial PRIMARY KEY,name text NOT NULL)`);
await pool.query(`CREATE TABLE IF NOT EXISTS users(id serial PRIMARY KEY,email text NOT NULL,full_name text NOT NULL,company_id integer NOT NULL REFERENCES companies(id),is_super_admin boolean NOT NULL DEFAULT false)`);
await pool.query(`CREATE TABLE IF NOT EXISTS projects(id serial PRIMARY KEY,name text NOT NULL,code text NOT NULL,created_by_id integer NOT NULL REFERENCES users(id),status text NOT NULL DEFAULT 'active')`);
await pool.query(`CREATE TABLE IF NOT EXISTS files(id serial PRIMARY KEY,project_id integer NOT NULL REFERENCES projects(id),file_name text NOT NULL)`);
await pool.query(`CREATE TABLE IF NOT EXISTS project_members(project_id integer NOT NULL REFERENCES projects(id),user_id integer NOT NULL REFERENCES users(id),status text NOT NULL,role text NOT NULL,PRIMARY KEY(project_id,user_id))`);
await pool.query(`CREATE TABLE IF NOT EXISTS project_company_binding_versions(project_id integer NOT NULL REFERENCES projects(id),company_id integer NOT NULL REFERENCES companies(id),version integer NOT NULL,PRIMARY KEY(project_id,version))`);
await pool.query(`CREATE TABLE IF NOT EXISTS financial_contracts(id text PRIMARY KEY)`);
await pool.query(`CREATE TABLE IF NOT EXISTS financial_contract_versions(id text PRIMARY KEY)`);
await pool.query(`CREATE TABLE IF NOT EXISTS project_cost_nodes(id text PRIMARY KEY)`);
await ensureDeliveryWorkflowRuntimeSchema();
const company = (await pool.query(`INSERT INTO companies(name) VALUES('Test Company') RETURNING id`)).rows[0];
const otherCompany = (await pool.query(`INSERT INTO companies(name) VALUES('Other Company') RETURNING id`)).rows[0];
async function createUser(email: string, companyId: number, admin = false) { return (await pool.query(`INSERT INTO users(email,full_name,company_id,is_super_admin) VALUES($1,$1,$2,$3) RETURNING id`,[email,companyId,admin])).rows[0].id as number; }
const owner = await createUser("owner@test.invalid",company.id,true);
const producer = await createUser("producer@test.invalid",company.id);
const outsider = await createUser("outsider@test.invalid",otherCompany.id);
const project = (await pool.query(`INSERT INTO projects(name,code,created_by_id) VALUES('Runtime Test','RT-1',$1) RETURNING id`,[owner])).rows[0];
await pool.query(`INSERT INTO project_members(project_id,user_id,status,role) VALUES($1,$2,'active','project_admin'),($1,$3,'active','member')`,[project.id,owner,producer]);
const intakeId = randomUUID(), workItemId = randomUUID();
await pool.query(`INSERT INTO job_intakes(id,company_id,project_id,data,created_by_id,updated_by_id) VALUES($1,$2,$3,$4::jsonb,$5,$5)`,[intakeId,company.id,project.id,JSON.stringify({team:{projectLeaderUserId:owner}}),owner]);
await pool.query(`INSERT INTO job_activation_work_items(id,intake_id,project_id,stable_scope_item_id,name,unit,planned_hours,workflow_template,created_by_id)
  VALUES($1,$2,$3,'SCOPE-1','Shop drawing','Hours',10,'generic',$4)`,[workItemId,intakeId,project.id,owner]);
const fileId = (await pool.query(`INSERT INTO files(project_id,file_name) VALUES($1,'shop.pdf') RETURNING id`,[project.id])).rows[0].id;
const base = BIMLOG_DELIVERY_WORKFLOWS.find(row => row.code === "SHOP_DRAWING")!;
const templateId = randomUUID(), versionId = randomUUID();
await pool.query(`INSERT INTO company_delivery_workflow_templates(id,company_id,code,name,created_by_id) VALUES($1,$2,'SHOP_COMPANY','Company Shop',$3)`,[templateId,company.id,owner]);
await pool.query(`INSERT INTO company_delivery_workflow_versions(id,template_id,version,state,definition,fingerprint,approved_at,approved_by_id,published_at,published_by_id,created_by_id,updated_by_id)
  VALUES($1,$2,1,'published',$3::jsonb,$4,now(),$5,now(),$5,$5,$5)`,[versionId,templateId,JSON.stringify(base.definition),base.fingerprint,owner]);
const client = await pool.connect();
try { await client.query("BEGIN"); await bindDeliveryWorkflowWithClient({ client,companyId:company.id,projectId:project.id,workItemId,actorUserId:owner,deliverableType:"SHOP_DRAWING",selectedVersionId:"",executeUserId:producer,leaderUserId:owner }); await client.query("COMMIT"); }
catch(error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
let runtime = await getWorkItemDeliveryWorkflow({actorUserId:owner,projectId:project.id,workItemId});
assert.equal(runtime.versionId,versionId); assert.equal(runtime.selection,"single_company"); assert.equal(runtime.phaseIndex,1);
await assert.rejects(getWorkItemDeliveryWorkflow({actorUserId:outsider,projectId:project.id,workItemId}),/membership/i);
await assert.rejects(advanceWorkItemDeliveryPhase({actorUserId:producer,projectId:project.id,workItemId,expectedRevision:runtime.revision}),/assigned approve role/);
await assert.rejects(setWorkItemDeliveryStep({actorUserId:producer,projectId:project.id,workItemId,expectedRevision:runtime.revision + 1,phaseId:"preliminary",taskId:"prepare",status:"complete"}),/Reload before saving/);
await assert.rejects(advanceWorkItemDeliveryPhase({actorUserId:owner,projectId:project.id,workItemId,expectedRevision:runtime.revision}),/Complete every workflow checkpoint/);
await setWorkItemDeliveryStep({actorUserId:producer,projectId:project.id,workItemId,expectedRevision:runtime.revision,phaseId:"preliminary",taskId:"prepare",status:"complete"});
runtime = await getWorkItemDeliveryWorkflow({actorUserId:owner,projectId:project.id,workItemId});
await assert.rejects(advanceWorkItemDeliveryPhase({actorUserId:owner,projectId:project.id,workItemId,expectedRevision:runtime.revision}),/QC approval/);
await approveWorkItemDeliveryPhase({actorUserId:owner,projectId:project.id,workItemId,expectedRevision:runtime.revision,kind:"qc"});
runtime = await getWorkItemDeliveryWorkflow({actorUserId:owner,projectId:project.id,workItemId});
await advanceWorkItemDeliveryPhase({actorUserId:owner,projectId:project.id,workItemId,expectedRevision:runtime.revision});
runtime = await getWorkItemDeliveryWorkflow({actorUserId:owner,projectId:project.id,workItemId}); assert.equal(runtime.phaseIndex,2);
await setWorkItemDeliveryStep({actorUserId:producer,projectId:project.id,workItemId,expectedRevision:runtime.revision,phaseId:"for_record",taskId:"issue",status:"complete"});
runtime = await getWorkItemDeliveryWorkflow({actorUserId:owner,projectId:project.id,workItemId});
await assert.rejects(approveWorkItemDeliveryPhase({actorUserId:owner,projectId:project.id,workItemId,expectedRevision:runtime.revision,kind:"approval"}),/Required DRAWING evidence/);
await linkWorkItemDeliveryEvidence({actorUserId:producer,projectId:project.id,workItemId,expectedRevision:runtime.revision,phaseId:"for_record",taskId:"issue",documentCode:"DRAWING",fileId});
runtime = await getWorkItemDeliveryWorkflow({actorUserId:owner,projectId:project.id,workItemId});
await approveWorkItemDeliveryPhase({actorUserId:owner,projectId:project.id,workItemId,expectedRevision:runtime.revision,kind:"approval"});
runtime = await getWorkItemDeliveryWorkflow({actorUserId:owner,projectId:project.id,workItemId});
await advanceWorkItemDeliveryPhase({actorUserId:owner,projectId:project.id,workItemId,expectedRevision:runtime.revision});
runtime = await getWorkItemDeliveryWorkflow({actorUserId:owner,projectId:project.id,workItemId}); assert.equal(runtime.status,"complete");
const priorFingerprint = runtime.fingerprint, priorEvents = runtime.events.length;
const revised = validateDeliveryWorkflowDefinition({ ...base.definition, phases: base.definition.phases.map((phase,index)=>index===0 ? {...phase,name:"Changed future phase"}:phase) });
const newVersionId = randomUUID();
await pool.query(`UPDATE company_delivery_workflow_versions SET state='superseded' WHERE id=$1`,[versionId]);
await pool.query(`INSERT INTO company_delivery_workflow_versions(id,template_id,version,state,definition,fingerprint,approved_at,approved_by_id,published_at,published_by_id,created_by_id,updated_by_id)
  VALUES($1,$2,2,'published',$3::jsonb,$4,now(),$5,now(),$5,$5,$5)`,[newVersionId,templateId,JSON.stringify(revised),deliveryWorkflowFingerprint(revised),owner]);
runtime = await getWorkItemDeliveryWorkflow({actorUserId:owner,projectId:project.id,workItemId});
assert.equal(runtime.versionId,versionId); assert.equal(runtime.fingerprint,priorFingerprint); assert.equal(runtime.definition.phases[0].name,"Preliminary");
await assert.rejects(pool.query(`UPDATE company_delivery_workflow_work_items SET definition='{}'::jsonb WHERE work_item_id=$1`,[workItemId]));
await assert.rejects(pool.query(`DELETE FROM company_delivery_workflow_work_item_events WHERE work_item_id=$1`,[workItemId]));
await reopenWorkItemDeliveryPhase({actorUserId:owner,projectId:project.id,workItemId,expectedRevision:runtime.revision,targetPhaseId:"preliminary",reason:"Rework requested"});
runtime = await getWorkItemDeliveryWorkflow({actorUserId:owner,projectId:project.id,workItemId}); assert.equal(runtime.phaseIndex,1); assert.equal(runtime.status,"active"); assert.ok(runtime.events.length > priorEvents);
console.log("Delivery Workflow isolated runtime: company selection, role and document gates, QC, approval, completion, immutable version, reopening, audit PASS");
await pool.end();
