import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { ensureFinancialControlSchema } from "./financial-control-migration";
import { prepareGenericApuPersistenceHarness } from "./generic-apu-persistence-db-harness";
import { ensureGenericApuPersistenceSchema } from "./generic-apu-persistence-migration";

const url = process.env.PROD_DATABASE_URL;
if (!url) throw new Error("Disposable PROD_DATABASE_URL required.");
prepareGenericApuPersistenceHarness(process.env);
const target = new URL(url);
if (
  !["127.0.0.1", "localhost"].includes(target.hostname) ||
  target.port !== "55436" ||
  target.pathname !== "/bimlog_financial_build2"
) {
  throw new Error("Refusing to run outside disposable Build 2 database.");
}

const suffix = randomUUID();
const checks: Array<{ number: number; name: string; evidence: string }> = [];
const check = (name: string, evidence: string) =>
  checks.push({ number: checks.length + 1, name, evidence });

await pool.query(`
CREATE TABLE IF NOT EXISTS companies(id serial PRIMARY KEY,name text NOT NULL);
CREATE TABLE IF NOT EXISTS users(id serial PRIMARY KEY,email text NOT NULL,full_name text NOT NULL DEFAULT 'Test',company_id integer NOT NULL REFERENCES companies(id),is_super_admin boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS projects(id serial PRIMARY KEY,name text NOT NULL,code text NOT NULL DEFAULT 'T',status text NOT NULL DEFAULT 'active',created_by_id integer NOT NULL REFERENCES users(id));
`);

const companyId = Number(
  (
    await pool.query(`INSERT INTO companies(name) VALUES($1) RETURNING id`, [
      `Generic APU ${suffix}`,
    ])
  ).rows[0].id,
);
const secondCompanyId = Number(
  (
    await pool.query(`INSERT INTO companies(name) VALUES($1) RETURNING id`, [
      `Generic APU other ${suffix}`,
    ])
  ).rows[0].id,
);
const makerId = Number(
  (
    await pool.query(
      `INSERT INTO users(email,company_id) VALUES($1,$2) RETURNING id`,
      [`maker-${suffix}@example.test`, companyId],
    )
  ).rows[0].id,
);
const checkerId = Number(
  (
    await pool.query(
      `INSERT INTO users(email,company_id) VALUES($1,$2) RETURNING id`,
      [`checker-${suffix}@example.test`, companyId],
    )
  ).rows[0].id,
);
const ungrantedId = Number(
  (
    await pool.query(
      `INSERT INTO users(email,company_id) VALUES($1,$2) RETURNING id`,
      [`ungranted-${suffix}@example.test`, companyId],
    )
  ).rows[0].id,
);
const projectId = Number(
  (
    await pool.query(
      `INSERT INTO projects(name,created_by_id) VALUES($1,$2) RETURNING id`,
      [`Generic APU ${suffix}`, makerId],
    )
  ).rows[0].id,
);

await ensureFinancialControlSchema();
await ensureGenericApuPersistenceSchema();
await ensureGenericApuPersistenceSchema();
check(
  "additive idempotent migration",
  "Generic APU persistence schema ensured twice",
);

const tables = (
  await pool.query(`SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN(
      'generic_apu_template_versions','generic_apu_template_nodes',
      'generic_project_apu_versions','generic_project_apu_lines',
      'generic_apu_commitment_versions','generic_apu_overrun_approvals'
    ) ORDER BY table_name`)
).rows;
assert.equal(tables.length, 6);
check(
  "bounded Generic APU tables",
  "six additive persistence tables are present",
);

const templateId = `template:${suffix}`;
const templateVersionId = `template-version:${suffix}`;
const templateFingerprint = `template-fingerprint:${suffix}`;
await pool.query(
  `INSERT INTO generic_apu_template_versions(
    id,template_id,company_id,version,name,industry,status,currency,reason,
    content_fingerprint,created_by_id,published_by_id,published_at
  ) VALUES($1,$2,$3,1,'Discipline neutral','generic','published','USD',
    'Synthetic disposable proof',$4,$5,$6,now())`,
  [
    templateVersionId,
    templateId,
    companyId,
    templateFingerprint,
    makerId,
    checkerId,
  ],
);
check(
  "published template maker-checker",
  "creator and publisher identities are distinct",
);

