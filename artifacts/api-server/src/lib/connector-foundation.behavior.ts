import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertConnectorJobTransition, coordinationRevisionInputSchema, protectedSecretEnvelopeSchema, retryDelaySeconds, sharePointMappingInputSchema } from "./connector-foundation-contract";
import { CLAIM_CONNECTOR_JOB_SQL, CONNECTOR_FOUNDATION_MIGRATION_SQL, ensureConnectorFoundationSchema } from "./connector-foundation-migration";

const ddl = CONNECTOR_FOUNDATION_MIGRATION_SQL;
for (const table of ["connector_credentials","connector_jobs","connector_job_events","coordination_files","coordination_file_revisions","coordination_file_current_revisions","sharepoint_project_mappings","sharepoint_folder_mappings","sharepoint_sync_states"]) assert.match(ddl, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
for (const field of ["secret_ciphertext","wrapped_data_key","key_version","lease_token","fencing_token","idempotency_key","request_digest","dead_lettered_at","provider_version_id","content_sha256","cursor_ciphertext","mismatch_code"]) assert.match(ddl, new RegExp(field));
assert.match(CLAIM_CONNECTOR_JOB_SQL, /FOR UPDATE SKIP LOCKED/);
assert.match(CLAIM_CONNECTOR_JOB_SQL, /fencing_token=fencing_token\+1/);
assert.match(CLAIM_CONNECTOR_JOB_SQL, /attempts<max_attempts/);
assert.doesNotMatch(ddl, /TRUNCATE|DELETE\s+FROM|DROP\s+(TABLE|COLUMN|CONSTRAINT)/i);

const secret = { secretCiphertext:"c".repeat(32),secretIv:"i".repeat(16),secretTag:"t".repeat(16),wrappedDataKey:"k".repeat(32),wrapIv:"w".repeat(16),wrapTag:"g".repeat(16),keyVersion:2 };
assert.equal(protectedSecretEnvelopeSchema.parse(secret).keyVersion, 2);
assert.throws(() => protectedSecretEnvelopeSchema.parse({ ...secret, plaintext: "forbidden" }));
assertConnectorJobTransition("queued", "leased"); assertConnectorJobTransition("leased", "retry"); assertConnectorJobTransition("dead_letter", "queued");
assert.throws(() => assertConnectorJobTransition("completed", "queued"));
assert.equal(retryDelaySeconds(1),30); assert.equal(retryDelaySeconds(8),3600);
coordinationRevisionInputSchema.parse({coordinationFileId:"cf-1",projectId:1,revisionNumber:2,provider:"sharepoint",providerItemId:"item",providerVersionId:"v2",contentSha256:"a".repeat(64),byteSize:100});
sharePointMappingInputSchema.parse({projectId:1,companyId:2,credentialId:"cred",siteId:"site",libraryId:"library",category:"coordination",tradeId:null,folderId:"folder",folderPath:"/Shared Documents/Coordination"});

const executed:string[]=[];let released=false;
await ensureConnectorFoundationSchema({connect:async()=>({query:async(sql:string)=>{executed.push(sql);},release:()=>{released=true;}})});
assert.deepEqual(executed.slice(0,2),["BEGIN","SELECT pg_advisory_xact_lock(hashtext('bimlog:connector-foundation:v1'))"]); assert.equal(executed.at(-1),"COMMIT"); assert.equal(released,true);
const failed:string[]=[];let failureReleased=false;
await assert.rejects(()=>ensureConnectorFoundationSchema({connect:async()=>({query:async(sql:string)=>{failed.push(sql);if(sql===ddl)throw new Error("forced");},release:()=>{failureReleased=true;}})}));
assert.equal(failed.at(-1),"ROLLBACK");assert.equal(failureReleased,true);

const appSource=readFileSync(new URL("../app.ts",import.meta.url),"utf8");
assert.match(appSource,/queueDatabaseStartup\(async \(\) => \{[\s\S]*startEnterpriseIdentityMigration\(\)[\s\S]*waitForEnterpriseIdentityMigration\(\)[\s\S]*ensureConnectorFoundationSchema\(pool\)/);
assert.doesNotMatch(appSource,/startSharePointWorker|startOutlookWorker|startProcoreWorker/);
console.log("connector foundation behavior: PASS");
