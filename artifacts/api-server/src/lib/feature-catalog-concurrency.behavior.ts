import assert from "node:assert/strict";
import { pool } from "@workspace/db";
import { startFeatureCatalogMigration } from "./feature-catalog-migration";
import { createPlatformCapabilityVersion, FeatureCatalogError } from "./feature-catalog-service";

const value=process.env.PROD_DATABASE_URL;if(!value)throw new Error("An isolated local database is required.");const identity=new URL(value);
if(!["127.0.0.1","localhost","::1"].includes(identity.hostname)||identity.port!=="55434"||identity.pathname!=="/bimlog_step1_concurrency")throw new Error("Refusing non-local concurrency evidence.");
await pool.query(`CREATE TABLE companies(id serial PRIMARY KEY,name text NOT NULL);CREATE TABLE users(id serial PRIMARY KEY,email text NOT NULL,company_id integer REFERENCES companies(id),is_super_admin boolean NOT NULL DEFAULT false);CREATE TABLE admin_actions_log(id serial PRIMARY KEY,admin_user_id integer NOT NULL,admin_email text NOT NULL,action text NOT NULL,target_type text,target_id text,details jsonb,created_at timestamp NOT NULL DEFAULT now());`);
const company=await pool.query(`INSERT INTO companies(name) VALUES('Concurrency Evidence') RETURNING id`);const users=await pool.query(`INSERT INTO users(email,company_id,is_super_admin) VALUES('a@example.test',$1,true),('b@example.test',$1,true),('ordinary@example.test',$1,false) RETURNING id,is_super_admin`,[company.rows[0].id]);
await startFeatureCatalogMigration();
const supers=users.rows.filter((row)=>row.is_super_admin).map((row)=>Number(row.id));const ordinary=Number(users.rows.find((row)=>!row.is_super_admin).id);
const requests=Array.from({length:20},(_,index)=>createPlatformCapabilityVersion({featureKey:"rfi.export.excel",status:"available",reasonCode:`CONCURRENT_${String(index+1).padStart(2,"0")}`,explanation:{en:`Concurrent evidence ${index+1}.`,es:`Evidencia concurrente ${index+1}.`},actorUserId:supers[index%2]}));
const results=await Promise.all(requests);const versions=results.map((row)=>Number(row.version)).sort((a,b)=>a-b);assert.deepEqual(versions,Array.from({length:20},(_,index)=>index+1));
const rows=await pool.query(`SELECT version FROM platform_capability_versions WHERE feature_key='rfi.export.excel' ORDER BY version`);assert.deepEqual(rows.rows.map((row)=>Number(row.version)),versions);
const audit=await pool.query(`SELECT count(*)::int count FROM feature_catalog_audit WHERE event_type='platform_capability_changed' AND feature_key='rfi.export.excel'`);assert.equal(audit.rows[0].count,20);
let controlled=false;try{await createPlatformCapabilityVersion({featureKey:"rfi.export.excel",status:"available",reasonCode:"ORDINARY_DENIED",explanation:{en:"Denied.",es:"Denegado."},actorUserId:ordinary});}catch(error){controlled=error instanceof FeatureCatalogError&&error.code==="SUPER_ADMIN_REQUIRED";}assert.equal(controlled,true);
console.log(JSON.stringify({suite:"platform-capability-concurrency",database:{host:"127.0.0.1",port:55434,name:"bimlog_step1_concurrency",disposable:true},passed:4,checks:{twentyConcurrentRequests:"all_succeeded",orderedVersions:"1-20",auditRows:20,ordinaryUserFailure:"controlled"}},null,2));
await pool.end();