await assert.rejects(
  pool.query(
    `INSERT INTO generic_apu_template_versions(
      id,template_id,company_id,version,name,industry,status,currency,reason,
      content_fingerprint,created_by_id,published_by_id,published_at
    ) VALUES($1,$2,$3,1,'Invalid','generic','published','USD','Invalid self approval',$4,$5,$5,now())`,
    [
      `self-template-version:${suffix}`,
      `self-template:${suffix}`,
      companyId,
      `self-template-fingerprint:${suffix}`,
      makerId,
    ],
  ),
  /maker_checker|check constraint/i,
);
check(
  "template self-publication rejected",
  "database maker-checker constraint",
);

const nodeId = `node:${suffix}`;
await pool.query(
  `INSERT INTO generic_apu_template_nodes(
    id,template_version_id,stable_node_id,method,label,category,unit_cost,currency,
    sort_order,content_fingerprint
  ) VALUES($1,$2,'root','fixed_amount','Root','generic',100.123456,'USD',0,$3)`,
  [nodeId, templateVersionId, `node-fingerprint:${suffix}`],
);
assert.equal(
  (
    await pool.query(
      `SELECT unit_cost::text value FROM generic_apu_template_nodes WHERE id=$1`,
      [nodeId],
    )
  ).rows[0].value,
  "100.123456",
);
check(
  "exact template amount persistence",
  "numeric(30,6) round-tripped 100.123456",
);

await assert.rejects(
  pool.query(
    `INSERT INTO generic_apu_template_nodes(
      id,template_version_id,stable_node_id,method,label,category,quantity,currency,
      sort_order,content_fingerprint
    ) VALUES($1,$2,'invalid','quantity_unit_cost','Invalid','generic',1,'USD',1,$3)`,
    [
      `invalid-node:${suffix}`,
      templateVersionId,
      `invalid-node-fingerprint:${suffix}`,
    ],
  ),
  /generic_apu_node_operands_chk|check constraint/i,
);
check(
  "method operands fail closed",
  "incomplete quantity/unit-cost node rejected",
);

await assert.rejects(
  pool.query(
    `INSERT INTO generic_project_apu_versions(
      id,project_apu_id,project_id,company_id,template_version_id,version,status,
      currency,template_fingerprint,content_fingerprint,idempotency_key,
      request_fingerprint,applied_by_id,applied_at
    ) VALUES($1,$2,$3,$4,$5,1,'locked','USD',$6,$7,$8,$9,$10,now())`,
    [
      `cross-tenant-application:${suffix}`,
      `cross-tenant-apu:${suffix}`,
      projectId,
      secondCompanyId,
      templateVersionId,
      templateFingerprint,
      `cross-content:${suffix}`,
      `cross-key:${suffix}`,
      `cross-request:${suffix}`,
      makerId,
    ],
  ),
  /template scope mismatch/i,
);
check("cross-tenant application rejected", "database scope trigger");

const projectApuVersionId = `project-apu-version:${suffix}`;
await pool.query(
  `INSERT INTO generic_project_apu_versions(
    id,project_apu_id,project_id,company_id,template_version_id,version,status,
    currency,template_fingerprint,content_fingerprint,idempotency_key,
    request_fingerprint,applied_by_id,applied_at,locked_at
  ) VALUES($1,$2,$3,$4,$5,1,'locked','USD',$6,$7,$8,$9,$10,now(),now())`,
  [
    projectApuVersionId,
    `project-apu:${suffix}`,
    projectId,
    companyId,
    templateVersionId,
    templateFingerprint,
    `application-content:${suffix}`,
    `application-key:${suffix}`,
    `application-request:${suffix}`,
    makerId,
  ],
);
check(
  "exact published template pinned",
  "application retains template version and fingerprint",
);

