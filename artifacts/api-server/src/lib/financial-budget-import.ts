import crypto from "crypto";
import * as XLSX from "xlsx";
import { pool } from "@workspace/db";
import { FinancialControlError } from "./financial-control-contract";
import { authorizeFinancialOperation } from "./financial-control-service";
import {
  boundedText,
  budgetCurrency,
  canonicalFingerprint,
  exactSignedDecimal,
  exactTotal,
  normalizeBudgetLines,
  positiveId,
} from "./financial-budget-contract";
import { createBudgetDraftWithClient } from "./financial-budget-service";
import { waitForFinancialBudgetMigration } from "./financial-budget-migration";

const MAX_BYTES = 10 * 1024 * 1024,
  MAX_ROWS = 10000;
type PreviewLine = {
  stableLineId: string;
  projectCostNodeId: string;
  description: string;
  amount: string;
  quantity: string | null;
  unit: string | null;
  unitRate: string | null;
  notes: string | null;
  provenance: string;
  sortOrder: number;
};
export async function previewBudgetImport(input: {
  actorUserId: number;
  projectId: unknown;
  sourceFileId: unknown;
  fileName: unknown;
  bytes: Buffer;
  currency: unknown;
  idempotencyKey: unknown;
}) {
  await waitForFinancialBudgetMigration();
  const projectId = positiveId(input.projectId, "projectId"),
    sourceFileId = positiveId(input.sourceFileId, "sourceFileId"),
    currency = budgetCurrency(input.currency),
    fileName = boundedText(input.fileName, "fileName", 1, 255),
    idempotencyKey = boundedText(
      input.idempotencyKey,
      "idempotencyKey",
      8,
      200,
    );
  if (!input.bytes.length || input.bytes.length > MAX_BYTES)
    throw new FinancialControlError(
      400,
      "BUDGET_IMPORT_SIZE_INVALID",
      "Import file must be between 1 byte and 10 MB.",
    );
  if (!/\.(csv|xlsx)$/i.test(fileName))
    throw new FinancialControlError(
      400,
      "BUDGET_IMPORT_TYPE_INVALID",
      "Only CSV and native XLSX files are accepted.",
    );
  const auth = await authorizeFinancialOperation({
    actorUserId: input.actorUserId,
    projectId,
    featureKey: "cost.budget.prepare",
    operation: "prepare",
  });
  const file = (
    await pool.query(
      `SELECT id,file_hash FROM files WHERE id=$1 AND project_id=$2`,
      [sourceFileId, projectId],
    )
  ).rows[0];
  if (!file)
    throw new FinancialControlError(
      400,
      "BUDGET_SOURCE_FILE_INVALID",
      "The evidence file is not an authenticated project file.",
    );
  const fileHash = crypto
    .createHash("sha256")
    .update(input.bytes)
    .digest("hex");
  if (file.file_hash && String(file.file_hash) !== fileHash)
    throw new FinancialControlError(
      409,
      "BUDGET_SOURCE_HASH_MISMATCH",
      "Uploaded evidence does not match the authenticated file identity.",
    );
  const workbook = XLSX.read(input.bytes, {
    type: "buffer",
    raw: true,
    cellFormula: true,
    cellNF: true,
    bookVBA: true,
  });
  if (workbook.vbaraw)
    throw new FinancialControlError(
      400,
      "BUDGET_IMPORT_MACRO_REJECTED",
      "Macro-enabled workbooks are not accepted.",
    );
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet)
    throw new FinancialControlError(
      400,
      "BUDGET_IMPORT_EMPTY",
      "The import contains no worksheet.",
    );
  for (const cell of Object.values(sheet))
    if (cell && typeof cell === "object" && "f" in cell)
      throw new FinancialControlError(
        400,
        "BUDGET_IMPORT_FORMULA_REJECTED",
        "Formula cells are not accepted.",
      );
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });
  if (rows.length > MAX_ROWS)
    throw new FinancialControlError(
      400,
      "BUDGET_IMPORT_ROW_LIMIT",
      "Import exceeds 10,000 rows.",
    );
  const accepted: PreviewLine[] = [],
    rejected: Array<{ row: number; reasons: string[] }> = [];
  for (let index = 0; index < rows.length; index++) {
    const r = rows[index],
      reasons: string[] = [];
    if (
      Object.values(r).some(
        (value) => typeof value === "string" && /^\s*=/.test(value),
      )
    )
      throw new FinancialControlError(
        400,
        "BUDGET_IMPORT_FORMULA_REJECTED",
        "Formula cells are not accepted.",
      );
    for (const required of [
      "stableLineId",
      "costNode",
      "description",
      "amount",
      "currency",
    ])
      if (String(r[required] ?? "").trim() === "")
        reasons.push(`missing_${required}`);
    let amount = "";
    try {
      amount = exactSignedDecimal(String(r.amount), "amount");
    } catch {
      reasons.push("invalid_exact_decimal");
    }
    if (/[,.].*[,.]/.test(String(r.amount)) || /,/.test(String(r.amount)))
      reasons.push("locale_ambiguous_decimal");
    if (String(r.currency).toUpperCase() !== currency)
      reasons.push("cross_currency");
    const nodeToken = String(r.costNode ?? "").trim();
    const node = (
      await pool.query(
        `SELECT n.id,n.active FROM project_cost_nodes n JOIN project_cost_structure_versions s ON s.id=n.structure_version_id WHERE s.project_id=$1 AND s.status='approved' AND (n.id=$2 OR n.project_code=$2) ORDER BY s.version DESC LIMIT 2`,
        [projectId, nodeToken],
      )
    ).rows;
    if (node.length !== 1 || node[0].active !== true)
      reasons.push(
        node.length > 1
          ? "ambiguous_cost_node"
          : "unknown_or_inactive_cost_node",
      );
    if (reasons.length)
      rejected.push({ row: index + 2, reasons: [...new Set(reasons)] });
    else
      accepted.push({
        stableLineId: String(r.stableLineId).trim(),
        projectCostNodeId: String(node[0].id),
        description: String(r.description).trim(),
        amount,
        quantity:
          r.quantity == null || r.quantity === "" ? null : String(r.quantity),
        unit: r.unit == null || r.unit === "" ? null : String(r.unit),
        unitRate:
          r.unitRate == null || r.unitRate === "" ? null : String(r.unitRate),
        notes: r.notes == null || r.notes === "" ? null : String(r.notes),
        provenance: "controlled_import",
        sortOrder: index,
      });
  }
  let lines: ReturnType<typeof normalizeBudgetLines> = [];
  try {
    lines = accepted.length ? normalizeBudgetLines(accepted) : [];
  } catch (error) {
    rejected.push({
      row: 0,
      reasons: [
        error instanceof FinancialControlError ? error.code : "invalid_rows",
      ],
    });
  }
  const total = lines.length ? exactTotal(lines) : "0",
    parsedFingerprint = canonicalFingerprint({
      projectId,
      currency,
      lines,
      rejected,
    }),
    id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO budget_import_sessions(id,project_id,company_id,actor_user_id,source_file_id,file_hash,parsed_fingerprint,currency,total,accepted_count,rejected_count,preview,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13) ON CONFLICT(project_id,idempotency_key) DO NOTHING`,
    [
      id,
      projectId,
      auth.scope.companyId,
      auth.actor.userId,
      sourceFileId,
      fileHash,
      parsedFingerprint,
      currency,
      total,
      lines.length,
      rejected.length,
      JSON.stringify({ lines, rejected }),
      idempotencyKey,
    ],
  );
  const stored = (
    await pool.query(
      `SELECT * FROM budget_import_sessions WHERE project_id=$1 AND idempotency_key=$2`,
      [projectId, idempotencyKey],
    )
  ).rows[0];
  if (
    Number(stored.actor_user_id) !== auth.actor.userId ||
    Number(stored.company_id) !== auth.scope.companyId ||
    Number(stored.source_file_id) !== sourceFileId ||
    String(stored.file_hash) !== fileHash ||
    String(stored.parsed_fingerprint) !== parsedFingerprint ||
    String(stored.currency) !== currency ||
    exactSignedDecimal(String(stored.total), "total") !==
      exactSignedDecimal(total, "total")
  )
    throw new FinancialControlError(
      409,
      "BUDGET_IMPORT_IDEMPOTENCY_CONFLICT",
      "This idempotency key was already used with different import content.",
    );
  return {
    id: stored.id,
    fileHash: stored.file_hash,
    parsedFingerprint: stored.parsed_fingerprint,
    currency: stored.currency,
    total: String(stored.total),
    acceptedCount: Number(stored.accepted_count),
    rejectedCount: Number(stored.rejected_count),
    rejected: (stored.preview as any).rejected,
    createsBudget: false,
    sourceFile: { id: Number(stored.source_file_id) },
  };
}
export async function confirmBudgetImport(input: {
  actorUserId: number;
  projectId: unknown;
  sessionId: unknown;
  fileHash: unknown;
  parsedFingerprint: unknown;
  currency: unknown;
  total: unknown;
  structureVersionId: unknown;
  purpose: unknown;
}) {
  await waitForFinancialBudgetMigration();
  const projectId = positiveId(input.projectId, "projectId"),
    sessionId = boundedText(input.sessionId, "sessionId", 3, 100);
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query(`SELECT pg_advisory_lock(hashtextextended($1,0))`, [
      `budget-import:${sessionId}`,
    ]);
    locked = true;
    await client.query("BEGIN");
    const row = (
      await client.query(
        `SELECT * FROM budget_import_sessions WHERE id=$1 AND project_id=$2 FOR UPDATE`,
        [sessionId, projectId],
      )
    ).rows[0];
    if (!row)
      throw new FinancialControlError(
        404,
        "BUDGET_IMPORT_NOT_FOUND",
        "Import preview not found.",
      );
    if (row.confirmed_budget_version_id) {
      await client.query("COMMIT");
      return {
        budgetVersionId: row.confirmed_budget_version_id,
        idempotent: true,
      };
    }
    if (row.rejected_count > 0)
      throw new FinancialControlError(
        409,
        "BUDGET_IMPORT_HAS_ERRORS",
        "Resolve all rejected rows before confirmation.",
      );
    if (
      String(input.fileHash) !== row.file_hash ||
      String(input.parsedFingerprint) !== row.parsed_fingerprint ||
      budgetCurrency(input.currency) !== row.currency ||
      exactSignedDecimal(input.total, "total") !==
        exactSignedDecimal(String(row.total), "total")
    )
      throw new FinancialControlError(
        409,
        "BUDGET_IMPORT_CONFIRMATION_MISMATCH",
        "Confirmation must match the exact preview evidence.",
      );
    const draft = await createBudgetDraftWithClient({
      actorUserId: input.actorUserId,
      projectId,
      structureVersionId: input.structureVersionId,
      currency: row.currency,
      purpose: input.purpose,
      lines: row.preview.lines,
      sourceFileId: row.source_file_id,
    }, client);
    await client.query(
      `UPDATE budget_import_sessions SET confirmed_budget_version_id=$2,confirmed_at=now() WHERE id=$1 AND confirmed_budget_version_id IS NULL`,
      [sessionId, draft.id],
    );
    const final = (
      await client.query(
        `SELECT confirmed_budget_version_id FROM budget_import_sessions WHERE id=$1`,
        [sessionId],
      )
    ).rows[0];
    await client.query("COMMIT");
    return {
      budgetVersionId: final.confirmed_budget_version_id,
      idempotent: false,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw error;
  } finally {
    if (locked)
      await client.query(`SELECT pg_advisory_unlock(hashtextextended($1,0))`, [
        `budget-import:${sessionId}`,
      ]);
    client.release();
  }
}
