import assert from "node:assert/strict";
import express from "express";
import { randomUUID } from "node:crypto";
const target=new URL(process.env.PROD_DATABASE_URL??"postgres://invalid/invalid");
if(target.hostname!=="127.0.0.1"||target.port!=="55439"||target.pathname!=="/bimlog_rfi_restore_test")throw Error("Owned restored fixture required");
process.env.JWT_SECRET="procore-approval-fixture-only";
const {pool}=await import("@workspace/db");
const {startCompanyProviderApprovalMigration}=await import("./provider-governance");
const {default:router}=await import("../routes/rfis");
const {signToken}=await import("../middlewares/auth");
const mark="approval-"+randomUUID();
const company=Number((await pool.query("INSERT INTO companies(name) VALUES($1) RETURNING id",[mark])).rows[0].id);
const user=(await pool.query("INSERT INTO users(email,password_hash,full_name,company_id) VALUES($1,'unused',$2,$3) RETURNING id,email",[mark+"@example.test",mark,company])).rows[0];
const project=Number((await pool.query("INSERT INTO projects(code,name,status,created_by_id) VALUES($1,$1,'active',$2) RETURNING id",[mark,user.id])).rows[0].id);
await pool.query("INSERT INTO config_options(category,value,label,label_es,meta) VALUES('member_role',$1,$1,$1,'{\"permission\":\"write\"}')",[mark]);
await pool.query("INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,$3,'active')",[project,user.id,mark]);
await pool.query("INSERT INTO project_company_binding_versions(id,project_id,company_id,version,bound_by_id,reason_code,explanation_en,explanation_es,audit_evidence) VALUES($1,$2,$3,1,$4,'AUTHENTICATED_PROJECT_CREATION','Fixture binding','Prueba','{}')",[randomUUID(),project,company,user.id]);
await pool.query("INSERT INTO company_provider_approval_events(event_key,company_id,provider_key,operation,enabled,reason,source) VALUES($1,$2,'procore','*',true,'Controlled approval fixture','owner_instruction')",[mark+"-grant",company]);
await startCompanyProviderApprovalMigration();
const app=express();app.use(express.json());app.use('/api/v1',router);
const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
const port=(server.address() as any).port;
const jwt=signToken({userId:user.id,email:user.email,companyId:company,companyName:mark,fullName:mark});
async function request(){const response=await fetch(`http://127.0.0.1:${port}/api/v1/projects/${project}/rfis/attachments/from-cloud`,{method:'POST',headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify({provider:'procore',ref:'file:700:120',fileName:'Fixture.pdf'})});return{status:response.status,body:await response.json() as any};}
try{
 const approved=await request();assert.equal(approved.status,428,JSON.stringify(approved));
 await pool.query("INSERT INTO company_provider_approval_events(event_key,company_id,provider_key,operation,enabled,reason,source) VALUES($1,$2,'procore','*',false,'Controlled approval revocation','owner_instruction')",[mark+"-revoke",company]);
 const denied=await request();assert.equal(denied.status,403,'revoked Procore import must be denied without process restart');assert.equal(denied.body.code,'PROVIDER_NOT_APPROVED');
 await pool.query("INSERT INTO company_provider_approval_events(event_key,company_id,provider_key,operation,enabled,reason,source) VALUES($1,$2,'procore','*',true,'Controlled approval restoration','owner_instruction')",[mark+"-restore",company]);
 assert.equal((await request()).status,428,'restored current grant must reach normal connection requirement');
 await pool.query("UPDATE project_members SET role='read_only' WHERE project_id=$1 AND user_id=$2",[project,user.id]);
 assert.equal((await request()).status,403,'company connector grant does not replace project write permission');
 assert.equal(Number((await pool.query('SELECT count(*) AS n FROM files WHERE project_id=$1',[project])).rows[0].n),0);
 console.log(JSON.stringify({suite:'procore-rfi-current-approval-http',approvedDisconnected428:true,currentRevocation403:true,currentRestoration428:true,readOnlyDenied403:true,noFileWrites:true,externalCalls:0}));
}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await pool.end();}
