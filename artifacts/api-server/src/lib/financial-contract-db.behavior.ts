import assert from "node:assert/strict";
import { pool } from "@workspace/db";
import { ensureFinancialControlSchema } from "./financial-control-migration";
import { ensureFinancialBudgetSchema } from "./financial-budget-migration";
import { ensureFinancialContractSchema } from "./financial-contract-migration";

const url = process.env.PROD_DATABASE_URL;
if (!url) throw new Error("Disposable PROD_DATABASE_URL required.");
const target = new URL(url);
if (!["127.0.0.1", "localhost"].includes(target.hostname) || target.port !== "55435" || target.pathname !== "/bimlog_financial_build3") throw new Error("Refusing to run outside disposable Build 3 database.");
const checks: Array<{ number: number; name: string; evidence: string }> = [], check = (name: string, evidence: string) => checks.push({ number: checks.length + 1, name, evidence });

await pool.query(`
CREATE TABLE companies(id serial PRIMARY KEY,name text NOT NULL);
CREATE TABLE users(id serial PRIMARY KEY,email text NOT NULL,full_name text NOT NULL DEFAULT 'Test',company_id integer NOT NULL REFERENCES companies(id),is_super_admin boolean NOT NULL DEFAULT false);
CREATE TABLE projects(id serial PRIMARY KEY,name text NOT NULL,code text NOT NULL DEFAULT 'T',status text NOT NULL DEFAULT 'active',created_by_id integer NOT NULL REFERENCES users(id));
CREATE TABLE files(id serial PRIMARY KEY,project_id integer NOT NULL REFERENCES projects(id),file_hash text);
CREATE TABLE schedule_buckets(id serial PRIMARY KEY,project_id integer NOT NULL REFERENCES projects(id),name text NOT NULL,bucket_type text NOT NULL DEFAULT 'custom',sort_order integer NOT NULL DEFAULT 0,created_by_id integer REFERENCES users(id),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE schedule_item_placements(id serial PRIMARY KEY,project_id integer NOT NULL REFERENCES projects(id),source_type text NOT NULL,source_id integer NOT NULL,bucket_id integer REFERENCES schedule_buckets(id),rollover_count integer NOT NULL DEFAULT 0,updated_by_id integer REFERENCES users(id),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
`);
const companyId = Number((await pool.query(`INSERT INTO companies(name) VALUES('Disposable Build 3 Company') RETURNING id`)).rows[0].id);
const userId = Number((await pool.query(`INSERT INTO users(email,company_id) VALUES('finance-build3@example.test',$1) RETURNING id`, [companyId])).rows[0].id);
const projectId = Number((await pool.query(`INSERT INTO projects(name,created_by_id) VALUES('Disposable Build 3 Project',$1) RETURNING id`, [userId])).rows[0].id);
const otherProjectId = Number((await pool.query(`INSERT INTO projects(name,created_by_id) VALUES('Other Disposable Project',$1) RETURNING id`, [userId])).rows[0].id);
const fileId = Number((await pool.query(`INSERT INTO files(project_id,file_hash) VALUES($1,'signed-hash') RETURNING id`, [projectId])).rows[0].id);
const bucketId = Number((await pool.query(`INSERT INTO schedule_buckets(project_id,name,created_by_id) VALUES($1,'Current',$2) RETURNING id`, [projectId, userId])).rows[0].id);
const scheduleId = Number((await pool.query(`INSERT INTO schedule_item_placements(project_id,source_type,source_id,bucket_id,updated_by_id) VALUES($1,'submittal',1,$2,$3) RETURNING id`, [projectId, bucketId, userId])).rows[0].id);
const otherBucket = Number((await pool.query(`INSERT INTO schedule_buckets(project_id,name,created_by_id) VALUES($1,'Other',$2) RETURNING id`, [otherProjectId, userId])).rows[0].id);
const otherScheduleId = Number((await pool.query(`INSERT INTO schedule_item_placements(project_id,source_type,source_id,bucket_id,updated_by_id) VALUES($1,'rfi',2,$2,$3) RETURNING id`, [otherProjectId, otherBucket, userId])).rows[0].id);