await assert.rejects(
  pool.query(
    `INSERT INTO generic_project_apu_versions(
      id,project_apu_id,project_id,company_id,template_version_id,version,status,
      currency,template_fingerprint,content_fingerprint,idempotency_key,
      request_fingerprint,applied_by_id,applied_at
    ) VALUES($1,$2,$3,$4,$5,1,'locked','USD',$6,$7,$8,$9,$10,now())`,
    [
      `idempotency-conflict:${suffix}`,
      `other-project-apu:${suffix}`,
      projectId,
      companyId,
      templateVersionId,
      templateFingerprint,
      `other-application-content:${suffix}`,
      `application-key:${suffix}`,
      `changed-request:${suffix}`,
      makerId,
    ],
  ),
  /duplicate key/i,
);
check(
  "application idempotency conflict",
  "same project/key cannot create changed resource",
);

const projectLineId = `project-line:${suffix}`;
await pool.query(
  `INSERT INTO generic_project_apu_lines(
    id,project_apu_version_id,template_node_id,stable_line_id,method,raw_inputs,
    raw_amount,rounded_amount,currency,sort_order,content_fingerprint
  ) VALUES($1,$2,$3,'root','fixed_amount',$4::jsonb,'100.123456',100.12,'USD',0,$5)`,
  [
    projectLineId,
    projectApuVersionId,
    nodeId,
    JSON.stringify({ amount: "100.123456", currency: "USD" }),
    `line-content:${suffix}`,
  ],
);
const persistedLine = (
  await pool.query(
    `SELECT raw_amount,rounded_amount::text rounded_amount FROM generic_project_apu_lines WHERE id=$1`,
    [projectLineId],
  )
).rows[0];
assert.deepEqual(persistedLine, {
  raw_amount: "100.123456",
  rounded_amount: "100.12",
});
check(
  "raw and rounded amounts preserved",
  "canonical raw text and explicit rounded numeric are distinct",
);

const formulaNodeId = `formula-node:${suffix}`;
await pool.query(
  `INSERT INTO generic_apu_template_nodes(
    id,template_version_id,stable_node_id,method,label,category,formula,currency,
    sort_order,content_fingerprint
  ) VALUES($1,$2,'formula-total','formula','Formula total','generic','root * 0.10','USD',1,$3)`,
  [formulaNodeId, templateVersionId, `formula-node-fingerprint:${suffix}`],
);
await pool.query(
  `INSERT INTO generic_project_apu_lines(
    id,project_apu_version_id,template_node_id,stable_line_id,method,raw_inputs,
    raw_amount,rounded_amount,currency,sort_order,content_fingerprint
  ) VALUES($1,$2,$3,'formula-total','formula',$4::jsonb,'10.0123456',10.01,'USD',1,$5)`,
  [
    `formula-line:${suffix}`,
    projectApuVersionId,
    formulaNodeId,
    JSON.stringify({ expression: "root * 0.10", dependencies: ["root"] }),
    `formula-line-content:${suffix}`,
  ],
);
check(
  "formula result persistence",
  "domain-supported formula line retained canonical inputs and explicit rounded result",
);

await pool.query(
  `INSERT INTO financial_authority_grants(
    id,user_id,company_id,project_id,scope_type,authority,version,effective_from,
    reason,granted_by_id
  ) VALUES($1,$2,$3,$4,'project','cost_approver',1,now()-interval '1 day',
    'Disposable Generic APU approval grant',$5)`,
  [`grant:${suffix}`, checkerId, companyId, projectId, makerId],
);
check(
  "service-issued Finance grant persisted",
  "effective project cost-approver grant exists",
);

