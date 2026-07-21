import assert from "node:assert/strict";
import express from "express";
import { pool } from "@workspace/db";
import financialBudgetsRouter from "../routes/financial-budgets";
import { signToken } from "../middlewares/auth";
import { startFeaturePolicyMigration } from "./feature-policy-migration";
import { startFinancialControlMigration } from "./financial-control-migration";
import { startFinancialBudgetMigration } from "./financial-budget-migration";
const url = process.env.PROD_DATABASE_URL;
if (!url) throw new Error("Disposable database required");
const target = new URL(url);
if (target.port !== "55436" || target.pathname !== "/bimlog_financial_build2")
  throw new Error("Refusing non-disposable database");
await pool.query(
  `CREATE TABLE IF NOT EXISTS config_options(id serial PRIMARY KEY,category text NOT NULL,value text NOT NULL,meta jsonb);CREATE TABLE IF NOT EXISTS project_members(id serial PRIMARY KEY,project_id integer NOT NULL REFERENCES projects(id),user_id integer NOT NULL REFERENCES users(id),role text NOT NULL,status text NOT NULL DEFAULT 'active');`,
);
const ids = (
  await pool.query(
    `SELECT u.id user_id,u.company_id,p.id project_id FROM users u JOIN projects p ON p.created_by_id=u.id WHERE u.email='builder@example.test'`,
  )
).rows[0];
await pool.query(
  `INSERT INTO config_options(category,value,meta) SELECT 'member_role','admin','{"permission":"admin"}' WHERE NOT EXISTS(SELECT 1 FROM config_options WHERE category='member_role' AND value='admin')`,
);
await pool.query(
  `INSERT INTO project_members(project_id,user_id,role,status) SELECT $1,$2,'admin','active' WHERE NOT EXISTS(SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2)`,
  [ids.project_id, ids.user_id],
);
await startFeaturePolicyMigration();
await startFinancialControlMigration();
await startFinancialBudgetMigration();
await pool.query(
  `INSERT INTO project_company_binding_versions(id,project_id,company_id,version,bound_by_id,reason_code,explanation_en,explanation_es,audit_evidence) VALUES('http-binding',$1,$2,1,$3,'DISPOSABLE_HTTP','Disposable HTTP scope.','Alcance HTTP desechable.','{}') ON CONFLICT(project_id,version) DO NOTHING`,
  [ids.project_id, ids.company_id, ids.user_id],
);
for (const authority of ["financial_viewer", "cost_preparer"]) {
  await pool.query(
    `INSERT INTO financial_authority_grants(id,user_id,company_id,project_id,scope_type,authority,version,effective_from,reason,granted_by_id) VALUES($1,$2,$3,$4,'project',$5,1,now()-interval '1 hour','Disposable HTTP proof',$2) ON CONFLICT(id) DO NOTHING`,
    [
      `http-${authority}`,
      ids.user_id,
      ids.company_id,
      ids.project_id,
      authority,
    ],
  );
}
const approver = (
  await pool.query(
    `INSERT INTO users(email,full_name,company_id) VALUES('approver@example.test','Independent Approver',$1) RETURNING id`,
    [ids.company_id],
  )
).rows[0];
await pool.query(
  `INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,'admin','active')`,
  [ids.project_id, approver.id],
);
for (const authority of ["cost_reviewer", "cost_approver"]) {
  await pool.query(
    `INSERT INTO financial_authority_grants(id,user_id,company_id,project_id,scope_type,authority,version,effective_from,reason,granted_by_id) VALUES($1,$2,$3,$4,'project',$5,1,now()-interval '1 hour','Disposable negative-offset proof',$2)`,
    [
      `http-${authority}`,
      approver.id,
      ids.company_id,
      ids.project_id,
      authority,
    ],
  );
}
await pool.query(
  `INSERT INTO financial_approval_policy_versions(id,company_id,project_id,scope_type,transaction_category,currency,max_amount,version,effective_from,state,reason,created_by_id) VALUES('http-budget-revision-policy',$1,$2,'project','budget_revision','USD',100.1,1,now()-interval '1 hour','active','Disposable exact limit',$3)`,
  [ids.company_id, ids.project_id, approver.id],
);
const app = express();
app.use(express.json());
app.use("/api/v1", financialBudgetsRouter);
const server = app.listen(3135, "127.0.0.1");
const token = signToken({
    userId: Number(ids.user_id),
    email: "builder@example.test",
    companyId: Number(ids.company_id),
    fullName: "Builder",
    companyName: "Disposable Company",
    isSuperAdmin: false,
  }),
  request = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`http://127.0.0.1:3135/api/v1${path}`, init);
    return { status: response.status, body: (await response.json()) as any };
  };
