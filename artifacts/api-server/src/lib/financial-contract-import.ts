import crypto from "crypto";
import * as XLSX from "xlsx";
import { pool } from "@workspace/db";
import { FinancialControlError } from "./financial-control-contract";
import { authorizeFinancialOperation } from "./financial-control-service";
import { boundedText, positiveId } from "./financial-budget-contract";
import { contractCurrency, contractFingerprint, contractLineTotal, exactPositiveAmount, normalizeContractLines } from "./financial-contract-contract";
import { createContractDraftWithClient, type CreateContractDraftInput } from "./financial-contract-service";
import { waitForFinancialContractMigration } from "./financial-contract-migration";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 10000;

export async function previewContractImport(input: { actorUserId: number; projectId: unknown; sourceFileId: unknown; fileName: unknown; bytes: Buffer; currency: unknown; budgetSnapshotId: unknown; idempotencyKey: unknown }) {
  await waitForFinancialContractMigration();
  const projectId = positiveId(input.projectId, "projectId"), sourceFileId = positiveId(input.sourceFileId, "sourceFileId");
  const fileName = boundedText(input.fileName, "fileName", 1, 255), currency = contractCurrency(input.currency);
  const budgetSnapshotId = boundedText(input.budgetSnapshotId, "budgetSnapshotId", 3, 100), idempotencyKey = boundedText(input.idempotencyKey, "idempotencyKey", 8, 200);
  if (!input.bytes.length || input.bytes.length > MAX_BYTES) throw new FinancialControlError(400, "CONTRACT_IMPORT_SIZE_INVALID", "Import file must be between 1 byte and 10 MB.");
  if (!/\.(csv|xlsx)$/i.test(fileName)) throw new FinancialControlError(400, "CONTRACT_IMPORT_TYPE_INVALID", "Only CSV and native XLSX files are accepted.");
  const auth = await authorizeFinancialOperation({ actorUserId: input.actorUserId, projectId, featureKey: "cost.commitment.import", operation: "prepare" });
  const file = (await pool.query(`SELECT id,file_hash FROM files WHERE id=$1 AND project_id=$2`, [sourceFileId, projectId])).rows[0];
  if (!file) throw new FinancialControlError(400, "CONTRACT_SOURCE_FILE_INVALID", "The import source must be an authenticated project file.");
  const fileHash = crypto.createHash("sha256").update(input.bytes).digest("hex");
  if (file.file_hash && String(file.file_hash) !== fileHash) throw new FinancialControlError(409, "CONTRACT_SOURCE_HASH_MISMATCH", "Uploaded import content does not match the authenticated file identity.");
  const workbook = XLSX.read(input.bytes, { type: "buffer", raw: true, cellFormula: true, cellNF: true, bookVBA: true });
  if (workbook.vbaraw) throw new FinancialControlError(400, "CONTRACT_IMPORT_MACRO_REJECTED", "Macro-enabled workbooks are not accepted.");
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new FinancialControlError(400, "CONTRACT_IMPORT_EMPTY", "The import contains no worksheet.");
  for (const cell of Object.values(sheet)) if (cell && typeof cell === "object" && "f" in cell) throw new FinancialControlError(400, "CONTRACT_IMPORT_FORMULA_REJECTED", "Formula cells are not accepted.");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  if (rows.length > MAX_ROWS) throw new FinancialControlError(400, "CONTRACT_IMPORT_ROW_LIMIT", "Import exceeds 10,000 rows.");
  const snapshotLines = await pool.query(`SELECT l.id,l.project_cost_node_id,n.project_code FROM approved_budget_snapshot_lines l JOIN approved_budget_snapshots s ON s.id=l.snapshot_id JOIN project_cost_nodes n ON n.id=l.project_cost_node_id WHERE s.id=$1 AND s.project_id=$2 AND s.company_id=$3 AND s.currency=$4`, [budgetSnapshotId, projectId, auth.scope.companyId, currency]);
  if (!snapshotLines.rows.length) throw new FinancialControlError(400, "CONTRACT_BUDGET_SNAPSHOT_INVALID", "The selected approved budget snapshot is unavailable in this project and currency.");
  const byLine = new Map(snapshotLines.rows.map((r: any) => [String(r.id), r]));
  const byCode = new Map<string, any[]>();
  for (const row of snapshotLines.rows) byCode.set(String(row.project_code), [...(byCode.get(String(row.project_code)) ?? []), row]);
  const accepted: any[] = [], rejected: Array<{ row: number; reasons: string[] }> = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index], reasons: string[] = [];
    if (Object.values(row).some((value) => typeof value === "string" && /^\s*[=+\-@]/.test(value))) throw new FinancialControlError(400, "CONTRACT_IMPORT_FORMULA_REJECTED", "Formula-like cells are not accepted.");
    for (const required of ["stableLineId", "budgetLine", "description", "amount", "currency"]) if (String(row[required] ?? "").trim() === "") reasons.push(`missing_${required}`);
    let amount = "";
    try { amount = exactPositiveAmount(String(row.amount)); } catch { reasons.push("invalid_exact_decimal"); }
    if (String(row.amount).includes(",")) reasons.push("locale_ambiguous_decimal");
    if (String(row.currency).toUpperCase() !== currency) reasons.push("cross_currency");
    const token = String(row.budgetLine ?? "").trim();
    const candidates = byLine.has(token) ? [byLine.get(token)] : (byCode.get(token) ?? []);
    if (candidates.length !== 1) reasons.push(candidates.length > 1 ? "ambiguous_budget_line" : "unknown_budget_line");
    if (reasons.length) rejected.push({ row: index + 2, reasons: [...new Set(reasons)] });
    else accepted.push({ stableLineId: String(row.stableLineId).trim(), budgetSnapshotLineId: String(candidates[0].id), projectCostNodeId: String(candidates[0].project_cost_node_id), scheduleItemPlacementId: row.scheduleItemPlacementId === "" ? null : row.scheduleItemPlacementId, description: String(row.description).trim(), amount, sortOrder: index });
  }
  let lines: ReturnType<typeof normalizeContractLines> = [];
  try { lines = accepted.length ? normalizeContractLines(accepted) : []; } catch (error) { rejected.push({ row: 0, reasons: [error instanceof FinancialControlError ? error.code : "invalid_rows"] }); }
  const total = lines.length ? contractLineTotal(lines) : "0";
  const parsedFingerprint = contractFingerprint({ projectId, budgetSnapshotId, currency, lines, rejected });
  const id = uuid();
  await pool.query(`INSERT INTO financial_contract_import_sessions(id,project_id,company_id,actor_user_id,source_file_id,file_hash,parsed_fingerprint,currency,total,accepted_count,rejected_count,preview,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13) ON CONFLICT(project_id,idempotency_key) DO NOTHING`, [id, projectId, auth.scope.companyId, auth.actor.userId, sourceFileId, fileHash, parsedFingerprint, currency, total, lines.length, rejected.length, JSON.stringify({ budgetSnapshotId, lines, rejected }), idempotencyKey]);
  const stored = (await pool.query(`SELECT * FROM financial_contract_import_sessions WHERE project_id=$1 AND idempotency_key=$2`, [projectId, idempotencyKey])).rows[0];
  if (Number(stored.actor_user_id) !== auth.actor.userId || Number(stored.company_id) !== auth.scope.companyId || Number(stored.source_file_id) !== sourceFileId || stored.file_hash !== fileHash || stored.parsed_fingerprint !== parsedFingerprint || stored.currency !== currency || String(stored.preview.budgetSnapshotId) !== budgetSnapshotId)
    throw new FinancialControlError(409, "CONTRACT_IMPORT_IDEMPOTENCY_CONFLICT", "This idempotency key was already used with different import content.");
  return { id: stored.id, fileHash: stored.file_hash, parsedFingerprint: stored.parsed_fingerprint, currency: stored.currency, total: String(stored.total), acceptedCount: Number(stored.accepted_count), rejectedCount: Number(stored.rejected_count), rejected: stored.preview.rejected, createsContract: false, sourceFile: { id: Number(stored.source_file_id) } };
}

