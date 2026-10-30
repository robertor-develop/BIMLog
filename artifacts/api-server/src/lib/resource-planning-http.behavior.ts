import assert from "node:assert/strict";
import express from "express";
const target=new URL(process.env.PROD_DATABASE_URL??"postgres://invalid/invalid");if(target.hostname!=="127.0.0.1"||target.port!=="55439"||target.pathname!=="/bimlog_p140_fixture")throw new Error("Only dedicated P140 disposable database permitted");
process.env.JWT_SECRET="p140-local-fixture-only";
import { pool } from "@workspace/db";
import { applyScenario, redactScenarioEvaluation, saveCapacityProfile, saveScenario } from "./team-resource-planning-service";
import { createTeamResourceMutationRateLimit } from "../middlewares/team-resource-planning-rate-limit";

const q=(text:string,values?:unknown[])=>pool.query(text,values);
const profile={weeklyCapacityHours:40,timezone:"America/New_York",workingDays:[1,2,3,4,5],leave:[],internalHourlyRate:100,billingHourlyRate:150};
const assignment=(taskId:string,userId:number,version=1)=>({taskId,assignmentId:null,expectedAssignmentVersion:null,userId,plannedHours:8,startDate:"2026-08-17",endDate:"2026-08-21",category:"Coordination",reason:"Reviewed staffing need",expectedTaskVersion:version});
const errorCode=async(action:()=>Promise<unknown>)=>{try{await action();return null}catch(error:any){return error?.code??error?.message}};

await q(`
DROP SCHEMA public CASCADE; CREATE SCHEMA public;
CREATE TABLE companies(id integer PRIMARY KEY,name text);
CREATE TABLE users(id integer PRIMARY KEY,company_id integer NOT NULL,is_super_admin boolean NOT NULL DEFAULT false,full_name text NOT NULL,email text NOT NULL,job_title text);
CREATE TABLE projects(id integer PRIMARY KEY,name text NOT NULL,code text NOT NULL,created_by_id integer NOT NULL,status text NOT NULL DEFAULT 'active');
CREATE TABLE project_members(project_id integer NOT NULL,user_id integer NOT NULL,role text,status text NOT NULL,PRIMARY KEY(project_id,user_id));
CREATE TABLE project_company_binding_versions(project_id integer NOT NULL,company_id integer NOT NULL,version integer NOT NULL);
CREATE TABLE job_intakes(id text PRIMARY KEY,project_id integer NOT NULL,data jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE job_activation_work_items(id text PRIMARY KEY,project_id integer NOT NULL,name text NOT NULL,workflow_template text NOT NULL,status text NOT NULL DEFAULT 'active');
CREATE TABLE job_activation_tasks(id text PRIMARY KEY,work_item_id text NOT NULL,task_key text NOT NULL,name_en text NOT NULL,name_es text NOT NULL,status text NOT NULL,planned_hours numeric NOT NULL,progress_percent integer NOT NULL DEFAULT 0,assignee_user_id integer,version integer NOT NULL,sequence integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE job_activation_resource_assignments(id text PRIMARY KEY,task_id text NOT NULL,user_id integer,version integer NOT NULL,planned_hours numeric NOT NULL,role text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE job_activation_work_packages(id text PRIMARY KEY,project_id integer NOT NULL,responsible_user_id integer,package_type text NOT NULL,status text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE job_activation_task_deliverables(id text PRIMARY KEY,project_id integer NOT NULL,task_id text NOT NULL,deliverable_type text NOT NULL,linked_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE job_activation_operation_events(id text PRIMARY KEY,project_id integer NOT NULL,work_item_id text,task_id text,assignment_id text,actor_user_id integer NOT NULL,event_type text NOT NULL,evidence jsonb NOT NULL);
INSERT INTO companies VALUES(1,'Alpha'),(2,'Beta');
INSERT INTO users VALUES(1,1,true,'Owner','owner@example.test','Director'),(2,1,false,'Member A','a@example.test','Coordinator'),(3,1,false,'Member B','b@example.test','Coordinator'),(4,2,true,'Other Owner','other@example.test','Director');
INSERT INTO projects VALUES(10,'Alpha Project','ALPHA',1,'active'),(20,'Beta Project','BETA',4,'active');
INSERT INTO project_members VALUES(10,1,'owner','active'),(10,2,'member','active'),(10,3,'member','active'),(20,4,'owner','active');
INSERT INTO project_company_binding_versions VALUES(10,1,1),(20,2,1);
INSERT INTO job_intakes VALUES('i10',10,'{"team":{"projectLeaderUserId":1}}'),('i20',20,'{"team":{"projectLeaderUserId":4}}');
INSERT INTO job_activation_work_items VALUES('w10',10,'Coordination','standard','active'),('w20',20,'Other','standard','active');
INSERT INTO job_activation_tasks VALUES('t1','w10','t1','Task 1','Tarea 1','not_started',8,0,2,1,1,now()),('t2','w10','t2','Task 2','Tarea 2','not_started',8,0,2,1,2,now()),('t20','w20','t20','Other task','Otra tarea','not_started',8,0,4,1,1,now());
`);