await assert.rejects(
  pool.query(
    `INSERT INTO generic_apu_commitment_versions(
      id,commitment_id,version,project_apu_version_id,project_apu_line_id,company_id,
      project_id,assignment_ref,amount,currency,state,idempotency_key,
      request_fingerprint,content_fingerprint,created_by_id,approved_by_id,approved_at
    ) VALUES($1,$2,1,$3,$4,$5,$6,'assignment',10,'USD','overrun',$7,$8,$9,$10,$11,now())`,
    [
      `ungranted-commitment:${suffix}`,
      `ungranted-commitment-chain:${suffix}`,
      projectApuVersionId,
      projectLineId,
      companyId,
      projectId,
      `ungranted-commitment-key:${suffix}`,
      `ungranted-commitment-request:${suffix}`,
      `ungranted-commitment-content:${suffix}`,
      makerId,
      ungrantedId,
    ],
  ),
  /effective Finance grant/i,
);
check(
  "caller-trusted commitment approval rejected",
  "ungranted approver cannot create approved overrun state",
);

await pool.query(
  `INSERT INTO financial_authority_grants(
    id,user_id,company_id,project_id,scope_type,authority,version,effective_from,
    reason,granted_by_id
  ) VALUES($1,$2,$3,$4,'project','financial_administrator',1,now()-interval '1 day',
    'Disposable Generic APU administrative grant',$5)`,
  [`admin-grant:${suffix}`, ungrantedId, companyId, projectId, makerId],
);
await assert.rejects(
  pool.query(
    `INSERT INTO generic_apu_commitment_versions(
      id,commitment_id,version,project_apu_version_id,project_apu_line_id,company_id,
      project_id,assignment_ref,amount,currency,state,idempotency_key,
      request_fingerprint,content_fingerprint,created_by_id,approved_by_id,approved_at
    ) VALUES($1,$2,1,$3,$4,$5,$6,'assignment',10,'USD','overrun',$7,$8,$9,$10,$11,now())`,
    [
      `admin-commitment:${suffix}`,
      `admin-commitment-chain:${suffix}`,
      projectApuVersionId,
      projectLineId,
      companyId,
      projectId,
      `admin-commitment-key:${suffix}`,
      `admin-commitment-request:${suffix}`,
      `admin-commitment-content:${suffix}`,
      makerId,
      ungrantedId,
    ],
  ),
  /effective Finance grant/i,
);
check(
  "financial administrator cannot approve",
  "administrative authority does not inherit cost approval",
);

await assert.rejects(
  pool.query(
    `INSERT INTO generic_apu_commitment_versions(
      id,commitment_id,version,project_apu_version_id,project_apu_line_id,company_id,
      project_id,assignment_ref,amount,currency,state,idempotency_key,
      request_fingerprint,content_fingerprint,created_by_id,approved_by_id,approved_at
    ) VALUES($1,$2,1,$3,$4,$5,$6,'assignment',10,'USD','overrun',$7,$8,$9,$10,$11,'2999-01-01T00:00:00.000Z')`,
    [
      `future-commitment:${suffix}`,
      `future-commitment-chain:${suffix}`,
      projectApuVersionId,
      projectLineId,
      companyId,
      projectId,
      `future-commitment-key:${suffix}`,
      `future-commitment-request:${suffix}`,
      `future-commitment-content:${suffix}`,
      makerId,
      checkerId,
    ],
  ),
  /future-dated/i,
);
check(
  "future commitment approval rejected",
  "caller timestamp cannot manufacture future approval authority",
);

const commitmentVersionId = `commitment-version:${suffix}`;
await pool.query(
  `INSERT INTO generic_apu_commitment_versions(
    id,commitment_id,version,project_apu_version_id,project_apu_line_id,company_id,
    project_id,assignment_ref,amount,currency,state,idempotency_key,
    request_fingerprint,content_fingerprint,created_by_id,approved_by_id,approved_at
  ) VALUES($1,$2,1,$3,$4,$5,$6,'assignment',10.000001,'USD','overrun',$7,$8,$9,$10,$11,'2000-01-01T00:00:00.000Z')`,
  [
    commitmentVersionId,
    `commitment:${suffix}`,
    projectApuVersionId,
    projectLineId,
    companyId,
    projectId,
    `commitment-key:${suffix}`,
    `commitment-request:${suffix}`,
    `commitment-content:${suffix}`,
    makerId,
    checkerId,
  ],
);
assert.equal(
  (
    await pool.query(
      `SELECT approved_at > now() - interval '5 minutes' AS database_issued
       FROM generic_apu_commitment_versions WHERE id=$1`,
      [commitmentVersionId],
    )
  ).rows[0].database_issued,
  true,
);
check(
  "database-issued commitment approval time",
  "maker-checker authority was evaluated now and caller backdating was replaced",
);

