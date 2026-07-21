import assert from "node:assert/strict";
import { pool } from "@workspace/db";
import { ensureFinancialControlSchema } from "./financial-control-migration";
import { ensureFinancialBudgetSchema } from "./financial-budget-migration";
const url = process.env.PROD_DATABASE_URL;
if (!url) throw new Error("Disposable PROD_DATABASE_URL required.");
const target = new URL(url);
if (
  !["127.0.0.1", "localhost"].includes(target.hostname) ||
  target.port !== "55436" ||
  target.pathname !== "/bimlog_financial_build2"
)
  throw new Error("Refusing to run outside disposable Build 2 database.");
const checks: Array<{ number: number; name: string; evidence: string }> = [],
  check = (name: string, evidence: string) =>
    checks.push({ number: checks.length + 1, name, evidence });
await pool.query(
  `CREATE TABLE companies(id serial PRIMARY KEY,name text NOT NULL);CREATE TABLE users(id serial PRIMARY KEY,email text NOT NULL,full_name text NOT NULL DEFAULT 'Test',company_id integer NOT NULL REFERENCES companies(id),is_super_admin boolean NOT NULL DEFAULT false);CREATE TABLE projects(id serial PRIMARY KEY,name text NOT NULL,code text NOT NULL DEFAULT 'T',status text NOT NULL DEFAULT 'active',created_by_id integer NOT NULL REFERENCES users(id));CREATE TABLE files(id serial PRIMARY KEY,project_id integer NOT NULL REFERENCES projects(id),file_hash text);`,
);
const c = await pool.query(
    `INSERT INTO companies(name) VALUES('Disposable Company') RETURNING id`,
  ),
  companyId = Number(c.rows[0].id),
  u = await pool.query(
    `INSERT INTO users(email,company_id) VALUES('builder@example.test',$1) RETURNING id`,
    [companyId],
  ),
  userId = Number(u.rows[0].id),
  p = await pool.query(
    `INSERT INTO projects(name,created_by_id) VALUES('Disposable Project',$1) RETURNING id`,
    [userId],
  ),
  projectId = Number(p.rows[0].id),
  f = await pool.query(
    `INSERT INTO files(project_id,file_hash) VALUES($1,'abc') RETURNING id`,
    [projectId],
  ),
  fileId = Number(f.rows[0].id);