await saveCapacityProfile({actorUserId:2,projectId:10,userId:2,profile,expectedVersion:0});
await saveCapacityProfile({actorUserId:3,projectId:10,userId:3,profile,expectedVersion:0});
assert.equal(await errorCode(()=>saveCapacityProfile({actorUserId:2,projectId:20,userId:2,profile,expectedVersion:1})),"TEAM_RESOURCE_MEMBERSHIP_REQUIRED");

const content={name:"Reviewed plan",startDate:"2026-08-17",endDate:"2026-08-21",assignments:[assignment("t1",3)]};
const concurrent=await Promise.allSettled([saveScenario({actorUserId:1,projectId:10,scenarioKey:"concurrent",expectedVersion:0,content}),saveScenario({actorUserId:1,projectId:10,scenarioKey:"concurrent",expectedVersion:0,content})]);
assert.equal(concurrent.filter(x=>x.status==="fulfilled").length,1);assert.equal(concurrent.filter(x=>x.status==="rejected").length,1);
const saved:any=(concurrent.find(x=>x.status==="fulfilled") as PromiseFulfilledResult<any>).value;
const persisted=(await q(`SELECT evaluation FROM team_staffing_scenario_versions WHERE id=$1`,[saved.id])).rows[0].evaluation;
const redacted=redactScenarioEvaluation(persisted,false);assert.equal(redacted.people[0].internalCost,null);assert.equal(redacted.people[0].billingValue,null);assert.equal(redacted.totals.internalCost,null);assert.equal(redacted.totals.billingValue,null);

const applied=await Promise.all([applyScenario({actorUserId:1,projectId:10,scenarioVersionId:saved.id,eventKey:"same-event-key",reason:"Reviewed application"}),applyScenario({actorUserId:1,projectId:10,scenarioVersionId:saved.id,eventKey:"same-event-key",reason:"Reviewed application"})]);
assert.deepEqual(applied[0],applied[1]);assert.equal((await q(`SELECT count(*)::int n FROM team_staffing_application_events`)).rows[0].n,1);
assert.equal(await errorCode(()=>applyScenario({actorUserId:1,projectId:10,scenarioVersionId:saved.id,eventKey:"same-event-key",reason:"Different reviewed reason"})),"TEAM_RESOURCE_EVENT_KEY_DIVERGENT_REPLAY");
assert.equal(await errorCode(()=>applyScenario({actorUserId:4,projectId:20,scenarioVersionId:saved.id,eventKey:"cross-tenant-key",reason:"Reviewed application"})),"TEAM_RESOURCE_SCENARIO_NOT_FOUND");

const rollbackContent={name:"Rollback plan",startDate:"2026-08-17",endDate:"2026-08-21",assignments:[assignment("t1",2,2),assignment("t2",3,1)]};
const rollbackScenario:any=await saveScenario({actorUserId:1,projectId:10,scenarioKey:"rollback",expectedVersion:0,content:rollbackContent});
await q(`CREATE FUNCTION build6_reject_second_task() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.id='t2' THEN RAISE EXCEPTION 'isolated rollback fault'; END IF; RETURN NEW; END $$; CREATE TRIGGER build6_reject_second_task BEFORE UPDATE ON job_activation_tasks FOR EACH ROW EXECUTE FUNCTION build6_reject_second_task()`);
assert.equal(await errorCode(()=>applyScenario({actorUserId:1,projectId:10,scenarioVersionId:rollbackScenario.id,eventKey:"rollback-event",reason:"Reviewed rollback proof"})),"P0001");
assert.equal(Number((await q(`SELECT version FROM job_activation_tasks WHERE id='t1'`)).rows[0].version),2);
assert.equal((await q(`SELECT count(*)::int n FROM team_staffing_application_events WHERE event_key<>$1`,[(await q(`SELECT event_key FROM team_staffing_application_events LIMIT 1`)).rows[0].event_key])).rows[0].n,0);

let allowed=0,limited=0;const request:any={user:{userId:1},params:{projectId:"10"}};const response:any={setHeader:()=>undefined,status:(code:number)=>{if(code===429)limited++;return response},json:()=>response};const next=()=>{allowed++};
const processA=createTeamResourceMutationRateLimit({operation:"cross-process-proof",limit:2,windowMs:60_000});const processB=createTeamResourceMutationRateLimit({operation:"cross-process-proof",limit:2,windowMs:60_000});
await processA(request,response,next);await processB(request,response,next);await processA(request,response,next);assert.equal(allowed,2);assert.equal(limited,1);


