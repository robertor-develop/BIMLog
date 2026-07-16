import assert from "node:assert/strict";
import { pool as setup } from "@workspace/db";
import { startFeatureCatalogMigration } from "./feature-catalog-migration";
import { createPlatformCapabilityVersion, getEffectiveFeature, listEffectiveCatalog, resolveEffectiveEntitlement } from "./feature-catalog-service";

const connectionString = process.env.PROD_DATABASE_URL;
if (!connectionString) throw new Error("An isolated local PROD_DATABASE_URL is required.");
const identity = new URL(connectionString);
if (!["127.0.0.1", "localhost", "::1"].includes(identity.hostname) || identity.port !== "55434" || identity.pathname !== "/bimlog_step1_entitlements") {
  throw new Error("Refusing to run outside the approved disposable local Step 1 database.");
}

await setup.query(`
  CREATE TABLE companies(id serial PRIMARY KEY,name text NOT NULL);
  CREATE TABLE users(id serial PRIMARY KEY,email text NOT NULL,company_id integer REFERENCES companies(id),is_super_admin boolean NOT NULL DEFAULT false,notification_preferences jsonb);
  CREATE TABLE projects(id serial PRIMARY KEY,name text NOT NULL);
  CREATE TABLE project_members(id serial PRIMARY KEY,project_id integer NOT NULL REFERENCES projects(id),user_id integer NOT NULL REFERENCES users(id),role text NOT NULL,status text);
  CREATE TABLE config_options(id serial PRIMARY KEY,category text NOT NULL,value text NOT NULL,label text NOT NULL,label_es text NOT NULL,sort_order integer NOT NULL DEFAULT 0,meta json);
  CREATE TABLE admin_actions_log(id serial PRIMARY KEY,admin_user_id integer NOT NULL,admin_email text NOT NULL,action text NOT NULL,target_type text,target_id text,details jsonb,created_at timestamp NOT NULL DEFAULT now());
  CREATE TABLE entitlement_rules(id text PRIMARY KEY,version integer NOT NULL,company_id integer REFERENCES companies(id),capability text NOT NULL,funding_type text NOT NULL,enabled boolean NOT NULL DEFAULT true,effective_from timestamptz NOT NULL,effective_to timestamptz);
`);
const company = await setup.query(`INSERT INTO companies(name) VALUES('Step 1 Local Evidence') RETURNING id`);
const companyId = company.rows[0].id as number;
const otherCompany = await setup.query(`INSERT INTO companies(name) VALUES('Step 1 Other Local Company') RETURNING id`);
const otherCompanyId = otherCompany.rows[0].id as number;
const users = await setup.query(`INSERT INTO users(email,company_id,is_super_admin,notification_preferences) VALUES
  ('super@example.test',$1,true,'{}'),('member@example.test',$1,false,'{}'),('inactive@example.test',$1,false,'{}'),('project-admin@example.test',$1,false,'{}'),('missing@example.test',$1,false,'{}') RETURNING id,email`, [companyId]);
const byEmail = new Map(users.rows.map((row) => [row.email as string, row.id as number]));
const project = await setup.query(`INSERT INTO projects(name) VALUES('Step 1 Evidence Project') RETURNING id`);
const projectId = project.rows[0].id as number;
await setup.query(`INSERT INTO config_options(category,value,label,label_es,meta) VALUES
  ('member_role','project_admin','Project Admin','Administrador','{"permission":"admin"}'),
  ('member_role','member','Member','Miembro','{"permission":"write"}')`);
await setup.query(`INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,'member','active'),($1,$3,'member','inactive'),($1,$4,'project_admin','active')`,
  [projectId,byEmail.get("member@example.test"),byEmail.get("inactive@example.test"),byEmail.get("project-admin@example.test")]);
await setup.query(`INSERT INTO entitlement_rules(id,version,company_id,capability,funding_type,enabled,effective_from) VALUES('step1-assistant-rule',7,$1,'assistant','company',true,now())`, [companyId]);