await assert.rejects(
  pool.query(
    `INSERT INTO generic_apu_overrun_approvals(
      id,commitment_version_id,company_id,project_id,amount,currency,reason,
      approver_id,content_fingerprint,approved_at
    ) VALUES($1,$2,$3,$4,10.000001,'USD','Caller supplied reason',$5,$6,now())`,
    [
      `ungranted-approval:${suffix}`,
      commitmentVersionId,
      companyId,
      projectId,
      ungrantedId,
      `ungranted-approval-fingerprint:${suffix}`,
    ],
  ),
  /effective Finance grant/i,
);
check(
  "caller-trusted overrun approval rejected",
  "ungranted identity cannot authorize approval receipt",
);

await assert.rejects(
  pool.query(
    `INSERT INTO generic_apu_overrun_approvals(
      id,commitment_version_id,company_id,project_id,amount,currency,reason,
      approver_id,content_fingerprint,approved_at
    ) VALUES($1,$2,$3,$4,1,'USD','Mismatched amount',$5,$6,now())`,
    [
      `mismatched-approval:${suffix}`,
      commitmentVersionId,
      companyId,
      projectId,
      checkerId,
      `mismatched-approval-fingerprint:${suffix}`,
    ],
  ),
  /amount mismatch/i,
);
check(
  "overrun amount mismatch rejected",
  "approval receipt must bind the exact commitment amount",
);

await assert.rejects(
  pool.query(
    `INSERT INTO generic_apu_overrun_approvals(
      id,commitment_version_id,company_id,project_id,amount,currency,reason,
      approver_id,content_fingerprint,approved_at
    ) VALUES($1,$2,$3,$4,10.000001,'USD','Self approval attempt',$5,$6,now())`,
    [
      `self-approval:${suffix}`,
      commitmentVersionId,
      companyId,
      projectId,
      makerId,
      `self-approval-fingerprint:${suffix}`,
    ],
  ),
  /maker-checker/i,
);
check(
  "overrun self-approval rejected",
  "commitment maker cannot approve own overrun",
);

const approvalId = `approval:${suffix}`;
await pool.query(
  `INSERT INTO generic_apu_overrun_approvals(
    id,commitment_version_id,company_id,project_id,amount,currency,reason,
    approver_id,content_fingerprint,provenance,approved_at
  ) VALUES($1,$2,$3,$4,10.000001,'USD','Explicit disposable approval',$5,$6,$7::jsonb,'2000-01-01T00:00:00.000Z')`,
  [
    approvalId,
    commitmentVersionId,
    companyId,
    projectId,
    checkerId,
    `approval-fingerprint:${suffix}`,
    JSON.stringify({ grantId: `grant:${suffix}`, source: "database-behavior" }),
  ],
);
assert.equal(
  (
    await pool.query(
      `SELECT approved_at > now() - interval '5 minutes' AS database_issued
       FROM generic_apu_overrun_approvals WHERE id=$1`,
      [approvalId],
    )
  ).rows[0].database_issued,
  true,
);
check(
  "database-issued overrun approval time",
  "scope and maker-checker authority were evaluated now and caller backdating was replaced",
);

await assert.rejects(
  pool.query(
    `INSERT INTO generic_apu_overrun_approvals(
      id,commitment_version_id,company_id,project_id,amount,currency,reason,
      approver_id,content_fingerprint,approved_at
    ) VALUES($1,$2,$3,$4,10.000001,'USD','Future approval',$5,$6,'2999-01-01T00:00:00.000Z')`,
    [
      `future-approval:${suffix}`,
      commitmentVersionId,
      companyId,
      projectId,
      checkerId,
      `future-approval-fingerprint:${suffix}`,
    ],
  ),
  /future-dated/i,
);
check(
  "future approval rejected",
  "caller timestamp cannot manufacture future authority",
);

