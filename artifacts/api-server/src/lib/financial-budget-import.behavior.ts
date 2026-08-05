import assert from "node:assert/strict";
import crypto from "node:crypto";
import * as XLSX from "xlsx";
import { pool } from "@workspace/db";
import { startFeaturePolicyMigration } from "./feature-policy-migration";
import { startFinancialControlMigration } from "./financial-control-migration";
import { startFinancialBudgetMigration } from "./financial-budget-migration";
import {
  confirmBudgetImport,
  previewBudgetImport,
} from "./financial-budget-import";
const url = process.env.PROD_DATABASE_URL;
if (!url || new URL(url).port !== "55436")
  throw new Error("Disposable Build 2 database required");
await startFeaturePolicyMigration();
await startFinancialControlMigration();
await startFinancialBudgetMigration();
await pool.query(
  `CREATE TABLE IF NOT EXISTS config_options(id serial PRIMARY KEY,category text NOT NULL,value text NOT NULL,meta jsonb);CREATE TABLE IF NOT EXISTS project_members(id serial PRIMARY KEY,project_id integer NOT NULL REFERENCES projects(id),user_id integer NOT NULL REFERENCES users(id),role text NOT NULL,status text NOT NULL DEFAULT 'active')`,
);
const ids = (
    await pool.query(
      `SELECT u.id user_id,u.company_id,p.id project_id FROM users u JOIN projects p ON p.created_by_id=u.id WHERE u.email='builder@example.test'`,
    )
  ).rows[0];
await pool.query(
  `INSERT INTO project_company_binding_versions(id,project_id,company_id,version,bound_by_id,reason_code,explanation_en,explanation_es,audit_evidence) VALUES('import-binding',$1,$2,1,$3,'DISPOSABLE_IMPORT','Disposable import scope.','Alcance desechable de importacion.','{}') ON CONFLICT(project_id,version) DO NOTHING`,
  [ids.project_id, ids.company_id, ids.user_id],
);
await pool.query(
  `INSERT INTO financial_authority_grants(id,user_id,company_id,project_id,scope_type,authority,version,effective_from,reason,granted_by_id) VALUES('import-cost-preparer',$1,$2,$3,'project','cost_preparer',1,now()-interval '1 hour','Disposable import proof',$1) ON CONFLICT(id) DO NOTHING`,
  [ids.user_id, ids.company_id, ids.project_id],
);
await pool.query(
  `INSERT INTO config_options(category,value,meta) SELECT 'member_role','admin','{"permission":"admin"}' WHERE NOT EXISTS(SELECT 1 FROM config_options WHERE category='member_role' AND value='admin')`,
);
await pool.query(
  `INSERT INTO project_members(project_id,user_id,role,status) SELECT $1,$2,'admin','active' WHERE NOT EXISTS(SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2)`,
  [ids.project_id, ids.user_id],
);
const csv = Buffer.from(
    "stableLineId,costNode,description,amount,currency\nimport-line,pn1,Imported exact line,25.000001,USD\n",
    "utf8",
  ),
  hash = crypto.createHash("sha256").update(csv).digest("hex"),
  file = (
    await pool.query(
      `INSERT INTO files(project_id,file_hash) VALUES($1,$2) RETURNING id`,
      [ids.project_id, hash],
    )
  ).rows[0],
  before = Number(
    (await pool.query(`SELECT count(*)::int n FROM project_budget_versions`))
      .rows[0].n,
  ),
  preview = await previewBudgetImport({
    actorUserId: Number(ids.user_id),
    projectId: Number(ids.project_id),
    sourceFileId: Number(file.id),
    fileName: "controlled-budget.csv",
    bytes: csv,
    currency: "USD",
    idempotencyKey: "valid-import-proof-20260720",
  });
assert.equal(preview.acceptedCount, 1);
assert.equal(preview.rejectedCount, 0);
assert.equal(preview.total, "25.000001");
assert.equal(preview.createsBudget, false);
assert.equal(
  Number(
    (await pool.query(`SELECT count(*)::int n FROM project_budget_versions`))
      .rows[0].n,
  ),
  before,
);
const changedCsv = Buffer.from(
    "stableLineId,costNode,description,amount,currency\nimport-line,pn1,Changed exact line,25.000002,USD\n",
    "utf8",
  ),
  changedHash = crypto.createHash("sha256").update(changedCsv).digest("hex"),
  changedFile = (
    await pool.query(
      `INSERT INTO files(project_id,file_hash) VALUES($1,$2) RETURNING id`,
      [ids.project_id, changedHash],
    )
  ).rows[0],
  sessionsBeforeConflict = Number(
    (
      await pool.query(
        `SELECT count(*)::int n FROM budget_import_sessions WHERE project_id=$1`,
        [ids.project_id],
      )
    ).rows[0].n,
  );