const unauth = await request(`/projects/${ids.project_id}/financial/workspace`);
assert.equal(unauth.status, 401);
const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  approverToken = signToken({
    userId: Number(approver.id),
    email: "approver@example.test",
    companyId: Number(ids.company_id),
    fullName: "Independent Approver",
    companyName: "Disposable Company",
    isSuperAdmin: false,
  }),
  approverHeaders = {
    Authorization: `Bearer ${approverToken}`,
    "Content-Type": "application/json",
  },
  allowed = await request(`/projects/${ids.project_id}/financial/workspace`, {
    headers,
  });
assert.equal(allowed.status, 200);
assert.equal(allowed.body.project.name, "Disposable Project");
assert.equal(allowed.body.snapshots.length, 1);
assert.doesNotMatch(
  JSON.stringify(allowed.body),
  /storage_path|database_url|password|secret|signed.?url/i,
);
const created = await request(`/projects/${ids.project_id}/financial/budgets`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    structureVersionId: "sv1",
    currency: "USD",
    purpose: "Authenticated HTTP draft",
    lines: [
      {
        stableLineId: "http-line",
        projectCostNodeId: "pn1",
        description: "HTTP exact line",
        amount: "12.000001",
        sortOrder: 0,
      },
    ],
  }),
});
assert.equal(created.status, 201);
assert.equal(created.body.total, "12.000001");
const offsetDraft = await request(`/projects/${ids.project_id}/financial/budgets`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    structureVersionId: "sv1",
    currency: "USD",
    purpose: "Negative offset approval exposure",
    lines: [
      {
        stableLineId: "positive-exposure",
        projectCostNodeId: "pn1",
        description: "Positive exposure",
        amount: "100.1",
        sortOrder: 0,
      },
      {
        stableLineId: "negative-offset",
        projectCostNodeId: "pn1",
        description: "Negative offset",
        amount: "-0.000001",
        sortOrder: 1,
      },
    ],
  }),
});
assert.equal(offsetDraft.status, 201);
assert.equal(offsetDraft.body.total, "100.099999");
const submitted = await request(
  `/projects/${ids.project_id}/financial/budgets/${offsetDraft.body.id}/actions`,
  {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "submit", expectedRevision: 1 }),
  },
);
assert.equal(submitted.status, 200);
const reviewed = await request(
  `/projects/${ids.project_id}/financial/budgets/${offsetDraft.body.id}/actions`,
  {
    method: "POST",
    headers: approverHeaders,
    body: JSON.stringify({ action: "start_review", expectedRevision: 2 }),
  },
);
assert.equal(reviewed.status, 200);
const deniedOffsetApproval = await request(
  `/projects/${ids.project_id}/financial/budgets/${offsetDraft.body.id}/approve`,
  {
    method: "POST",
    headers: approverHeaders,
    body: JSON.stringify({
      expectedRevision: 3,
      confirmationFingerprint: offsetDraft.body.contentFingerprint,
    }),
  },
);
assert.equal(deniedOffsetApproval.status, 403);
assert.equal(deniedOffsetApproval.body.code, "FIN_APPROVAL_LIMIT_EXCEEDED");
assert.equal(
  (
    await pool.query(
      `SELECT status FROM project_budget_versions WHERE id=$1`,
      [offsetDraft.body.id],
    )
  ).rows[0].status,
  "under_review",
);
assert.equal(
  Number(
    (
      await pool.query(
        `SELECT count(*)::int n FROM approved_budget_snapshots WHERE budget_version_id=$1`,
        [offsetDraft.body.id],
      )
    ).rows[0].n,
  ),
  0,
);
const before = (
    await pool.query(
      `SELECT count(*)::int n FROM project_budget_versions WHERE purpose='Cross project denied'`,
    )
  ).rows[0].n,
  cross = await request(`/projects/999999/financial/budgets`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      structureVersionId: "sv1",
      currency: "USD",
      purpose: "Cross project denied",
      lines: [
        {
          stableLineId: "bad-line",
          projectCostNodeId: "pn1",
          description: "Denied",
          amount: "1",
          sortOrder: 0,
        },
      ],
    }),
  });
assert.ok([403, 409].includes(cross.status));
const after = (
  await pool.query(
    `SELECT count(*)::int n FROM project_budget_versions WHERE purpose='Cross project denied'`,
  )
).rows[0].n;
assert.equal(before, after);
const result = {
  suite: "cost-financial-control-build-2-authenticated-http",
  status: "passed",
  checks: [
    "missing bearer token denied",
    "entitlement and explicit viewer authority allow workspace",
    "snapshot returned without protected paths",
    "authorized preparer creates exact-decimal draft",
    "negative offset cannot reduce exact approval-limit exposure",
    "cross-project request denied with no partial write",
  ],
};
console.log(JSON.stringify(result, null, 2));
await new Promise<void>((resolve) => server.close(() => resolve()));
await pool.end();