await startFeatureCatalogMigration();

const checks: Record<string,string|number|boolean> = {};
const catalog = await listEffectiveCatalog();
assert.equal(catalog.length,19); checks.seededCatalogEntries=catalog.length;
assert.equal((await resolveEffectiveEntitlement({featureKey:"rfi.core",userId:byEmail.get("member@example.test")!,companyId,projectId})).decision,"allow"); checks.activeMembership="allow";
assert.equal((await resolveEffectiveEntitlement({featureKey:"rfi.core",userId:byEmail.get("inactive@example.test")!,companyId,projectId})).decision,"deny"); checks.inactiveMembership="deny";
assert.equal((await resolveEffectiveEntitlement({featureKey:"rfi.core",userId:byEmail.get("missing@example.test")!,companyId,projectId})).state,"project_membership_missing"); checks.missingMembership="deny";
await setup.query(`UPDATE users SET company_id=$2 WHERE id=$1`,[byEmail.get("member@example.test"),otherCompanyId]);
assert.equal((await resolveEffectiveEntitlement({featureKey:"rfi.core",userId:byEmail.get("member@example.test")!,companyId,projectId})).state,"authenticated_company_changed"); checks.currentCompanyRechecked=true;
await setup.query(`UPDATE users SET company_id=$2 WHERE id=$1`,[byEmail.get("member@example.test"),companyId]);

const beforeRead = await setup.query(`SELECT (SELECT count(*) FROM feature_catalog_versions) versions,(SELECT count(*) FROM feature_catalog_activations) activations,(SELECT count(*) FROM feature_catalog_audit) audits,(SELECT count(*) FROM platform_capability_versions) platform`);
await listEffectiveCatalog();
await resolveEffectiveEntitlement({featureKey:"rfi.core",userId:byEmail.get("member@example.test")!,companyId,projectId});
const afterRead = await setup.query(`SELECT (SELECT count(*) FROM feature_catalog_versions) versions,(SELECT count(*) FROM feature_catalog_activations) activations,(SELECT count(*) FROM feature_catalog_audit) audits,(SELECT count(*) FROM platform_capability_versions) platform`);
assert.deepEqual(afterRead.rows[0],beforeRead.rows[0]); checks.readsMutatedDatabase=false;

let immutable = false;
try { await setup.query(`UPDATE feature_catalog_versions SET name_en='changed' WHERE id='rfi.core:1'`); } catch { immutable=true; }
assert.equal(immutable,true); checks.activatedVersionImmutable=true;
for (const [name,sql] of [
  ["activatedVersionDelete",`DELETE FROM feature_catalog_versions WHERE id='rfi.core:1'`],
  ["activationUpdate",`UPDATE feature_catalog_activations SET evidence='{}' WHERE id='activation:rfi.core:1'`],
  ["activationDelete",`DELETE FROM feature_catalog_activations WHERE id='activation:rfi.core:1'`],
] as const) { let rejected=false;try{await setup.query(sql);}catch{rejected=true;}assert.equal(rejected,true);checks[name]=true; }
await setup.query(`INSERT INTO feature_catalog_versions SELECT 'rfi.core:2',feature_key,2,name_en,name_es,description_en,description_es,product_family,module,capability_status,tier_availability,bundle_dependencies,eligible_seat_classes,required_scoped_authorities,supports_company_policy,supports_project_policy,ai_classification,supported_credit_payers,metering_policy_key,confirmation_requirements,file_reading,external_delivery,audit_requirements,authorized_data_scope,preview_upgrade_explanation_en,preview_upgrade_explanation_es,now(),effective_to,deprecated_at,replacement_feature_key,deprecation_explanation_en,deprecation_explanation_es,contract_override_mode,capability_dependencies,commercial_authority,preference_key,$1,now() FROM feature_catalog_versions WHERE id='rfi.core:1'`, [byEmail.get("super@example.test")]);
await setup.query(`INSERT INTO feature_catalog_activations(id,catalog_version_id,activated_by_id,evidence) VALUES('activation:rfi.core:2','rfi.core:2',$1,'{"source":"local_db_evidence"}')`, [byEmail.get("super@example.test")]);
assert.equal((await getEffectiveFeature("rfi.core"))?.version,2); checks.supersedingVersion=2;

