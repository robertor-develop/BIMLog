import assert from "node:assert/strict";
import express from "express";
import { pool } from "@workspace/db";
import featuresRouter from "../routes/features";
import { signToken } from "../middlewares/auth";
import { startFeatureCatalogMigration } from "./feature-catalog-migration";

const connectionString = process.env.PROD_DATABASE_URL;
if (!connectionString) throw new Error("An isolated local PROD_DATABASE_URL is required.");
const identity = new URL(connectionString);
if (!["127.0.0.1", "localhost", "::1"].includes(identity.hostname) || identity.port !== "55434" || identity.pathname !== "/bimlog_step1_http") {
  throw new Error("Refusing to run outside the approved disposable local HTTP database.");
}

await pool.query(`
  CREATE TABLE companies(id serial PRIMARY KEY,name text NOT NULL);
  CREATE TABLE users(id serial PRIMARY KEY,email text NOT NULL UNIQUE,password_hash text NOT NULL,full_name text NOT NULL,company_id integer NOT NULL REFERENCES companies(id),is_super_admin boolean NOT NULL DEFAULT false,notification_preferences jsonb);
  CREATE TABLE projects(id serial PRIMARY KEY,name text NOT NULL,created_by_id integer NOT NULL REFERENCES users(id));
  CREATE TABLE project_members(id serial PRIMARY KEY,project_id integer NOT NULL REFERENCES projects(id),user_id integer NOT NULL REFERENCES users(id),role text NOT NULL,status text);
  CREATE TABLE config_options(id serial PRIMARY KEY,category text NOT NULL,value text NOT NULL,label text NOT NULL,label_es text NOT NULL,sort_order integer NOT NULL DEFAULT 0,meta json);
  CREATE TABLE admin_actions_log(id serial PRIMARY KEY,admin_user_id integer NOT NULL,admin_email text NOT NULL,action text NOT NULL,target_type text,target_id text,details jsonb,created_at timestamp NOT NULL DEFAULT now());
  CREATE TABLE entitlement_rules(id text PRIMARY KEY,version integer NOT NULL,company_id integer REFERENCES companies(id),capability text NOT NULL,funding_type text NOT NULL,enabled boolean NOT NULL DEFAULT true,effective_from timestamptz NOT NULL,effective_to timestamptz);
`);
const company = await pool.query(`INSERT INTO companies(name) VALUES('HTTP Evidence'),('Other Tenant') RETURNING id`);
const companyId = Number(company.rows[0].id), otherCompanyId = Number(company.rows[1].id);
const roles = ["project_admin","convention_manager","discipline_lead","member","sub_trade","read_only"] as const;
const permission: Record<string,string> = {project_admin:"admin",convention_manager:"write",discipline_lead:"write",member:"write",sub_trade:"write",read_only:"read"};
for (const role of roles) await pool.query(`INSERT INTO config_options(category,value,label,label_es,meta) VALUES('member_role',$1,$1,$1,$2::json)`,[role,JSON.stringify({permission:permission[role]})]);
const userRows = await pool.query(`INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin,notification_preferences) VALUES
  ('project-admin@example.test','x','Project Admin',$1,false,'{}'),('convention@example.test','x','Convention Manager',$1,false,'{}'),
  ('discipline@example.test','x','Discipline Lead',$1,false,'{}'),('member@example.test','x','Member',$1,false,'{}'),
  ('subtrade@example.test','x','Sub-trade',$1,false,'{}'),('readonly@example.test','x','Read Only',$1,false,'{}'),
  ('inactive@example.test','x','Inactive',$1,false,'{}'),('missing@example.test','x','Missing',$1,false,'{}'),
  ('unknown@example.test','x','Unknown',$1,false,'{}'),('legacy-admin@example.test','x','Legacy Admin',$1,false,'{}'),('legacy-viewer@example.test','x','Legacy Viewer',$1,false,'{}'),('stale-super@example.test','x','Stale Super',$1,true,'{}'),
  ('current-super@example.test','x','Current Super',$1,true,'{}') RETURNING id,email`,[companyId]);
const ids = new Map(userRows.rows.map((row)=>[String(row.email),Number(row.id)]));
const roleEmail: Record<typeof roles[number],string> = {project_admin:"project-admin@example.test",convention_manager:"convention@example.test",discipline_lead:"discipline@example.test",member:"member@example.test",sub_trade:"subtrade@example.test",read_only:"readonly@example.test"};
const project = await pool.query(`INSERT INTO projects(name,created_by_id) VALUES('HTTP Project',$1) RETURNING id`,[ids.get("project-admin@example.test")]); const projectId=Number(project.rows[0].id);
for(const role of roles) await pool.query(`INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,$3,'active')`,[projectId,ids.get(roleEmail[role]),role]);
await pool.query(`INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,'member','inactive'),($1,$3,'future_unknown','active')`,[projectId,ids.get("inactive@example.test"),ids.get("unknown@example.test")]);
await pool.query(`INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,'admin','active'),($1,$3,'viewer','active')`,[projectId,ids.get("legacy-admin@example.test"),ids.get("legacy-viewer@example.test")]);
await pool.query(`INSERT INTO entitlement_rules(id,version,company_id,capability,funding_type,enabled,effective_from) VALUES('http-assistant',9,$1,'assistant','company',true,now())`,[companyId]);
await startFeatureCatalogMigration();