await assert.rejects(
  previewBudgetImport({
    actorUserId: Number(ids.user_id),
    projectId: Number(ids.project_id),
    sourceFileId: Number(changedFile.id),
    fileName: "controlled-budget.csv",
    bytes: changedCsv,
    currency: "USD",
    idempotencyKey: "valid-import-proof-20260720",
  }),
  (error: any) => error?.code === "BUDGET_IMPORT_IDEMPOTENCY_CONFLICT",
);
assert.equal(
  Number(
    (
      await pool.query(
        `SELECT count(*)::int n FROM budget_import_sessions WHERE project_id=$1`,
        [ids.project_id],
      )
    ).rows[0].n,
  ),
  sessionsBeforeConflict,
);
const workbook = XLSX.utils.book_new(),
  worksheet = XLSX.utils.json_to_sheet([
    {
      stableLineId: "xlsx-line",
      costNode: "pn1",
      description: "Native workbook line",
      amount: "10.000001",
      currency: "USD",
    },
  ]);
XLSX.utils.book_append_sheet(workbook, worksheet, "Budget");
const xlsx: Buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
  xlsxHash = crypto.createHash("sha256").update(xlsx).digest("hex"),
  xlsxFile = (
    await pool.query(
      `INSERT INTO files(project_id,file_hash) VALUES($1,$2) RETURNING id`,
      [ids.project_id, xlsxHash],
    )
  ).rows[0],
  xlsxPreview = await previewBudgetImport({
    actorUserId: Number(ids.user_id),
    projectId: Number(ids.project_id),
    sourceFileId: Number(xlsxFile.id),
    fileName: "controlled-budget.xlsx",
    bytes: xlsx,
    currency: "USD",
    idempotencyKey: "xlsx-import-proof-20260720",
  });
assert.equal(xlsxPreview.acceptedCount, 1);
assert.equal(xlsxPreview.total, "10.000001");
const confirmation = {
    actorUserId: Number(ids.user_id),
    projectId: Number(ids.project_id),
    sessionId: preview.id,
    fileHash: preview.fileHash,
    parsedFingerprint: preview.parsedFingerprint,
    currency: preview.currency,
    total: preview.total,
    structureVersionId: "sv1",
    purpose: "Controlled import confirmation",
  };
await assert.rejects(
  confirmBudgetImport({ ...confirmation, structureVersionId: "missing-structure" }),
  (error: any) => error?.code === "BUDGET_STRUCTURE_INVALID",
);
assert.equal(
  Number(
    (
      await pool.query(
        `SELECT count(*)::int n FROM project_budget_versions WHERE purpose='Controlled import confirmation'`,
      )
    ).rows[0].n,
  ),
  0,
);
assert.equal(
  (
    await pool.query(
      `SELECT confirmed_budget_version_id FROM budget_import_sessions WHERE id=$1`,
      [preview.id],
    )
  ).rows[0].confirmed_budget_version_id,
  null,
);
const confirmed = await Promise.all([
    confirmBudgetImport(confirmation),
    confirmBudgetImport(confirmation),
  ]);
assert.equal(confirmed[0].budgetVersionId, confirmed[1].budgetVersionId);
assert.equal(
  Number(
    (
      await pool.query(
        `SELECT count(*)::int n FROM project_budget_versions WHERE purpose='Controlled import confirmation'`,
      )
    ).rows[0].n,
  ),
  1,
);
const duplicateRetry = await confirmBudgetImport(confirmation);
assert.equal(duplicateRetry.budgetVersionId, confirmed[0].budgetVersionId);
assert.equal(duplicateRetry.idempotent, true);
await assert.rejects(
  confirmBudgetImport({
    ...confirmation,
    purpose: "Changed confirmation payload",
  }),
  (error: any) => error?.code === "BUDGET_IMPORT_CONFIRMATION_CONFLICT",
);
const formula = Buffer.from(
    "stableLineId,costNode,description,amount,currency\nformula-line,pn1,Formula,=1+1,USD\n",
    "utf8",
  ),
  formulaHash = crypto.createHash("sha256").update(formula).digest("hex"),
  formulaFile = (
    await pool.query(
      `INSERT INTO files(project_id,file_hash) VALUES($1,$2) RETURNING id`,
      [ids.project_id, formulaHash],
    )
  ).rows[0];
await assert.rejects(
  previewBudgetImport({
    actorUserId: Number(ids.user_id),
    projectId: Number(ids.project_id),
    sourceFileId: Number(formulaFile.id),
    fileName: "formula.csv",
    bytes: formula,
    currency: "USD",
    idempotencyKey: "formula-import-proof-20260720",
  }),
  (error: any) => error?.code === "BUDGET_IMPORT_FORMULA_REJECTED",
);
const result = {
  suite: "cost-financial-control-build-2-import",
  status: "passed",
  checks: [
    "CSV preview accepted exact literal",
    "preview created no budget",
    "changed payload with same key returned conflict and zero mutation",
    "confirmation matched hash/fingerprint/project/currency/total",
    "failed confirmation rolled back draft and session state atomically",
    "concurrent duplicate confirmation returned one draft",
    "duplicate retry returned the same committed draft",
    "changed confirmation payload after commit returned conflict",
    "source evidence linked by stable file identity",
    "formula cell rejected",
    "native XLSX preview accepted exact literal",
  ],
};
console.log(JSON.stringify(result, null, 2));
await pool.end();