let projectAdminRejected=false;
try { await createPlatformCapabilityVersion({featureKey:"rfi.core",status:"suspended",reasonCode:"LOCAL_TEST",explanation:{en:"Local evidence.",es:"Evidencia local."},actorUserId:byEmail.get("project-admin@example.test")!}); } catch { projectAdminRejected=true; }
assert.equal(projectAdminRejected,true); checks.projectAdminPlatformMutationRejected=true;
const platform = await createPlatformCapabilityVersion({featureKey:"rfi.core",status:"suspended",reasonCode:"LOCAL_TEST",explanation:{en:"Local evidence.",es:"Evidencia local."},actorUserId:byEmail.get("super@example.test")!});
assert.equal(platform.capabilityStatus,"suspended"); checks.superAdminPlatformMutation="suspended";
assert.equal((await resolveEffectiveEntitlement({featureKey:"rfi.core",userId:byEmail.get("member@example.test")!,companyId,projectId})).code,"ENT_TEMP_SUSPENDED"); checks.platformPrecedence="ENT_TEMP_SUSPENDED";
const concurrent = await Promise.all([
  createPlatformCapabilityVersion({featureKey:"rfi.export.excel",status:"available",reasonCode:"CONCURRENT_A",explanation:{en:"Concurrent evidence A.",es:"Evidencia concurrente A."},actorUserId:byEmail.get("super@example.test")!}),
  createPlatformCapabilityVersion({featureKey:"rfi.export.excel",status:"available",reasonCode:"CONCURRENT_B",explanation:{en:"Concurrent evidence B.",es:"Evidencia concurrente B."},actorUserId:byEmail.get("super@example.test")!}),
]);
assert.deepEqual(concurrent.map((row)=>Number(row.version)).sort(),[1,2]); checks.concurrentPlatformVersions="1,2";
for (const [name,sql] of [
  ["platformUpdate",`UPDATE platform_capability_versions SET reason_code='CHANGED' WHERE feature_key='rfi.core'`],
  ["platformDelete",`DELETE FROM platform_capability_versions WHERE feature_key='rfi.core'`],
  ["auditUpdate",`UPDATE feature_catalog_audit SET event_type='changed' WHERE event_type='catalog_activated'`],
  ["auditDelete",`DELETE FROM feature_catalog_audit WHERE event_type='catalog_activated'`],
] as const) { let rejected=false;try{await setup.query(sql);}catch{rejected=true;}assert.equal(rejected,true);checks[name]=true; }

const assistant = await resolveEffectiveEntitlement({featureKey:"telegram.assistant",userId:byEmail.get("member@example.test")!,companyId});
assert.equal(assistant.decision,"confirm"); assert.ok(assistant.sources.some((item)=>item.authority==="ai_control_plane"&&item.version===7)); checks.aiAdapter="confirm:version-7";
const audit = await setup.query(`SELECT event_type,count(*)::int count FROM feature_catalog_audit GROUP BY event_type ORDER BY event_type`);
assert.ok(audit.rows.some((row)=>row.event_type==="catalog_activated"&&row.count===20));
assert.ok(audit.rows.some((row)=>row.event_type==="platform_capability_changed"&&row.count===3)); checks.sanitizedAuditRows=23;

console.log(JSON.stringify({suite:"canonical-entitlement-local-db",database:{host:"127.0.0.1",port:55434,name:"bimlog_step1_entitlements",disposable:true},passed:Object.keys(checks).length,checks},null,2));
await setup.end();