await pool.query(
  `INSERT INTO financial_authority_revocations(
    id,grant_id,reason,revoked_by_id,revoked_at
  ) VALUES($1,$2,'Disposable transaction-time revocation',$3,now())`,
  [`revocation:${suffix}`, `grant:${suffix}`, makerId],
);
await assert.rejects(
  pool.query(
    `INSERT INTO generic_apu_commitment_versions(
      id,commitment_id,version,project_apu_version_id,project_apu_line_id,company_id,
      project_id,assignment_ref,amount,currency,state,idempotency_key,
      request_fingerprint,content_fingerprint,created_by_id,approved_by_id,approved_at
    ) VALUES($1,$2,1,$3,$4,$5,$6,'assignment',10,'USD','overrun',$7,$8,$9,$10,$11,'2000-01-01T00:00:00.000Z')`,
    [
      `revoked-commitment:${suffix}`,
      `revoked-commitment-chain:${suffix}`,
      projectApuVersionId,
      projectLineId,
      companyId,
      projectId,
      `revoked-commitment-key:${suffix}`,
      `revoked-commitment-request:${suffix}`,
      `revoked-commitment-content:${suffix}`,
      makerId,
      checkerId,
    ],
  ),
  /effective Finance grant/i,
);
await assert.rejects(
  pool.query(
    `INSERT INTO generic_apu_overrun_approvals(
      id,commitment_version_id,company_id,project_id,amount,currency,reason,
      approver_id,content_fingerprint,approved_at
    ) VALUES($1,$2,$3,$4,10.000001,'USD','Revoked backdating attempt',$5,$6,'2000-01-01T00:00:00.000Z')`,
    [
      `revoked-approval:${suffix}`,
      commitmentVersionId,
      companyId,
      projectId,
      checkerId,
      `revoked-approval-fingerprint:${suffix}`,
    ],
  ),
  /effective Finance grant/i,
);
check(
  "revoked grant cannot be revived by backdating",
  "commitment and overrun approval both evaluate Finance authority at transaction time",
);

await assert.rejects(
  pool.query(`UPDATE generic_apu_overrun_approvals SET amount=1 WHERE id=$1`, [
    approvalId,
  ]),
  /append-only/i,
);
await assert.rejects(
  pool.query(`DELETE FROM generic_apu_commitment_versions WHERE id=$1`, [
    commitmentVersionId,
  ]),
  /append-only/i,
);
check(
  "accepted budget history immutable",
  "approval update and commitment delete rejected",
);

await assert.rejects(
  pool.query(
    `UPDATE generic_apu_template_versions SET name='Rewritten' WHERE id=$1`,
    [templateVersionId],
  ),
  /append-only/i,
);
await assert.rejects(
  pool.query(`DELETE FROM generic_project_apu_lines WHERE id=$1`, [
    projectLineId,
  ]),
  /append-only/i,
);
check(
  "frozen application bytes immutable",
  "template rewrite and applied-line delete rejected",
);

const immutableTriggers = Number(
  (
    await pool.query(`SELECT count(*)::int n FROM pg_trigger
      WHERE NOT tgisinternal AND tgname IN(
        'generic_apu_template_versions_immutable','generic_apu_template_nodes_immutable',
        'generic_project_apu_versions_immutable','generic_project_apu_lines_immutable',
        'generic_apu_commitment_versions_immutable','generic_apu_overrun_approvals_immutable'
      )`)
  ).rows[0].n,
);
assert.equal(immutableTriggers, 6);
check(
  "all accepted APU records defended",
  "six append-only triggers installed",
);

assert.equal(checks.length, 25);
console.log(
  JSON.stringify(
    {
      suite: "generic-apu-persistence-postgresql",
      status: "passed",
      checks,
    },
    null,
    2,
  ),
);
await pool.end();