const token = (email:string) => signToken({userId:ids.get(email)!,email,companyId,fullName:email,companyName:"HTTP Evidence",isSuperAdmin:email.includes("super")});
const tokens = new Map([...ids.keys()].map((email)=>[email,token(email)]));
const app=express();app.use(express.json({limit:"16kb"}));app.use("/api/v1",featuresRouter);
const server=await new Promise<ReturnType<typeof app.listen>>((resolve)=>{const value=app.listen(3117,"127.0.0.1",()=>resolve(value));});
const request = async(path:string,email?:string,init:RequestInit={}) => {
  const headers=new Headers(init.headers);if(email)headers.set("Authorization",`Bearer ${tokens.get(email)}`);if(init.body)headers.set("Content-Type","application/json");
  const response=await fetch(`http://127.0.0.1:3117/api/v1${path}`,{...init,headers});const text=await response.text();return {status:response.status,body:text?JSON.parse(text):null,text};
};
const checks:Record<string,string|number|boolean>={};
try {
  assert.equal((await request("/features/catalog")).status,401);checks.unauthenticatedRejected=true;
  const catalog=await request("/features/catalog","member@example.test");assert.equal(catalog.status,200);assert.equal(catalog.body.features.length,19);checks.authenticatedCatalog=19;
  const detail=await request("/features/catalog/ai.file_reading_control","member@example.test");assert.equal(detail.status,200);assert.equal(detail.body.feature.aiClassification,"file_reading_ai");checks.authenticatedDetail=true;
  const before=await pool.query(`SELECT (SELECT count(*) FROM feature_catalog_versions) versions,(SELECT count(*) FROM feature_catalog_activations) activations,(SELECT count(*) FROM feature_catalog_audit) audits,(SELECT count(*) FROM platform_capability_versions) platform`);
  await request("/features/catalog","member@example.test");await request("/features/catalog/rfi.core","member@example.test");
  const after=await pool.query(`SELECT (SELECT count(*) FROM feature_catalog_versions) versions,(SELECT count(*) FROM feature_catalog_activations) activations,(SELECT count(*) FROM feature_catalog_audit) audits,(SELECT count(*) FROM platform_capability_versions) platform`);
  assert.deepEqual(after.rows[0],before.rows[0]);checks.catalogReadsMutatedDatabase=false;
  for(const role of roles){const result=await request(`/features/rfi.core/entitlement?projectId=${projectId}`,roleEmail[role]);assert.equal(result.status,200);assert.equal(result.body.decision,"allow");assert.equal(result.body.evaluation.authorizesExecution,false);checks[`role_${role}_read`]="allow";}
  for(const role of ["project_admin","convention_manager","discipline_lead","member"] as const){const result=await request(`/features/rfi.ai.email_draft/entitlement?projectId=${projectId}&confirmations=confirm_ai_action`,roleEmail[role]);assert.equal(result.body.decision,"confirm");checks[`role_${role}_write`]="confirm";}
  for(const role of ["sub_trade","read_only"] as const){const result=await request(`/features/rfi.ai.email_draft/entitlement?projectId=${projectId}&confirmations=confirm_ai_action`,roleEmail[role]);assert.equal(result.body.decision,"deny");assert.equal(result.body.code,"ENT_ROLE_RESTRICTED");checks[`role_${role}_write`]="deny";}
  const legacyAdminRead=await request(`/features/rfi.core/entitlement?projectId=${projectId}`,"legacy-admin@example.test");assert.equal(legacyAdminRead.body.decision,"allow");
  const legacyAdminWrite=await request(`/features/rfi.ai.email_draft/entitlement?projectId=${projectId}`,"legacy-admin@example.test");assert.equal(legacyAdminWrite.body.decision,"confirm");checks.legacyAdminMapping="read/write";
  const legacyViewerRead=await request(`/features/rfi.core/entitlement?projectId=${projectId}`,"legacy-viewer@example.test");assert.equal(legacyViewerRead.body.decision,"allow");
  const legacyViewerWrite=await request(`/features/rfi.ai.email_draft/entitlement?projectId=${projectId}`,"legacy-viewer@example.test");assert.equal(legacyViewerWrite.body.code,"ENT_ROLE_RESTRICTED");checks.legacyViewerMapping="read-only";
  const unknown=await request(`/features/rfi.core/entitlement?projectId=${projectId}`,"unknown@example.test");assert.equal(unknown.body.code,"ENT_ROLE_RESTRICTED");checks.unknownRoleDenied=true;
  const inactive=await request(`/features/rfi.core/entitlement?projectId=${projectId}`,"inactive@example.test");assert.equal(inactive.body.state,"project_membership_inactive");checks.inactiveMembershipDenied=true;
  const missing=await request(`/features/rfi.core/entitlement?projectId=${projectId}`,"missing@example.test");assert.equal(missing.body.state,"project_membership_missing");checks.missingMembershipDenied=true;
  const arbitrary=await request(`/features/rfi.ai.email_draft/entitlement?projectId=${projectId}&confirmations=confirm_ai_action,anything`,"member@example.test");assert.equal(arbitrary.body.decision,"confirm");assert.equal(arbitrary.body.evaluation.authorizesExecution,false);checks.queryConfirmationCannotGrant=true;
  const file=await request(`/features/ai.file_reading_control/entitlement?confirmations=confirm_ai_estimate,confirm_files_and_scope`,"member@example.test");assert.equal(file.body.code,"ENT_CONFIRMATION_REQUIRED");checks.fileReadingRequiresConfirmation=true;
  const delivery=await request(`/features/telegram.delivery_concierge/entitlement?confirmations=confirm_artifact,confirm_exact_recipients`,"member@example.test");assert.equal(delivery.body.code,"ENT_CONFIRMATION_REQUIRED");checks.externalDeliveryRequiresConfirmation=true;
  const mutation={method:"POST",body:JSON.stringify({status:"available",reasonCode:"HTTP_EVIDENCE",explanation:{en:"HTTP evidence.",es:"Evidencia HTTP."}})};
  assert.equal((await request("/admin/platform-capabilities/rfi.core","project-admin@example.test",mutation)).status,403);checks.projectAdminMutationRejected=true;
  const staleToken=tokens.get("stale-super@example.test");await pool.query(`UPDATE users SET is_super_admin=false WHERE id=$1`,[ids.get("stale-super@example.test")]);tokens.set("stale-super@example.test",staleToken!);
  assert.equal((await request("/admin/platform-capabilities/rfi.core","stale-super@example.test",mutation)).status,403);checks.staleJwtSuperRejected=true;
  assert.equal((await request("/admin/platform-capabilities/rfi.core","current-super@example.test",mutation)).status,201);checks.currentSuperMutationAllowed=true;
  const longReason=await request("/admin/platform-capabilities/rfi.core","current-super@example.test",{...mutation,body:JSON.stringify({status:"available",reasonCode:"R".repeat(81),explanation:{en:"Bounded.",es:"Limitado."}})});assert.equal(longReason.status,400);checks.reasonCodeBounded=true;
  const longExplanation=await request("/admin/platform-capabilities/rfi.core","current-super@example.test",{...mutation,body:JSON.stringify({status:"available",reasonCode:"BOUNDED_TEXT",explanation:{en:"x".repeat(1001),es:"Limitado."}})});assert.equal(longExplanation.status,400);checks.explanationBounded=true;
  const controlExplanation=await request("/admin/platform-capabilities/rfi.core","current-super@example.test",{...mutation,body:JSON.stringify({status:"available",reasonCode:"CONTROL_TEXT",explanation:{en:"bad\u0000text",es:"Limitado."}})});assert.equal(controlExplanation.status,400);checks.controlCharactersRejected=true;
  const concurrent=await Promise.all([
    request("/admin/platform-capabilities/rfi.export.pdf","current-super@example.test",{...mutation,body:JSON.stringify({status:"available",reasonCode:"HTTP_CONCURRENT_A",explanation:{en:"Concurrent A.",es:"Concurrente A."}})}),
    request("/admin/platform-capabilities/rfi.export.pdf","current-super@example.test",{...mutation,body:JSON.stringify({status:"available",reasonCode:"HTTP_CONCURRENT_B",explanation:{en:"Concurrent B.",es:"Concurrente B."}})}),
  ]);assert.deepEqual(concurrent.map((result)=>result.status),[201,201]);assert.deepEqual(concurrent.map((result)=>Number(result.body.version)).sort(),[1,2]);checks.concurrentVersions="1,2";
  await pool.query(`UPDATE users SET company_id=$2 WHERE id=$1`,[ids.get("member@example.test"),otherCompanyId]);const changed=await request(`/features/rfi.core/entitlement?projectId=${projectId}`,"member@example.test");assert.equal(changed.body.state,"authenticated_company_changed");assert.equal("companyId" in changed.body,false);checks.currentCompanyRechecked=true;
  const bad=await request(`/features/${"x".repeat(500)}/entitlement`,"member@example.test");assert.equal(bad.status,400);assert.doesNotMatch(bad.text,/select |postgres|stack|password|secret|company_id/i);checks.boundedErrorsSanitized=true;
  const allText=JSON.stringify({catalog:catalog.body,detail:detail.body,unknown:unknown.body,inactive:inactive.body,missing:missing.body,changed:changed.body,bad:bad.body});assert.doesNotMatch(allText,/SELECT |postgresql|stack trace|password_hash|database url/i);checks.responsePrivacyScan=true;
} finally { await new Promise<void>((resolve,reject)=>server.close((error)=>error?reject(error):resolve())); await pool.end(); }
console.log(JSON.stringify({suite:"canonical-entitlement-authenticated-http",api:"http://127.0.0.1:3117",database:{host:"127.0.0.1",port:55434,name:"bimlog_step1_http",disposable:true},passed:Object.keys(checks).length,checks},null,2));