await ensureFinancialControlSchema(); await ensureFinancialBudgetSchema(); await ensureFinancialContractSchema(); await ensureFinancialContractSchema();
check("additive idempotent migration", "Build 3 schema ensured twice");
const tables = (await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'financial_contract%' ORDER BY table_name`)).rows;
assert.equal(tables.length, 9); check("nine approved table families", "database inventory exact");
const noDrops = (await pool.query(`SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public'`)).rows[0].n; assert.ok(noDrops >= 25); check("existing schema preserved", "additive prerequisite and Build 1/2 tables remain");

await pool.query(`INSERT INTO company_cost_library_versions(id,library_id,company_id,version,effective_date,status,reason,content_fingerprint,created_by_id) VALUES('lv','lib',$1,1,current_date,'approved','Disposable library','lfp',$2)`, [companyId, userId]);
await pool.query(`INSERT INTO company_cost_nodes(id,library_version_id,stable_node_id,hierarchical_path,company_code,name,sort_order,effective_from) VALUES('cn','lv','cn-stable','01','01','General',0,current_date)`);
await pool.query(`INSERT INTO project_cost_structure_versions(id,structure_id,project_id,company_id,library_version_id,version,status,reason,validation_fingerprint,content_fingerprint,created_by_id) VALUES('sv','structure',$1,$2,'lv',1,'approved','Disposable structure','vfp','sfp',$3)`, [projectId, companyId, userId]);
await pool.query(`INSERT INTO project_cost_nodes(id,structure_version_id,stable_project_node_id,company_stable_node_id,company_library_version_id,project_code,project_name,active,sort_order,effective_from,mapping_provenance) VALUES('pn1','sv','pn-stable','cn-stable','lv','01','General',true,0,current_date,'disposable'),('pn2','sv','pn-stable-2','cn-stable','lv','02','Other',true,1,current_date,'disposable')`);
await pool.query(`INSERT INTO project_budget_versions(id,budget_id,project_id,company_id,structure_version_id,version,currency,status,purpose,prepared_by_id,content_fingerprint,calculated_total) VALUES('bv','budget',$1,$2,'sv',1,'USD','approved','Disposable budget',$3,'bfp',100.000001)`, [projectId, companyId, userId]);
await pool.query(`INSERT INTO approved_budget_snapshots(id,budget_version_id,budget_id,budget_version,project_id,company_id,structure_version_id,currency,total,original_total,current_total,difference_from_original,approved_by_id,approved_at,approval_policy_id,approval_limit,content_fingerprint,snapshot_fingerprint) VALUES('snap','bv','budget',1,$1,$2,'sv','USD',100.000001,100.000001,100.000001,0,$3,now(),'policy',1000,'bfp','snap-fp')`, [projectId, companyId, userId]);
await pool.query(`INSERT INTO approved_budget_snapshot_lines(id,snapshot_id,stable_line_id,project_cost_node_id,project_code,project_name,hierarchical_path,description,amount,sort_order) VALUES('sl1','snap','line','pn1','01','General','01','Exact allocation',100.000001,0)`);

await pool.query(`INSERT INTO financial_contracts(id,bimlog_id,company_id,project_id,perspective,contract_type,legal_number,counterparty_name,created_by_id) VALUES('contract','BIMLOG-CON-contract',$1,$2,'downstream','subcontract','SC-001','Disposable Trade',$3)`, [companyId, projectId, userId]);
await pool.query(`INSERT INTO financial_contract_versions(id,contract_id,version,status,title,currency,original_value,budget_snapshot_id,structure_version_id,signed_file_id,prepared_by_id,content_fingerprint) VALUES('cv','contract',1,'draft','Exact contract','USD',100.000001,'snap','sv',$1,$2,'cfp')`, [fileId, userId]);
await pool.query(`INSERT INTO financial_contract_sov_lines(id,contract_version_id,stable_line_id,budget_snapshot_line_id,project_cost_node_id,schedule_item_placement_id,description,amount,sort_order) VALUES('sov','cv','SOV-1','sl1','pn1',$1,'Exact SOV',100.000001,0)`, [scheduleId]);
assert.equal((await pool.query(`SELECT original_value::text value FROM financial_contract_versions WHERE id='cv'`)).rows[0].value, "100.000001"); check("exact decimal persisted", "numeric(30,6) retained sixth decimal");
assert.equal((await pool.query(`SELECT schedule_item_placement_id FROM financial_contract_sov_lines WHERE id='sov'`)).rows[0].schedule_item_placement_id, scheduleId); check("Schedule link pinned", "same-project foreign key and trigger");
await assert.rejects(pool.query(`INSERT INTO financial_contract_sov_lines(id,contract_version_id,stable_line_id,budget_snapshot_line_id,project_cost_node_id,description,amount,sort_order) VALUES('bad-node','cv','BAD','sl1','pn2','Mismatch',1,1)`), /pinned budget snapshot and structure/i); check("mismatched budget mapping rejected", "database scope trigger");
await assert.rejects(pool.query(`INSERT INTO financial_contract_sov_lines(id,contract_version_id,stable_line_id,budget_snapshot_line_id,project_cost_node_id,schedule_item_placement_id,description,amount,sort_order) VALUES('bad-schedule','cv','BAD2','sl1','pn1',$1,'Mismatch',1,2)`, [otherScheduleId]), /outside the financial project/i); check("cross-project Schedule link rejected", "database tenancy trigger");
await pool.query(`INSERT INTO financial_contract_record_grants(id,contract_id,user_id,permission,version,state,reason,granted_by_id) VALUES('grant','contract',$1,'view',1,'active','Disposable access',$1)`, [userId]);
await assert.rejects(pool.query(`UPDATE financial_contract_record_grants SET state='revoked' WHERE id='grant'`), /append-only/i); check("record grants append-only", "revocation requires new version");
await pool.query(`INSERT INTO financial_contract_history(id,company_id,project_id,contract_id,contract_version_id,actor_user_id,event_type,reason_code,evidence) VALUES('history',$1,$2,'contract','cv',$3,'created','TEST','{}')`, [companyId, projectId, userId]);
await assert.rejects(pool.query(`DELETE FROM financial_contract_history WHERE id='history'`), /append-only/i); check("contract history append-only", "delete rejected");
await assert.rejects(pool.query(`UPDATE financial_contracts SET legal_number='REWRITE' WHERE id='contract'`), /append-only/i); check("legal root immutable", "legal number cannot be rewritten");
await pool.query(`UPDATE financial_contract_versions SET status='executed',executed_by_id=$1,executed_at=now(),revision=2 WHERE id='cv'`, [userId]);
await assert.rejects(pool.query(`UPDATE financial_contract_versions SET original_value=1 WHERE id='cv'`), /immutable/i); await assert.rejects(pool.query(`DELETE FROM financial_contract_versions WHERE id='cv'`), /immutable/i); check("executed contract version immutable", "update and delete rejected");

await pool.query(`INSERT INTO financial_contract_amendments(id,contract_id,bimlog_id,legal_number,created_by_id) VALUES('amd','contract','BIMLOG-AMD-amd','A-001',$1)`, [userId]);
await pool.query(`INSERT INTO financial_contract_amendment_versions(id,amendment_id,contract_version_id,version,status,title,currency,amount_delta,budget_snapshot_id,structure_version_id,signed_file_id,prepared_by_id,content_fingerprint) VALUES('av','amd','cv',1,'draft','Credit','USD',-0.000001,'snap','sv',$1,$2,'afp')`, [fileId, userId]);
await pool.query(`INSERT INTO financial_contract_amendment_lines(id,amendment_version_id,stable_line_id,budget_snapshot_line_id,project_cost_node_id,description,amount_delta,sort_order) VALUES('al','av','A-SOV','sl1','pn1','Exact credit',-0.000001,0)`);
assert.equal((await pool.query(`SELECT amount_delta::text value FROM financial_contract_amendment_versions WHERE id='av'`)).rows[0].value, "-0.000001"); check("signed amendment exact", "negative sixth-decimal delta retained");
await pool.query(`UPDATE financial_contract_amendment_versions SET status='executed',executed_by_id=$1,executed_at=now(),revision=2 WHERE id='av'`, [userId]);
await assert.rejects(pool.query(`UPDATE financial_contract_amendment_versions SET amount_delta=0 WHERE id='av'`), /immutable/i); check("executed amendment immutable", "financial delta rewrite rejected");
await assert.rejects(pool.query(`DELETE FROM financial_contract_amendment_lines WHERE id='al'`), /immutable/i); check("executed amendment lines immutable", "line delete rejected");

const rollback = await pool.connect();
try { await rollback.query("BEGIN"); await rollback.query(`INSERT INTO financial_contracts(id,bimlog_id,company_id,project_id,perspective,contract_type,legal_number,counterparty_name,created_by_id) VALUES('rollback','BIMLOG-CON-rollback',$1,$2,'downstream','purchase_order','PO-ROLLBACK','Rollback Trade',$3)`, [companyId, projectId, userId]); await assert.rejects(rollback.query(`INSERT INTO financial_contract_versions(id,contract_id,version,status,title,currency,original_value,budget_snapshot_id,structure_version_id,prepared_by_id,content_fingerprint) VALUES('rollback-v','rollback',1,'draft','Bad pin','USD',1,'missing','sv',$1,'bad')`, [userId]), /foreign key|not present/i); await rollback.query("ROLLBACK"); } finally { rollback.release(); }
assert.equal((await pool.query(`SELECT count(*)::int n FROM financial_contracts WHERE id='rollback'`)).rows[0].n, 0); check("failed operation rolls back", "no partial legal root");
const triggers = Number((await pool.query(`SELECT count(*)::int n FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 'financial_%'`)).rows[0].n); assert.ok(triggers >= 12); check("database defenses installed", "Build 1-3 financial triggers present");
assert.equal(checks.length, 16);
console.log(JSON.stringify({ suite: "cost-financial-control-build-3-postgresql", status: "passed", checks }, null, 2));
await pool.end();