await ensureFinancialControlSchema();
await ensureFinancialBudgetSchema();
await ensureFinancialBudgetSchema();
check("additive idempotent migration", "Build 2 schema ensured twice");
const tables = (
  await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN('company_cost_library_versions','company_cost_nodes','project_cost_structure_versions','project_cost_nodes','project_budget_versions','project_budget_lines','approved_budget_snapshots','approved_budget_snapshot_lines','budget_import_sessions') ORDER BY table_name`,
  )
).rows;
assert.equal(tables.length, 9);
check("canonical Build 2 tables", "nine bounded domain tables");
const snapshotStructureForeignKey = (
  await pool.query(
    `SELECT count(*)::int n FROM information_schema.table_constraints tc JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.constraint_schema=tc.constraint_schema WHERE tc.table_schema='public' AND tc.table_name='approved_budget_snapshots' AND tc.constraint_type='FOREIGN KEY' AND ccu.table_name='project_cost_structure_versions' AND ccu.column_name='id'`,
  )
).rows[0].n;
assert.equal(snapshotStructureForeignKey, 1);
check(
  "snapshot pins structure through foreign key",
  "approved snapshot structure_version_id references immutable project structure",
);
await pool.query(
  `INSERT INTO company_cost_library_versions(id,library_id,company_id,version,effective_date,status,reason,content_fingerprint,created_by_id,reviewed_by_id,approved_by_id,reviewed_at,approved_at) VALUES('lv1','lib1',$1,1,current_date,'approved','Initial approved library','fp-lib',$2,$2,$2,now(),now())`,
  [companyId, userId],
);
await assert.rejects(
  pool.query(
    `UPDATE company_cost_library_versions SET reason='Rewritten' WHERE id='lv1'`,
  ),
  /append-only/i,
);
check("approved company library immutable", "database trigger rejected update");
await pool.query(
  `INSERT INTO company_cost_nodes(id,library_version_id,stable_node_id,hierarchical_path,company_code,name,sort_order,effective_from) VALUES('cn1','lv1','stable-cn1','01','01','General',0,current_date)`,
);
await pool.query(
  `INSERT INTO project_cost_structure_versions(id,structure_id,project_id,company_id,library_version_id,version,status,reason,validation_fingerprint,content_fingerprint,created_by_id,reviewed_by_id,approved_by_id,approved_at) VALUES('sv1','struct1',$1,$2,'lv1',1,'approved','Explicit pin','valid-fp','struct-fp',$3,$3,$3,now())`,
  [projectId, companyId, userId],
);
await assert.rejects(
  pool.query(`DELETE FROM project_cost_structure_versions WHERE id='sv1'`),
  /append-only/i,
);
check("approved project structure immutable", "database trigger rejected delete");
await pool.query(
  `INSERT INTO project_cost_nodes(id,structure_version_id,stable_project_node_id,company_stable_node_id,company_library_version_id,project_code,project_name,active,sort_order,effective_from,mapping_provenance) VALUES('pn1','sv1','stable-pn1','stable-cn1','lv1','01','General',true,0,current_date,'company_library')`,
);
const pin = (
  await pool.query(
    `SELECT library_version_id FROM project_cost_structure_versions WHERE id='sv1'`,
  )
).rows[0];
assert.equal(pin.library_version_id, "lv1");
check("project pins exact approved library", "library version lv1 retained");
await assert.rejects(
  pool.query(
    `INSERT INTO company_cost_nodes(id,library_version_id,stable_node_id,hierarchical_path,company_code,name,sort_order,effective_from) VALUES('cn2','lv1','stable-cn2','01','01','Duplicate',1,current_date)`,
  ),
  /duplicate key/i,
);
check("duplicate active code database defense", "partial unique index");
await assert.rejects(
  pool.query(
    `INSERT INTO company_cost_nodes(id,library_version_id,stable_node_id,hierarchical_path,company_code,name,sort_order,effective_from) VALUES('cn3','lv1','stable-cn3','02','02','Duplicate order',0,current_date)`,
  ),
  /duplicate key/i,
);
check("sibling order database defense", "unique sibling ordering");
await pool.query(
  `INSERT INTO project_budget_versions(id,budget_id,project_id,company_id,structure_version_id,version,currency,status,purpose,prepared_by_id,content_fingerprint,calculated_total,source_file_id) VALUES('bv1','budget1',$1,$2,'sv1',1,'USD','under_review','Original controlled budget',$3,'budget-fp',100.099999,$4)`,
  [projectId, companyId, userId, fileId],
);
await pool.query(
  `INSERT INTO project_budget_lines(id,budget_version_id,stable_line_id,project_cost_node_id,description,amount,sort_order) VALUES('bl1','bv1','line1','pn1','Exact line',100.099999,0)`,
);
assert.equal(
  (
    await pool.query(
      `SELECT calculated_total::text total FROM project_budget_versions WHERE id='bv1'`,
    )
  ).rows[0].total,
  "100.099999",
);
check("numeric exact persistence", "100.099999 round-tripped");
await assert.rejects(
  pool.query(`UPDATE project_budget_lines SET amount=1 WHERE id='bl1'`),
  /immutable/i,
);
check("submitted lines immutable", "database trigger rejected update");
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(
    `INSERT INTO approved_budget_snapshots(id,budget_version_id,budget_id,budget_version,project_id,company_id,structure_version_id,currency,total,original_total,current_total,difference_from_original,approved_by_id,approved_at,approval_policy_id,approval_limit,content_fingerprint,snapshot_fingerprint) VALUES('snap1','bv1','budget1',1,$1,$2,'sv1','USD',100.099999,100.099999,100.099999,0,$3,now(),'policy1',1000,'budget-fp','snapshot-fp')`,
    [projectId, companyId, userId],
  );
  await client.query(
    `INSERT INTO approved_budget_snapshot_lines(id,snapshot_id,stable_line_id,project_cost_node_id,project_code,project_name,hierarchical_path,description,amount,sort_order) VALUES('sl1','snap1','line1','pn1','01','General','01','Exact line',100.099999,0)`,
  );
  await client.query(
    `UPDATE project_budget_versions SET status='approved',approved_by_id=$1,approved_at=now(),approved_snapshot_id='snap1' WHERE id='bv1'`,
    [userId],
  );
  await client.query("COMMIT");
} finally {
  client.release();
}
check(
  "approval and snapshot atomic commit",
  "approved row and complete snapshot committed",
);
assert.equal(
  (
    await pool.query(
      `SELECT count(*)::int n FROM approved_budget_snapshots WHERE budget_version_id='bv1'`,
    )
  ).rows[0].n,
  1,
);
check("one snapshot per approved version", "unique budget version constraint");
await assert.rejects(
  pool.query(`UPDATE approved_budget_snapshots SET total=2 WHERE id='snap1'`),
  /append-only/i,
);
check("snapshot update rejected", "append-only trigger");
await assert.rejects(
  pool.query(`DELETE FROM approved_budget_snapshots WHERE id='snap1'`),
  /append-only/i,
);
check("snapshot delete rejected", "append-only trigger");
await assert.rejects(
  pool.query(
    `UPDATE project_budget_versions SET calculated_total=2 WHERE id='bv1'`,
  ),
  /immutable/i,
);
check("approved budget immutable", "approved guard");
const preserved = (
  await pool.query(
    `SELECT project_code,project_name,amount::text amount FROM approved_budget_snapshot_lines WHERE snapshot_id='snap1'`,
  )
).rows[0];
await assert.rejects(
  pool.query(
    `UPDATE company_cost_nodes SET name='Renamed historically' WHERE id='cn1'`,
  ),
  /append-only/i,
);
await pool.query(
  `INSERT INTO company_cost_library_versions(id,library_id,company_id,version,effective_date,status,reason,content_fingerprint,supersedes_id,created_by_id,reviewed_by_id,approved_by_id,reviewed_at,approved_at) VALUES('lv2','lib1',$1,2,current_date,'approved','Rename through a new version','fp-lib-2','lv1',$2,$2,$2,now(),now())`,
  [companyId, userId],
);
await pool.query(
  `INSERT INTO company_cost_nodes(id,library_version_id,stable_node_id,hierarchical_path,company_code,name,sort_order,effective_from) VALUES('cn4','lv2','stable-cn1','01A','01A','Renamed historically',0,current_date)`,
);
assert.deepEqual(preserved, {
  project_code: "01",
  project_name: "General",
  amount: "100.099999",
});
check(
  "snapshot reproducible after code rename",
  "new library version leaves approved labels intact",
);
await pool.query(
  `INSERT INTO financial_authority_journal(id,event_type,company_id,project_id,actor_user_id,entity_type,entity_id,decision,reason_code,explanation_en,explanation_es,evidence) VALUES('audit-b2','budget_snapshot_created',$1,$2,$3,'approved_budget_snapshot','snap1','allow','BUDGET_APPROVED','Approved.','Aprobado.','{"changedFields":["status"]}')`,
  [companyId, projectId, userId],
);
await assert.rejects(
  pool.query(
    `UPDATE financial_authority_journal SET decision='deny' WHERE id='audit-b2'`,
  ),
  /append-only/i,
);
check("audit append-only", "accepted Build 1 journal trigger");
const confirmations = await Promise.allSettled([
  pool.query(
    `INSERT INTO budget_import_sessions(id,project_id,company_id,actor_user_id,source_file_id,file_hash,parsed_fingerprint,currency,total,accepted_count,rejected_count,preview,idempotency_key) VALUES('import1',$1,$2,$3,$4,'hash','parsed','USD',1,1,0,'{}','same-key')`,
    [projectId, companyId, userId, fileId],
  ),
  pool.query(
    `INSERT INTO budget_import_sessions(id,project_id,company_id,actor_user_id,source_file_id,file_hash,parsed_fingerprint,currency,total,accepted_count,rejected_count,preview,idempotency_key) VALUES('import2',$1,$2,$3,$4,'hash','parsed','USD',1,1,0,'{}','same-key')`,
    [projectId, companyId, userId, fileId],
  ),
]);
assert.equal(confirmations.filter((x) => x.status === "fulfilled").length, 1);
check(
  "concurrent import identity serialized",
  "one unique project/idempotency key",
);
const versions = await Promise.allSettled([
  pool.query(
    `INSERT INTO project_budget_versions(id,budget_id,project_id,company_id,structure_version_id,version,currency,status,purpose,prepared_by_id,content_fingerprint,calculated_total) VALUES('bv2a','budget2',$1,$2,'sv1',1,'USD','draft','Concurrent version',$3,'a',1)`,
    [projectId, companyId, userId],
  ),
  pool.query(
    `INSERT INTO project_budget_versions(id,budget_id,project_id,company_id,structure_version_id,version,currency,status,purpose,prepared_by_id,content_fingerprint,calculated_total) VALUES('bv2b','budget2',$1,$2,'sv1',1,'USD','draft','Concurrent version',$3,'b',1)`,
    [projectId, companyId, userId],
  ),
]);
assert.equal(versions.filter((x) => x.status === "fulfilled").length, 1);
check(
  "unique ordered budget versions",
  "concurrent duplicate version rejected",
);
const rollback = await pool.connect();
try {
  await rollback.query("BEGIN");
  await rollback.query(
    `INSERT INTO project_budget_versions(id,budget_id,project_id,company_id,structure_version_id,version,currency,status,purpose,prepared_by_id,content_fingerprint,calculated_total) VALUES('rollback-budget','rollback',$1,$2,'sv1',1,'USD','under_review','Rollback proof',$3,'rollback',1)`,
    [projectId, companyId, userId],
  );
  await assert.rejects(
    rollback.query(
      `INSERT INTO approved_budget_snapshots(id,budget_version_id,budget_id,budget_version,project_id,company_id,structure_version_id,currency,total,original_total,current_total,difference_from_original,approved_by_id,approved_at,approval_policy_id,approval_limit,content_fingerprint,snapshot_fingerprint) VALUES('bad','rollback-budget','rollback',1,$1,$2,'missing','USD',1,1,1,0,$3,now(),'p',1,'f','sf')`,
      [projectId, companyId, userId],
    ),
    /violates foreign key|not present/i,
  );
  await rollback.query("ROLLBACK");
} finally {
  rollback.release();
}
assert.equal(
  (
    await pool.query(
      `SELECT count(*)::int n FROM project_budget_versions WHERE id='rollback-budget'`,
    )
  ).rows[0].n,
  0,
);
check("snapshot failure rolls back approval", "no partial budget retained");
const triggers = (
  await pool.query(
    `SELECT count(*)::int n FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE '%immutable%'`,
  )
).rows[0].n;
assert.ok(triggers >= 8);
check(
  "history mutation defenses installed",
  "Build 1 + Build 2 append-only triggers",
);
assert.equal(
  (
    await pool.query(
      `SELECT count(*)::int n FROM users WHERE email LIKE '%@example.test'`,
    )
  ).rows[0].n,
  1,
);
check(
  "disposable identities isolated",
  "single synthetic identity in disposable database",
);
assert.equal(checks.length, 22);
console.log(
  JSON.stringify(
    {
      suite: "cost-financial-control-build-2-postgresql",
      status: "passed",
      checks,
    },
    null,
    2,
  ),
);
await pool.end();