await q("DROP TRIGGER IF EXISTS build6_reject_second_task ON job_activation_tasks;DROP FUNCTION IF EXISTS build6_reject_second_task();ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;ALTER TABLE companies ADD COLUMN IF NOT EXISTS retired_into_company_id integer");
await q(`CREATE TABLE IF NOT EXISTS files(id integer PRIMARY KEY);CREATE TABLE IF NOT EXISTS financial_contracts(id text PRIMARY KEY);CREATE TABLE IF NOT EXISTS financial_contract_versions(id text PRIMARY KEY);CREATE TABLE IF NOT EXISTS project_cost_nodes(id text PRIMARY KEY);
ALTER TABLE job_intakes ADD COLUMN IF NOT EXISTS company_id integer,ADD COLUMN IF NOT EXISTS status text,ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE job_activation_work_items ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE job_activation_resource_assignments ADD COLUMN IF NOT EXISTS work_item_id text;
ALTER TABLE job_activation_work_packages ADD COLUMN IF NOT EXISTS due_date date,ADD COLUMN IF NOT EXISTS work_item_id text,ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE job_activation_operation_events ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();`);

const {default:router}=await import("../routes/team-performance"),{signToken}=await import("../middlewares/auth");
const app=express();app.use(express.json());app.use("/api/v1",router);const server=app.listen(0,"127.0.0.1");await new Promise<void>(resolve=>server.once("listening",resolve));const address=server.address();if(!address||typeof address==="string")throw new Error("No fixture address");
const call=async(actor:number,suffix:string,method="GET",body?:unknown,project=10)=>{const response=await fetch(`http://127.0.0.1:${address.port}/api/v1/projects/${project}/commercial/team-performance/resource-planning${suffix}`,{method,headers:{Authorization:`Bearer ${signToken({userId:actor,email:actor===1?"owner@example.test":actor===2?"a@example.test":"other@example.test",companyId:actor===4?2:1,fullName:"Fixture",companyName:"Fixture"})}`,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});return{status:response.status,body:await response.json() as any};};
try{
const proposed={name:"HTTP reviewed scenario",startDate:"2026-08-17",endDate:"2026-08-21",assignments:[assignment("t2",3,1)]};
assert.equal((await call(2,"/scenarios","POST",{...proposed,expectedVersion:0})).status,403);
assert.equal((await call(2,"/evaluate","POST",proposed,20)).status,403);
assert.equal((await call(1,"/evaluate","POST",{...proposed,assignments:[{...proposed.assignments[0],plannedHours:-1}]})).status,400);
const evaluated=await call(1,"/evaluate","POST",proposed);assert.equal(evaluated.status,200);assert.equal(evaluated.body.decision,"review_required");
const capacity=await call(2,"/profiles/2","PUT",{expectedVersion:1,profile});assert.equal(capacity.status,200);assert.equal(capacity.body.version,2);
assert.equal((await call(2,"/profiles/2","PUT",{expectedVersion:1,profile})).status,409);
const savedHttp=await call(1,"/scenarios","POST",{...proposed,scenarioKey:"http-fixture",expectedVersion:0});assert.equal(savedHttp.status,200,JSON.stringify(savedHttp.body));
const reopened=await call(1,"");assert.equal(reopened.status,200);assert.ok(reopened.body.scenarios.some((row:any)=>row.id===savedHttp.body.id));assert.ok(reopened.body.members.some((row:any)=>row.id===2&&row.profile.id===capacity.body.id));
const appliedHttp=await call(1,`/scenarios/${savedHttp.body.id}/apply`,"POST",{eventKey:"http-apply-fixture",reason:"Reviewed route acceptance"});assert.equal(appliedHttp.status,200,JSON.stringify(appliedHttp.body));
assert.deepEqual((await call(1,`/scenarios/${savedHttp.body.id}/apply`,"POST",{eventKey:"http-apply-fixture",reason:"Reviewed route acceptance"})).body,appliedHttp.body);
const final=await call(1,"");assert.ok(final.body.scenarios.find((row:any)=>row.id===savedHttp.body.id).applied);assert.ok(final.body.tasks.some((row:any)=>row.id==="t2"&&row.assigneeUserId===3&&row.version===2));
assert.equal((await call(4,`/scenarios/${savedHttp.body.id}/apply`,"POST",{eventKey:"foreign-http-event",reason:"Foreign attempt"},20)).status,404);
console.log("P140 real HTTP PASS: all four route actions, negative hours400, member save403, foreign evaluate403/apply404, profile stale409, exact profile/scenario reopen, applied task persistence and idempotent replay. Connected service concurrency/rollback/redaction/rate-limit passed.");
}finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();}

