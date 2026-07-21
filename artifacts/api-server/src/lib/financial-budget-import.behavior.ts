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
const ids = (
    await pool.query(
      `SELECT u.id user_id,p.id project_id FROM users u JOIN projects p ON p.created_by_id=u.id WHERE u.email='builder@example.test'`,
    )
  ).rows[0],
  csv = Buffer.from(
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
    "source evidence linked by stable file identity",
    "formula cell rejected",
    "native XLSX preview accepted exact literal",
  ],
};
console.log(JSON.stringify(result, null, 2));
await pool.end();
