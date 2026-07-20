import assert from "node:assert/strict";
import { pool } from "@workspace/db";
import { ensureFinancialControlSchema } from "./financial-control-migration";

const connection = process.env.PROD_DATABASE_URL;
if (!connection)
  throw new Error("Isolated local PROD_DATABASE_URL is required.");
const identity = new URL(connection);
if (
  !["127.0.0.1", "localhost", "::1"].includes(identity.hostname) ||
  identity.port !== "55435" ||
  identity.pathname !== "/bimlog_financial_build1"
)
  throw new Error(
    "Refusing to run outside the approved disposable Build 1 database.",
  );
const checks: Array<{ number: number; name: string; evidence: string }> = [];
const check = (name: string, evidence: string) =>
  checks.push({ number: checks.length + 1, name, evidence });
await pool.query(
  `CREATE TABLE companies(id serial PRIMARY KEY,name text NOT NULL);CREATE TABLE users(id serial PRIMARY KEY,email text NOT NULL,company_id integer NOT NULL REFERENCES companies(id),is_super_admin boolean NOT NULL DEFAULT false);CREATE TABLE projects(id serial PRIMARY KEY,name text NOT NULL,created_by_id integer NOT NULL REFERENCES users(id));`,
);
const company = await pool.query(
    `INSERT INTO companies(name) VALUES('Disposable Build 1 Company') RETURNING id`,
  ),
  companyId = Number(company.rows[0].id);
const user = await pool.query(
    `INSERT INTO users(email,company_id,is_super_admin) VALUES('auditor@example.test',$1,false) RETURNING id`,
    [companyId],
  ),
  userId = Number(user.rows[0].id);
const project = await pool.query(
    `INSERT INTO projects(name,created_by_id) VALUES('Disposable Build 1 Project',$1) RETURNING id`,
    [userId],
  ),
  projectId = Number(project.rows[0].id);
await ensureFinancialControlSchema();
await ensureFinancialControlSchema();
check("idempotent migration", "schema ensured twice without destructive reset");
const tables = await pool.query(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'financial_%' ORDER BY table_name`,
);
assert.deepEqual(
  tables.rows.map((r) => r.table_name),
  [
    "financial_approval_policy_versions",
    "financial_authority_grants",
    "financial_authority_journal",
    "financial_authority_revocations",
    "financial_context_versions",
    "financial_suspension_events",
  ],
);
check(
  "financial foundation tables",
  "six bounded control and history tables created",
);
await pool.query(
  `INSERT INTO financial_authority_journal(id,event_type,company_id,project_id,actor_user_id,subject_user_id,entity_type,entity_id,entity_version,decision,reason_code,explanation_en,explanation_es,evidence) VALUES('journal-1','authorization_evaluated',$1,$2,$3,$3,'synthetic_authorization_request','request-1',1,'deny','FIN_ENTITLEMENT_DENIED','Denied by canonical entitlement.','Denegado por el derecho canónico.','{"synthetic":true}')`,
  [companyId, projectId, userId],
);
await assert.rejects(
  pool.query(
    `UPDATE financial_authority_journal SET decision='allow' WHERE id='journal-1'`,
  ),
  /append-only/,
);
check("journal UPDATE defense", "database trigger rejected mutation");
await assert.rejects(
  pool.query(`DELETE FROM financial_authority_journal WHERE id='journal-1'`),
  /append-only/,
);
check("journal DELETE defense", "database trigger rejected deletion");
const retained = await pool.query(
  `SELECT decision,evidence FROM financial_authority_journal WHERE id='journal-1'`,
);
assert.equal(retained.rows[0].decision, "deny");
assert.equal(retained.rows[0].evidence.synthetic, true);
check("journal retention", "original decision and sanitized evidence retained");
await assert.rejects(
  pool.query(
    `INSERT INTO financial_authority_grants(id,user_id,company_id,scope_type,authority,version,effective_from,reason,granted_by_id) VALUES('bad-role',$1,$2,'company','project_admin',1,now(),'invalid role',$1)`,
    [userId, companyId],
  ),
  /financial_grant_authority_chk/,
);
check(
  "role boundary constraint",
  "existing project role rejected as financial authority",
);
await assert.rejects(
  pool.query(
    `INSERT INTO financial_approval_policy_versions(id,company_id,scope_type,transaction_category,currency,max_amount,version,effective_from,state,reason,created_by_id) VALUES('bad-currency',$1,'company','change_order','US',10,1,now(),'active','invalid currency',$2)`,
    [companyId, userId],
  ),
  /financial_policy_currency_chk/,
);
check("currency schema constraint", "malformed currency rejected");
await pool.query(
  `INSERT INTO financial_context_versions(id,company_id,project_id,scope_type,version,base_currency,reporting_currency,permitted_transaction_currencies,effective_from,reason,created_by_id) VALUES('context-1',$1,$2,'project',1,'USD','CAD','["USD","CAD"]',now(),'initial immutable context',$3)`,
  [companyId, projectId, userId],
);
await assert.rejects(
  pool.query(
    `UPDATE financial_context_versions SET base_currency='EUR' WHERE id='context-1'`,
  ),
  /append-only/,
);
check(
  "context version immutability",
  "database rejected in-place currency change",
);
const triggers = await pool.query(
  `SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 'financial_%_immutable' ORDER BY tgname`,
);
assert.equal(triggers.rowCount, 6);
check(
  "append-only trigger coverage",
  "journal, context, grants, revocations, policies and suspensions protected",
);
await pool.end();
console.log(
  JSON.stringify(
    { suite: "cost-financial-control-build-1-db", status: "passed", checks },
    null,
    2,
  ),
);