const uuid = () => crypto.randomUUID();

export async function confirmContractImport(input: Omit<CreateContractDraftInput, "lines" | "budgetSnapshotId" | "currency" | "originalValue"> & { sessionId: unknown; fileHash: unknown; parsedFingerprint: unknown; currency: unknown; total: unknown }) {
  await waitForFinancialContractMigration();
  const projectId = positiveId(input.projectId, "projectId"), sessionId = boundedText(input.sessionId, "sessionId", 3, 100);
  const client = await pool.connect(); let locked = false;
  try {
    await client.query(`SELECT pg_advisory_lock(hashtextextended($1,0))`, [`contract-import:${sessionId}`]); locked = true;
    await client.query("BEGIN");
    const row = (await client.query(`SELECT * FROM financial_contract_import_sessions WHERE id=$1 AND project_id=$2 FOR UPDATE`, [sessionId, projectId])).rows[0];
    if (!row) throw new FinancialControlError(404, "CONTRACT_IMPORT_NOT_FOUND", "Contract import preview not found.");
    if (row.confirmed_contract_version_id) { await client.query("COMMIT"); return { contractVersionId: row.confirmed_contract_version_id, idempotent: true }; }
    if (Number(row.rejected_count) > 0) throw new FinancialControlError(409, "CONTRACT_IMPORT_HAS_ERRORS", "Resolve every rejected row before confirmation.");
    if (String(input.fileHash) !== row.file_hash || String(input.parsedFingerprint) !== row.parsed_fingerprint || contractCurrency(input.currency) !== row.currency || exactPositiveAmount(input.total, "total") !== exactPositiveAmount(String(row.total), "total")) throw new FinancialControlError(409, "CONTRACT_IMPORT_CONFIRMATION_MISMATCH", "Confirmation must match the exact preview evidence.");
    const draft = await createContractDraftWithClient({ ...input, projectId, currency: row.currency, originalValue: String(row.total), budgetSnapshotId: row.preview.budgetSnapshotId, lines: row.preview.lines, signedFileId: null }, client);
    await client.query(`UPDATE financial_contract_import_sessions SET confirmed_contract_version_id=$2,confirmed_at=now() WHERE id=$1 AND confirmed_contract_version_id IS NULL`, [sessionId, draft.versionId]);
    await client.query("COMMIT");
    return { contractId: draft.id, contractVersionId: draft.versionId, idempotent: false };
  } catch (error) { try { await client.query("ROLLBACK"); } catch {} throw error; }
  finally { if (locked) await client.query(`SELECT pg_advisory_unlock(hashtextextended($1,0))`, [`contract-import:${sessionId}`]); client.release(); }
}
