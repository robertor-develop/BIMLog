import crypto from "crypto";
import { pool } from "@workspace/db";
import { FinancialControlError } from "./financial-control-contract";
import { authorizeFinancialOperation } from "./financial-control-service";
import { waitForFinancialContractMigration } from "./financial-contract-migration";
import { boundedText, decimalFromScaled, positiveId, scaledSignedDecimal } from "./financial-budget-contract";
import {
  absoluteExact,
  assertReconciledTotal,
  contractCurrency,
  contractFingerprint,
  contractLineTotal,
  contractPermission,
  contractPerspective,
  contractType,
  exactDelta,
  exactPositiveAmount,
  greaterThanZero,
  higherLimitIsStrict,
  normalizeContractLines,
  safeCommercialMetadata,
  type ContractLineInput,
} from "./financial-contract-contract";

type Client = { query: (sql: string, values?: unknown[]) => Promise<{ rows: any[] }> };
const uuid = () => crypto.randomUUID();
const iso = (v: unknown) => new Date(String(v)).toISOString();

async function tx<T>(run: (client: any) => Promise<T>) {
  await waitForFinancialContractMigration();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function history(client: Client, input: {
  companyId: number; projectId: number; contractId: string; contractVersionId?: string;
  amendmentId?: string; amendmentVersionId?: string; actorUserId: number; eventType: string;
  beforeState?: string; afterState?: string; code: string; evidence?: Record<string, unknown>;
}) {
  await client.query(
    `INSERT INTO financial_contract_history(id,company_id,project_id,contract_id,contract_version_id,amendment_id,amendment_version_id,actor_user_id,event_type,before_state,after_state,reason_code,evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
    [uuid(), input.companyId, input.projectId, input.contractId, input.contractVersionId ?? null, input.amendmentId ?? null, input.amendmentVersionId ?? null, input.actorUserId, input.eventType, input.beforeState ?? null, input.afterState ?? null, input.code, JSON.stringify(input.evidence ?? {})],
  );
}

async function contractScope(client: Client, contractId: string, projectId: number, lock = false) {
  const row = (await client.query(
    `SELECT * FROM financial_contracts WHERE id=$1 AND project_id=$2${lock ? " FOR UPDATE" : ""}`,
    [contractId, projectId],
  )).rows[0];
  if (!row) throw new FinancialControlError(404, "CONTRACT_NOT_FOUND", "Financial contract not found.");
  return row;
}

async function requireRecordPermission(client: Client, input: {
  contractId: string; userId: number; permission: "view" | "prepare" | "review" | "approve" | "execute" | "manage";
}) {
  const row = (await client.query(
    `SELECT state FROM financial_contract_record_grants WHERE contract_id=$1 AND user_id=$2 AND permission=$3 ORDER BY version DESC LIMIT 1`,
    [input.contractId, input.userId, input.permission],
  )).rows[0];
  if (!row || row.state !== "active")
    throw new FinancialControlError(403, "CONTRACT_RECORD_ACCESS_DENIED", "Explicit current access to this confidential financial record is required.");
}

async function validatePinnedSnapshot(client: Client, input: {
  projectId: number; companyId: number; snapshotId: string; currency: string; lines: ContractLineInput[];
}) {
  const snapshot = (await client.query(
    `SELECT id,structure_version_id,currency,total FROM approved_budget_snapshots WHERE id=$1 AND project_id=$2 AND company_id=$3 FOR SHARE`,
    [input.snapshotId, input.projectId, input.companyId],
  )).rows[0];
  if (!snapshot || String(snapshot.currency) !== input.currency)
    throw new FinancialControlError(400, "CONTRACT_BUDGET_SNAPSHOT_INVALID", "An approved budget snapshot in the exact contract currency is required.");
  const lineIds = input.lines.map((line) => line.budgetSnapshotLineId);
  const result = await client.query(
    `SELECT l.id,l.project_cost_node_id,l.amount FROM approved_budget_snapshot_lines l WHERE l.snapshot_id=$1 AND l.id=ANY($2::text[])`,
    [input.snapshotId, lineIds],
  );
  const byId = new Map(result.rows.map((row: any) => [String(row.id), row]));
  if (byId.size !== new Set(lineIds).size || input.lines.some((line) => String(byId.get(line.budgetSnapshotLineId)?.project_cost_node_id) !== line.projectCostNodeId))
    throw new FinancialControlError(400, "CONTRACT_SOV_BUDGET_MAPPING_INVALID", "Every SOV line must match one immutable line and cost node in the pinned approved budget snapshot.");
  if (input.lines.some((line) => line.scheduleItemPlacementId != null)) {
    const scheduleIds = input.lines.flatMap((line) => line.scheduleItemPlacementId == null ? [] : [line.scheduleItemPlacementId]);
    const schedule = await client.query(`SELECT id FROM schedule_item_placements WHERE project_id=$1 AND id=ANY($2::integer[])`, [input.projectId, scheduleIds]);
    if (schedule.rows.length !== new Set(scheduleIds).size)
      throw new FinancialControlError(400, "CONTRACT_SCHEDULE_LINK_INVALID", "Schedule relationships must point to canonical items in this project.");
  }
  return { snapshot, structureVersionId: String(snapshot.structure_version_id), budgetLines: byId };
}

async function validateFile(client: Client, projectId: number, value: unknown, required = false) {
  if (value == null || value === "") {
    if (required) throw new FinancialControlError(400, "CONTRACT_SIGNED_FILE_REQUIRED", "Execution requires a controlled signed-document file reference.");
    return null;
  }
  const id = positiveId(value, "signedFileId");
  const file = (await client.query(`SELECT id,file_hash FROM files WHERE id=$1 AND project_id=$2`, [id, projectId])).rows[0];
  if (!file || !file.file_hash) throw new FinancialControlError(400, "CONTRACT_SIGNED_FILE_INVALID", "The signed document must be an authenticated file in this project.");
  return id;
}

async function insertSovLines(client: Client, versionId: string, lines: ContractLineInput[]) {
  for (const line of lines) await client.query(
    `INSERT INTO financial_contract_sov_lines(id,contract_version_id,stable_line_id,budget_snapshot_line_id,project_cost_node_id,schedule_item_placement_id,description,amount,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [uuid(), versionId, line.stableLineId, line.budgetSnapshotLineId, line.projectCostNodeId, line.scheduleItemPlacementId, line.description, line.amount, line.sortOrder],
  );
}

async function insertAmendmentLines(client: Client, versionId: string, lines: ContractLineInput[]) {
  for (const line of lines) await client.query(
    `INSERT INTO financial_contract_amendment_lines(id,amendment_version_id,stable_line_id,budget_snapshot_line_id,project_cost_node_id,schedule_item_placement_id,description,amount_delta,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [uuid(), versionId, line.stableLineId, line.budgetSnapshotLineId, line.projectCostNodeId, line.scheduleItemPlacementId, line.description, line.amount, line.sortOrder],
  );
}

async function addInitialGrants(client: Client, input: { contractId: string; projectId: number; companyId: number; actorUserId: number; grants: unknown }) {
  const requested = Array.isArray(input.grants) ? input.grants : [];
  const normalized = [
    { userId: input.actorUserId, permission: "view" },
    { userId: input.actorUserId, permission: "prepare" },
    ...requested.map((raw: any) => ({ userId: positiveId(raw.userId, "grant.userId"), permission: contractPermission(raw.permission) })),
  ];
  if (normalized.length > 52) throw new FinancialControlError(400, "CONTRACT_GRANT_LIMIT", "No more than 50 initial record grants are accepted.");
  const seen = new Set<string>();
  for (const grant of normalized) {
    const key = `${grant.userId}:${grant.permission}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const member = (await client.query(`SELECT 1 FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=$1 AND pm.user_id=$2 AND pm.status='active' AND u.company_id=$3`, [input.projectId, grant.userId, input.companyId])).rows[0];
    if (!member) throw new FinancialControlError(400, "CONTRACT_GRANTEE_INVALID", "Every record grantee must be a current internal project member in the contract company.");
    await client.query(`INSERT INTO financial_contract_record_grants(id,contract_id,user_id,permission,version,state,reason,granted_by_id) VALUES($1,$2,$3,$4,1,'active','Initial controlled record access',$5)`, [uuid(), input.contractId, grant.userId, grant.permission, input.actorUserId]);
  }
}

export type CreateContractDraftInput = {
  actorUserId: number; projectId: unknown; contractId?: unknown; legalNumber: unknown; perspective: unknown;
  contractType: unknown; counterpartyName: unknown; title: unknown; currency: unknown; originalValue: unknown;
  budgetSnapshotId: unknown; effectiveDate?: unknown; completionDate?: unknown; paymentTerms?: unknown;
  commercialMetadata?: unknown; signedFileId?: unknown; lines: unknown; initialGrants?: unknown;
};

export async function createContractDraft(input: CreateContractDraftInput) {
  return tx((client) => createContractDraftWithClient(input, client));
}

export async function createContractDraftWithClient(input: CreateContractDraftInput, client: Client) {
  const projectId = positiveId(input.projectId, "projectId");
  const perspective = contractPerspective(input.perspective), kind = contractType(input.contractType);
  const legalNumber = boundedText(input.legalNumber, "legalNumber", 1, 100);
  const counterpartyName = boundedText(input.counterpartyName, "counterpartyName", 1, 200);
  const title = boundedText(input.title, "title", 1, 300), currency = contractCurrency(input.currency);
  const originalValue = exactPositiveAmount(input.originalValue, "originalValue");
  const lines = normalizeContractLines(input.lines);
  assertReconciledTotal(lines, originalValue, "the original contract value");
  const budgetSnapshotId = boundedText(input.budgetSnapshotId, "budgetSnapshotId", 3, 100);
  const auth = await authorizeFinancialOperation({ actorUserId: input.actorUserId, projectId, featureKey: "cost.commitment.prepare", operation: "prepare", client });
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`financial-contract:${projectId}:${perspective}:${legalNumber}`]);
  let contractId = input.contractId == null ? uuid() : boundedText(input.contractId, "contractId", 3, 100);
  let root = (await client.query(`SELECT * FROM financial_contracts WHERE id=$1 AND project_id=$2`, [contractId, projectId])).rows[0];
  if (root) {
    await requireRecordPermission(client, { contractId, userId: auth.actor.userId, permission: "prepare" });
    if (root.perspective !== perspective || root.contract_type !== kind || root.legal_number !== legalNumber || root.counterparty_name !== counterpartyName)
      throw new FinancialControlError(409, "CONTRACT_ROOT_IMMUTABLE", "Legal identity, perspective, type, and counterparty are immutable for an existing contract.");
  } else {
    if (input.contractId != null) throw new FinancialControlError(404, "CONTRACT_NOT_FOUND", "Financial contract not found.");
    root = { id: contractId };
    await client.query(`INSERT INTO financial_contracts(id,bimlog_id,company_id,project_id,perspective,contract_type,legal_number,counterparty_name,created_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [contractId, `BIMLOG-CON-${contractId}`, auth.scope.companyId, projectId, perspective, kind, legalNumber, counterpartyName, auth.actor.userId]);
    await addInitialGrants(client, { contractId, projectId, companyId: auth.scope.companyId, actorUserId: auth.actor.userId, grants: input.initialGrants });
  }
  const prior = (await client.query(`SELECT id,version,status FROM financial_contract_versions WHERE contract_id=$1 ORDER BY version DESC LIMIT 1 FOR UPDATE`, [contractId])).rows[0];
  if (prior && !["returned", "rejected", "withdrawn", "superseded", "terminated", "voided", "closed"].includes(prior.status))
    throw new FinancialControlError(409, "CONTRACT_VERSION_STATE_CONFLICT", "A new contract version requires the prior version to be terminal or returned.");
  const pinned = await validatePinnedSnapshot(client, { projectId, companyId: auth.scope.companyId, snapshotId: budgetSnapshotId, currency, lines });
  const signedFileId = await validateFile(client, projectId, input.signedFileId);
  const version = Number(prior?.version ?? 0) + 1, id = uuid();
  const commercialMetadata = safeCommercialMetadata(input.commercialMetadata);
  const contentFingerprint = contractFingerprint({ contractId, version, title, currency, originalValue, budgetSnapshotId, structureVersionId: pinned.structureVersionId, effectiveDate: input.effectiveDate ?? null, completionDate: input.completionDate ?? null, paymentTerms: input.paymentTerms ?? null, commercialMetadata, lines });
  await client.query(`INSERT INTO financial_contract_versions(id,contract_id,version,status,title,currency,original_value,effective_date,completion_date,payment_terms,commercial_metadata,budget_snapshot_id,structure_version_id,signed_file_id,prepared_by_id,content_fingerprint,supersedes_id) VALUES($1,$2,$3,'draft',$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16)`, [id, contractId, version, title, currency, originalValue, input.effectiveDate ?? null, input.completionDate ?? null, input.paymentTerms == null ? null : boundedText(input.paymentTerms, "paymentTerms", 1, 1000), JSON.stringify(commercialMetadata), budgetSnapshotId, pinned.structureVersionId, signedFileId, auth.actor.userId, contentFingerprint, prior?.id ?? null]);
  await insertSovLines(client, id, lines);
  await history(client, { companyId: auth.scope.companyId, projectId, contractId, contractVersionId: id, actorUserId: auth.actor.userId, eventType: "contract_draft_created", afterState: "draft", code: "CONTRACT_DRAFT_CREATED", evidence: { version, contentFingerprint, budgetSnapshotId, structureVersionId: pinned.structureVersionId, currency, originalValue } });
  return { id: contractId, bimlogId: `BIMLOG-CON-${contractId}`, versionId: id, version, status: "draft", contentFingerprint, currency, originalValue };
}

const transitionRules: Record<string, { from: string[]; to: string; operation: "prepare" | "review"; permission: "prepare" | "review"; feature: string; reason: boolean }> = {
  submit: { from: ["draft", "returned"], to: "submitted", operation: "prepare", permission: "prepare", feature: "cost.commitment.prepare", reason: false },
  start_review: { from: ["submitted"], to: "under_review", operation: "review", permission: "review", feature: "cost.commitment.review", reason: false },
  return: { from: ["submitted", "under_review"], to: "returned", operation: "review", permission: "review", feature: "cost.commitment.review", reason: true },
  reject: { from: ["submitted", "under_review"], to: "rejected", operation: "review", permission: "review", feature: "cost.commitment.review", reason: true },
  withdraw: { from: ["submitted"], to: "withdrawn", operation: "prepare", permission: "prepare", feature: "cost.commitment.prepare", reason: true },
};

export async function transitionContract(input: { actorUserId: number; projectId: unknown; contractId: unknown; versionId: unknown; action: unknown; reason?: unknown; expectedRevision: unknown }) {
  const projectId = positiveId(input.projectId, "projectId"), contractId = boundedText(input.contractId, "contractId", 3, 100), versionId = boundedText(input.versionId, "versionId", 3, 100);
  const rule = transitionRules[String(input.action)];
  if (!rule) throw new FinancialControlError(400, "CONTRACT_ACTION_INVALID", "The contract lifecycle action is not recognized.");
  const reason = rule.reason ? boundedText(input.reason, "reason", 3, 1000) : null;
  return tx(async (client) => {
    const root = await contractScope(client, contractId, projectId);
    const row = (await client.query(`SELECT * FROM financial_contract_versions WHERE id=$1 AND contract_id=$2 FOR UPDATE`, [versionId, contractId])).rows[0];
    if (!row) throw new FinancialControlError(404, "CONTRACT_VERSION_NOT_FOUND", "Contract version not found.");
    if (!rule.from.includes(row.status) || Number(input.expectedRevision) !== Number(row.revision)) throw new FinancialControlError(409, "CONTRACT_STALE_VERSION", "The contract changed; reload before continuing.");
    const auth = await authorizeFinancialOperation({ actorUserId: input.actorUserId, projectId, featureKey: rule.feature, operation: rule.operation, makerUserId: Number(row.prepared_by_id), client });
    await requireRecordPermission(client, { contractId, userId: auth.actor.userId, permission: rule.permission });
    const actorSql = String(input.action) === "submit" ? ",submitted_by_id=$4,submitted_at=now()" : String(input.action) === "start_review" ? ",reviewed_by_id=$4,reviewed_at=now()" : "";
    await client.query(`UPDATE financial_contract_versions SET status=$1,outcome_reason=$2,revision=revision+1,updated_at=now()${actorSql} WHERE id=$3`, actorSql ? [rule.to, reason, versionId, auth.actor.userId] : [rule.to, reason, versionId]);
    await history(client, { companyId: Number(root.company_id), projectId, contractId, contractVersionId: versionId, actorUserId: auth.actor.userId, eventType: `contract_${rule.to}`, beforeState: row.status, afterState: rule.to, code: `CONTRACT_${rule.to.toUpperCase()}`, evidence: { reason: reason ? "recorded" : null } });
    return { contractId, versionId, status: rule.to, revision: Number(row.revision) + 1 };
  });
}

async function budgetVariance(client: Client, projectId: number, proposed: ContractLineInput[], excludeVersionId?: string) {
  const ids = [...new Set(proposed.map((line) => line.budgetSnapshotLineId))];
  const budget = await client.query(`SELECT id,amount FROM approved_budget_snapshot_lines WHERE id=ANY($1::text[])`, [ids]);
  const committed = await client.query(`SELECT l.budget_snapshot_line_id,l.amount FROM financial_contract_sov_lines l JOIN financial_contract_versions v ON v.id=l.contract_version_id JOIN financial_contracts c ON c.id=v.contract_id WHERE c.project_id=$1 AND v.status='executed' AND ($2::text IS NULL OR v.id<>$2) UNION ALL SELECT l.budget_snapshot_line_id,l.amount_delta amount FROM financial_contract_amendment_lines l JOIN financial_contract_amendment_versions v ON v.id=l.amendment_version_id JOIN financial_contract_amendments a ON a.id=v.amendment_id JOIN financial_contracts c ON c.id=a.contract_id WHERE c.project_id=$1 AND v.status='executed'`, [projectId, excludeVersionId ?? null]);
  const budgetMap = new Map(budget.rows.map((r: any) => [String(r.id), scaledSignedDecimal(String(r.amount))]));
  const current = new Map<string, bigint>();
  for (const row of committed.rows) current.set(String(row.budget_snapshot_line_id), (current.get(String(row.budget_snapshot_line_id)) ?? 0n) + scaledSignedDecimal(String(row.amount)));
  for (const line of proposed) current.set(line.budgetSnapshotLineId, (current.get(line.budgetSnapshotLineId) ?? 0n) + scaledSignedDecimal(line.amount));
  let over = 0n;
  const variances = ids.map((id) => {
    const value = current.get(id) ?? 0n, limit = budgetMap.get(id) ?? 0n, variance = value - limit;
    if (variance > 0n) over += variance;
    return { budgetSnapshotLineId: id, committed: decimalFromScaled(value), budget: decimalFromScaled(limit), variance: decimalFromScaled(variance) };
  });
  return { overBudgetAmount: decimalFromScaled(over), variances };
}

async function recentRelated(client: Client, input: { projectId: number; makerUserId: number; category: string; currency: string }) {
  const rows = await client.query(`SELECT original_value amount,approved_at created_at FROM financial_contract_versions v JOIN financial_contracts c ON c.id=v.contract_id WHERE c.project_id=$1 AND v.prepared_by_id=$2 AND v.currency=$3 AND v.approved_at>now()-interval '24 hours' UNION ALL SELECT abs(amount_delta) amount,approved_at created_at FROM financial_contract_amendment_versions v JOIN financial_contract_amendments a ON a.id=v.amendment_id JOIN financial_contracts c ON c.id=a.contract_id WHERE c.project_id=$1 AND v.prepared_by_id=$2 AND v.currency=$3 AND v.approved_at>now()-interval '24 hours'`, [input.projectId, input.makerUserId, input.currency]);
  return rows.rows.map((row: any) => ({ makerUserId: input.makerUserId, category: input.category, amount: { amount: exactPositiveAmount(String(row.amount)), currency: input.currency }, createdAt: new Date(row.created_at) }));
}

async function strictHigherPolicy(client: Client, primaryId: string, higherId: string) {
  const rows = await client.query(`SELECT id,max_amount FROM financial_approval_policy_versions WHERE id=ANY($1::text[])`, [[primaryId, higherId]]);
  const by = new Map(rows.rows.map((r: any) => [String(r.id), String(r.max_amount)]));
  if (!by.get(primaryId) || !by.get(higherId) || !higherLimitIsStrict(exactPositiveAmount(by.get(primaryId)), exactPositiveAmount(by.get(higherId))))
    throw new FinancialControlError(403, "CONTRACT_HIGHER_APPROVAL_REQUIRED", "The exception requires a strictly higher scoped approval policy.");
}

export async function approveContract(input: { actorUserId: number; projectId: unknown; contractId: unknown; versionId: unknown; expectedRevision: unknown; confirmationFingerprint: unknown; overBudgetReason?: unknown }) {
  const projectId = positiveId(input.projectId, "projectId"), contractId = boundedText(input.contractId, "contractId", 3, 100), versionId = boundedText(input.versionId, "versionId", 3, 100);
  return tx(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`contract-approval:${versionId}`]);
    const root = await contractScope(client, contractId, projectId);
    const row = (await client.query(`SELECT * FROM financial_contract_versions WHERE id=$1 AND contract_id=$2 FOR UPDATE`, [versionId, contractId])).rows[0];
    if (!row) throw new FinancialControlError(404, "CONTRACT_VERSION_NOT_FOUND", "Contract version not found.");
    const category = root.perspective === "upstream" ? "owner_contract_approval" : "commitment_approval";
    const relatedRequests = await recentRelated(client, { projectId, makerUserId: Number(row.prepared_by_id), category, currency: row.currency });
    const auth = await authorizeFinancialOperation({ actorUserId: input.actorUserId, projectId, featureKey: "cost.commitment.approve", operation: "approve", makerUserId: Number(row.prepared_by_id), category, amount: { amount: exactPositiveAmount(String(row.original_value)), currency: row.currency }, trustedConfirmations: ["confirm_exact_commitment", "confirm_over_budget_exception"], relatedRequests, client });
    await requireRecordPermission(client, { contractId, userId: auth.actor.userId, permission: "approve" });
    if (row.status === "approved" || row.status === "executed") return { contractId, versionId, status: row.status, idempotent: true };
    if (row.status !== "under_review" || Number(input.expectedRevision) !== Number(row.revision) || String(input.confirmationFingerprint) !== String(row.content_fingerprint)) throw new FinancialControlError(409, "CONTRACT_APPROVAL_STALE", "The exact contract approval evidence changed; reload before approval.");
    const lines = (await client.query(`SELECT stable_line_id,budget_snapshot_line_id,project_cost_node_id,schedule_item_placement_id,description,amount,sort_order FROM financial_contract_sov_lines WHERE contract_version_id=$1 ORDER BY sort_order,stable_line_id`, [versionId])).rows.map((r: any) => ({ stableLineId: r.stable_line_id, budgetSnapshotLineId: r.budget_snapshot_line_id, projectCostNodeId: r.project_cost_node_id, scheduleItemPlacementId: r.schedule_item_placement_id == null ? null : Number(r.schedule_item_placement_id), description: r.description, amount: exactPositiveAmount(String(r.amount)), sortOrder: Number(r.sort_order) }));
    if (!auth.decision.policyId) throw new FinancialControlError(403, "FIN_APPROVAL_POLICY_MISSING", "Exact approval-limit evidence is required.");
    const variance = await budgetVariance(client, projectId, lines, versionId);
    let higherPolicyId: string | null = null, reason: string | null = null;
    if (greaterThanZero(variance.overBudgetAmount) || auth.decision.requiresHigherReview) {
      reason = boundedText(input.overBudgetReason, "overBudgetReason", 3, 1000);
      const exceptionAmount = greaterThanZero(variance.overBudgetAmount) ? variance.overBudgetAmount : exactPositiveAmount(String(row.original_value));
      const higher = await authorizeFinancialOperation({ actorUserId: input.actorUserId, projectId, featureKey: "cost.commitment.approve", operation: "approve", makerUserId: Number(row.prepared_by_id), category: greaterThanZero(variance.overBudgetAmount) ? "commitment_over_budget" : "commitment_aggregate_review", amount: { amount: exceptionAmount, currency: row.currency }, trustedConfirmations: ["confirm_exact_commitment", "confirm_over_budget_exception"], client });
      if (!higher.decision.policyId) throw new FinancialControlError(403, "CONTRACT_HIGHER_APPROVAL_REQUIRED", "A higher scoped approval policy is required.");
      await strictHigherPolicy(client, auth.decision.policyId, higher.decision.policyId);
      higherPolicyId = higher.decision.policyId;
    }
    await client.query(`UPDATE financial_contract_versions SET status='approved',approved_by_id=$2,approved_at=now(),over_budget_reason=$3,approval_policy_id=$4,higher_approval_policy_id=$5,revision=revision+1,updated_at=now() WHERE id=$1`, [versionId, auth.actor.userId, reason, auth.decision.policyId, higherPolicyId]);
    await history(client, { companyId: Number(root.company_id), projectId, contractId, contractVersionId: versionId, actorUserId: auth.actor.userId, eventType: "contract_approved", beforeState: row.status, afterState: "approved", code: higherPolicyId ? "CONTRACT_HIGHER_APPROVAL_APPLIED" : "CONTRACT_APPROVED", evidence: { approvalPolicyId: auth.decision.policyId, higherPolicyId, overBudgetAmount: variance.overBudgetAmount, varianceByLine: variance.variances, reasonRecorded: Boolean(reason), contentFingerprint: row.content_fingerprint } });
    return { contractId, versionId, status: "approved", revision: Number(row.revision) + 1, overBudget: greaterThanZero(variance.overBudgetAmount), overBudgetAmount: variance.overBudgetAmount, higherApprovalPolicyId: higherPolicyId };
  });
}

export async function executeContract(input: { actorUserId: number; projectId: unknown; contractId: unknown; versionId: unknown; expectedRevision: unknown; confirmationFingerprint: unknown; signedFileId?: unknown }) {
  const projectId = positiveId(input.projectId, "projectId"), contractId = boundedText(input.contractId, "contractId", 3, 100), versionId = boundedText(input.versionId, "versionId", 3, 100);
  return tx(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`contract-execution:${versionId}`]);
    const root = await contractScope(client, contractId, projectId);
    const row = (await client.query(`SELECT * FROM financial_contract_versions WHERE id=$1 AND contract_id=$2 FOR UPDATE`, [versionId, contractId])).rows[0];
    if (!row) throw new FinancialControlError(404, "CONTRACT_VERSION_NOT_FOUND", "Contract version not found.");
    const category = root.perspective === "upstream" ? "owner_contract_execution" : "commitment_execution";
    const auth = await authorizeFinancialOperation({ actorUserId: input.actorUserId, projectId, featureKey: "cost.commitment.execute", operation: "execute", makerUserId: Number(row.prepared_by_id), category, amount: { amount: exactPositiveAmount(String(row.original_value)), currency: row.currency }, trustedConfirmations: ["confirm_exact_contract_execution"], client });
    await requireRecordPermission(client, { contractId, userId: auth.actor.userId, permission: "execute" });
    if (row.status === "executed") return { contractId, versionId, status: "executed", idempotent: true };
    if (row.status !== "approved" || Number(input.expectedRevision) !== Number(row.revision) || String(input.confirmationFingerprint) !== String(row.content_fingerprint)) throw new FinancialControlError(409, "CONTRACT_EXECUTION_STALE", "The exact execution evidence changed; reload before execution.");
    if (Number(row.approved_by_id) === input.actorUserId) throw new FinancialControlError(403, "CONTRACT_APPROVAL_EXECUTION_SEPARATION", "The contract approver cannot attest execution of the same contract version.");
    const signedFileId = await validateFile(client, projectId, input.signedFileId ?? row.signed_file_id, true);
    if (!auth.decision.policyId) throw new FinancialControlError(403, "FIN_APPROVAL_POLICY_MISSING", "Execution-limit evidence is required.");
    await client.query(`UPDATE financial_contract_versions SET status='executed',executed_by_id=$2,executed_at=now(),signed_file_id=$3,execution_policy_id=$4,revision=revision+1,updated_at=now() WHERE id=$1`, [versionId, auth.actor.userId, signedFileId, auth.decision.policyId]);
    await history(client, { companyId: Number(root.company_id), projectId, contractId, contractVersionId: versionId, actorUserId: auth.actor.userId, eventType: "contract_executed", beforeState: "approved", afterState: "executed", code: "CONTRACT_EXECUTION_ATTESTED", evidence: { executionPolicyId: auth.decision.policyId, signedFileId, contentFingerprint: row.content_fingerprint } });
    return { contractId, versionId, status: "executed", revision: Number(row.revision) + 1, commitmentValue: exactPositiveAmount(String(row.original_value)), currency: row.currency };
  });
}

export async function createContractAmendment(input: { actorUserId: number; projectId: unknown; contractId: unknown; amendmentId?: unknown; legalNumber: unknown; title: unknown; currency: unknown; amountDelta: unknown; budgetSnapshotId: unknown; signedFileId?: unknown; lines: unknown }) {
  const projectId = positiveId(input.projectId, "projectId"), contractId = boundedText(input.contractId, "contractId", 3, 100), legalNumber = boundedText(input.legalNumber, "legalNumber", 1, 100), title = boundedText(input.title, "title", 1, 300), currency = contractCurrency(input.currency), amountDelta = exactDelta(input.amountDelta), lines = normalizeContractLines(input.lines, true);
  assertReconciledTotal(lines, amountDelta, "the amendment delta");
  return tx(async (client) => {
    const root = await contractScope(client, contractId, projectId);
    const auth = await authorizeFinancialOperation({ actorUserId: input.actorUserId, projectId, featureKey: "cost.commitment.prepare", operation: "prepare", client });
    await requireRecordPermission(client, { contractId, userId: auth.actor.userId, permission: "prepare" });
    const executedContract = (await client.query(`SELECT id,currency FROM financial_contract_versions WHERE contract_id=$1 AND status='executed' ORDER BY version DESC LIMIT 1 FOR SHARE`, [contractId])).rows[0];
    if (!executedContract || executedContract.currency !== currency) throw new FinancialControlError(409, "AMENDMENT_CONTRACT_NOT_EXECUTED", "Amendments require an executed contract in the same currency.");
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`financial-amendment:${contractId}:${legalNumber}`]);
    let amendmentId = input.amendmentId == null ? uuid() : boundedText(input.amendmentId, "amendmentId", 3, 100);
    let amendment = (await client.query(`SELECT * FROM financial_contract_amendments WHERE id=$1 AND contract_id=$2`, [amendmentId, contractId])).rows[0];
    if (!amendment) {
      if (input.amendmentId != null) throw new FinancialControlError(404, "AMENDMENT_NOT_FOUND", "Contract amendment not found.");
      await client.query(`INSERT INTO financial_contract_amendments(id,contract_id,bimlog_id,legal_number,created_by_id) VALUES($1,$2,$3,$4,$5)`, [amendmentId, contractId, `BIMLOG-AMD-${amendmentId}`, legalNumber, auth.actor.userId]);
    } else if (amendment.legal_number !== legalNumber) throw new FinancialControlError(409, "AMENDMENT_ROOT_IMMUTABLE", "The legal amendment number is immutable.");
    const prior = (await client.query(`SELECT id,version,status FROM financial_contract_amendment_versions WHERE amendment_id=$1 ORDER BY version DESC LIMIT 1 FOR UPDATE`, [amendmentId])).rows[0];
    if (prior && !["returned", "rejected", "withdrawn", "superseded", "voided"].includes(prior.status)) throw new FinancialControlError(409, "AMENDMENT_VERSION_STATE_CONFLICT", "A new amendment version requires the prior version to be terminal or returned.");
    const budgetSnapshotId = boundedText(input.budgetSnapshotId, "budgetSnapshotId", 3, 100);
    const pinned = await validatePinnedSnapshot(client, { projectId, companyId: Number(root.company_id), snapshotId: budgetSnapshotId, currency, lines });
    const signedFileId = await validateFile(client, projectId, input.signedFileId);
    const version = Number(prior?.version ?? 0) + 1, id = uuid(), fingerprint = contractFingerprint({ amendmentId, version, contractVersionId: executedContract.id, title, currency, amountDelta, budgetSnapshotId, structureVersionId: pinned.structureVersionId, lines });
    await client.query(`INSERT INTO financial_contract_amendment_versions(id,amendment_id,contract_version_id,version,status,title,currency,amount_delta,budget_snapshot_id,structure_version_id,signed_file_id,prepared_by_id,content_fingerprint,supersedes_id) VALUES($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [id, amendmentId, executedContract.id, version, title, currency, amountDelta, budgetSnapshotId, pinned.structureVersionId, signedFileId, auth.actor.userId, fingerprint, prior?.id ?? null]);
    await insertAmendmentLines(client, id, lines);
    await history(client, { companyId: Number(root.company_id), projectId, contractId, amendmentId, amendmentVersionId: id, actorUserId: auth.actor.userId, eventType: "amendment_draft_created", afterState: "draft", code: "AMENDMENT_DRAFT_CREATED", evidence: { version, amountDelta, currency, contentFingerprint: fingerprint } });
    return { amendmentId, bimlogId: `BIMLOG-AMD-${amendmentId}`, versionId: id, version, status: "draft", amountDelta, currency, contentFingerprint: fingerprint };
  });
}

export async function transitionAmendment(input: { actorUserId: number; projectId: unknown; contractId: unknown; amendmentId: unknown; versionId: unknown; action: unknown; reason?: unknown; expectedRevision: unknown }) {
  const projectId = positiveId(input.projectId, "projectId"), contractId = boundedText(input.contractId, "contractId", 3, 100), amendmentId = boundedText(input.amendmentId, "amendmentId", 3, 100), versionId = boundedText(input.versionId, "versionId", 3, 100);
  const rule = transitionRules[String(input.action)];
  if (!rule) throw new FinancialControlError(400, "AMENDMENT_ACTION_INVALID", "The amendment lifecycle action is not recognized.");
  const reason = rule.reason ? boundedText(input.reason, "reason", 3, 1000) : null;
  return tx(async (client) => {
    const root = await contractScope(client, contractId, projectId);
    const row = (await client.query(`SELECT v.* FROM financial_contract_amendment_versions v JOIN financial_contract_amendments a ON a.id=v.amendment_id WHERE v.id=$1 AND a.id=$2 AND a.contract_id=$3 FOR UPDATE`, [versionId, amendmentId, contractId])).rows[0];
    if (!row) throw new FinancialControlError(404, "AMENDMENT_VERSION_NOT_FOUND", "Amendment version not found.");
    if (!rule.from.includes(row.status) || Number(input.expectedRevision) !== Number(row.revision)) throw new FinancialControlError(409, "AMENDMENT_STALE_VERSION", "The amendment changed; reload before continuing.");
    const auth = await authorizeFinancialOperation({ actorUserId: input.actorUserId, projectId, featureKey: rule.feature, operation: rule.operation, makerUserId: Number(row.prepared_by_id), client });
    await requireRecordPermission(client, { contractId, userId: auth.actor.userId, permission: rule.permission });
    const actorSql = String(input.action) === "submit" ? ",submitted_by_id=$4,submitted_at=now()" : String(input.action) === "start_review" ? ",reviewed_by_id=$4,reviewed_at=now()" : "";
    await client.query(`UPDATE financial_contract_amendment_versions SET status=$1,outcome_reason=$2,revision=revision+1,updated_at=now()${actorSql} WHERE id=$3`, actorSql ? [rule.to, reason, versionId, auth.actor.userId] : [rule.to, reason, versionId]);
    await history(client, { companyId: Number(root.company_id), projectId, contractId, amendmentId, amendmentVersionId: versionId, actorUserId: auth.actor.userId, eventType: `amendment_${rule.to}`, beforeState: row.status, afterState: rule.to, code: `AMENDMENT_${rule.to.toUpperCase()}` });
    return { amendmentId, versionId, status: rule.to, revision: Number(row.revision) + 1 };
  });
}

export async function approveAmendment(input: { actorUserId: number; projectId: unknown; contractId: unknown; amendmentId: unknown; versionId: unknown; expectedRevision: unknown; confirmationFingerprint: unknown; overBudgetReason?: unknown }) {
  const projectId = positiveId(input.projectId, "projectId"), contractId = boundedText(input.contractId, "contractId", 3, 100), amendmentId = boundedText(input.amendmentId, "amendmentId", 3, 100), versionId = boundedText(input.versionId, "versionId", 3, 100);
  return tx(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`amendment-approval:${versionId}`]);
    const root = await contractScope(client, contractId, projectId);
    const row = (await client.query(`SELECT v.* FROM financial_contract_amendment_versions v JOIN financial_contract_amendments a ON a.id=v.amendment_id WHERE v.id=$1 AND a.id=$2 AND a.contract_id=$3 FOR UPDATE`, [versionId, amendmentId, contractId])).rows[0];
    if (!row) throw new FinancialControlError(404, "AMENDMENT_VERSION_NOT_FOUND", "Amendment version not found.");
    const amount = absoluteExact(String(row.amount_delta)), category = "commitment_amendment_approval";
    const relatedRequests = await recentRelated(client, { projectId, makerUserId: Number(row.prepared_by_id), category, currency: row.currency });
    const auth = await authorizeFinancialOperation({ actorUserId: input.actorUserId, projectId, featureKey: "cost.commitment.approve", operation: "approve", makerUserId: Number(row.prepared_by_id), category, amount: { amount, currency: row.currency }, trustedConfirmations: ["confirm_exact_commitment", "confirm_over_budget_exception"], relatedRequests, client });
    await requireRecordPermission(client, { contractId, userId: auth.actor.userId, permission: "approve" });
    if (row.status === "approved" || row.status === "executed") return { amendmentId, versionId, status: row.status, idempotent: true };
    if (row.status !== "under_review" || Number(input.expectedRevision) !== Number(row.revision) || String(input.confirmationFingerprint) !== String(row.content_fingerprint)) throw new FinancialControlError(409, "AMENDMENT_APPROVAL_STALE", "The exact amendment approval evidence changed; reload before approval.");
    const lines = (await client.query(`SELECT stable_line_id,budget_snapshot_line_id,project_cost_node_id,schedule_item_placement_id,description,amount_delta amount,sort_order FROM financial_contract_amendment_lines WHERE amendment_version_id=$1 ORDER BY sort_order,stable_line_id`, [versionId])).rows.map((r: any) => ({ stableLineId: r.stable_line_id, budgetSnapshotLineId: r.budget_snapshot_line_id, projectCostNodeId: r.project_cost_node_id, scheduleItemPlacementId: r.schedule_item_placement_id == null ? null : Number(r.schedule_item_placement_id), description: r.description, amount: exactDelta(String(r.amount)), sortOrder: Number(r.sort_order) }));
    if (!auth.decision.policyId) throw new FinancialControlError(403, "FIN_APPROVAL_POLICY_MISSING", "Exact amendment approval-limit evidence is required.");
    const variance = await budgetVariance(client, projectId, lines);
    let higherPolicyId: string | null = null, reason: string | null = null;
    if (greaterThanZero(variance.overBudgetAmount) || auth.decision.requiresHigherReview) {
      reason = boundedText(input.overBudgetReason, "overBudgetReason", 3, 1000);
      const higher = await authorizeFinancialOperation({ actorUserId: input.actorUserId, projectId, featureKey: "cost.commitment.approve", operation: "approve", makerUserId: Number(row.prepared_by_id), category: greaterThanZero(variance.overBudgetAmount) ? "commitment_over_budget" : "commitment_aggregate_review", amount: { amount: greaterThanZero(variance.overBudgetAmount) ? variance.overBudgetAmount : amount, currency: row.currency }, trustedConfirmations: ["confirm_exact_commitment", "confirm_over_budget_exception"], client });
      if (!higher.decision.policyId) throw new FinancialControlError(403, "CONTRACT_HIGHER_APPROVAL_REQUIRED", "A higher scoped approval policy is required.");
      await strictHigherPolicy(client, auth.decision.policyId, higher.decision.policyId);
      higherPolicyId = higher.decision.policyId;
    }
    await client.query(`UPDATE financial_contract_amendment_versions SET status='approved',approved_by_id=$2,approved_at=now(),over_budget_reason=$3,approval_policy_id=$4,higher_approval_policy_id=$5,revision=revision+1,updated_at=now() WHERE id=$1`, [versionId, auth.actor.userId, reason, auth.decision.policyId, higherPolicyId]);
    await history(client, { companyId: Number(root.company_id), projectId, contractId, amendmentId, amendmentVersionId: versionId, actorUserId: auth.actor.userId, eventType: "amendment_approved", beforeState: row.status, afterState: "approved", code: higherPolicyId ? "AMENDMENT_HIGHER_APPROVAL_APPLIED" : "AMENDMENT_APPROVED", evidence: { amountDelta: String(row.amount_delta), overBudgetAmount: variance.overBudgetAmount, approvalPolicyId: auth.decision.policyId, higherPolicyId, reasonRecorded: Boolean(reason) } });
    return { amendmentId, versionId, status: "approved", revision: Number(row.revision) + 1, overBudgetAmount: variance.overBudgetAmount, higherApprovalPolicyId: higherPolicyId };
  });
}

export async function executeAmendment(input: { actorUserId: number; projectId: unknown; contractId: unknown; amendmentId: unknown; versionId: unknown; expectedRevision: unknown; confirmationFingerprint: unknown; signedFileId?: unknown }) {
  const projectId = positiveId(input.projectId, "projectId"), contractId = boundedText(input.contractId, "contractId", 3, 100), amendmentId = boundedText(input.amendmentId, "amendmentId", 3, 100), versionId = boundedText(input.versionId, "versionId", 3, 100);
  return tx(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`amendment-execution:${versionId}`]);
    const root = await contractScope(client, contractId, projectId);
    const row = (await client.query(`SELECT v.* FROM financial_contract_amendment_versions v JOIN financial_contract_amendments a ON a.id=v.amendment_id WHERE v.id=$1 AND a.id=$2 AND a.contract_id=$3 FOR UPDATE`, [versionId, amendmentId, contractId])).rows[0];
    if (!row) throw new FinancialControlError(404, "AMENDMENT_VERSION_NOT_FOUND", "Amendment version not found.");
    const auth = await authorizeFinancialOperation({ actorUserId: input.actorUserId, projectId, featureKey: "cost.commitment.execute", operation: "execute", makerUserId: Number(row.prepared_by_id), category: "commitment_amendment_execution", amount: { amount: absoluteExact(String(row.amount_delta)), currency: row.currency }, trustedConfirmations: ["confirm_exact_contract_execution"], client });
    await requireRecordPermission(client, { contractId, userId: auth.actor.userId, permission: "execute" });
    if (row.status === "executed") return { amendmentId, versionId, status: "executed", idempotent: true };
    if (row.status !== "approved" || Number(input.expectedRevision) !== Number(row.revision) || String(input.confirmationFingerprint) !== String(row.content_fingerprint)) throw new FinancialControlError(409, "AMENDMENT_EXECUTION_STALE", "The exact amendment execution evidence changed; reload before execution.");
    if (Number(row.approved_by_id) === input.actorUserId) throw new FinancialControlError(403, "CONTRACT_APPROVAL_EXECUTION_SEPARATION", "The amendment approver cannot attest execution of the same amendment version.");
    const signedFileId = await validateFile(client, projectId, input.signedFileId ?? row.signed_file_id, true);
    if (!auth.decision.policyId) throw new FinancialControlError(403, "FIN_APPROVAL_POLICY_MISSING", "Execution-limit evidence is required.");
    await client.query(`UPDATE financial_contract_amendment_versions SET status='executed',executed_by_id=$2,executed_at=now(),signed_file_id=$3,execution_policy_id=$4,revision=revision+1,updated_at=now() WHERE id=$1`, [versionId, auth.actor.userId, signedFileId, auth.decision.policyId]);
    await history(client, { companyId: Number(root.company_id), projectId, contractId, amendmentId, amendmentVersionId: versionId, actorUserId: auth.actor.userId, eventType: "amendment_executed", beforeState: "approved", afterState: "executed", code: "AMENDMENT_EXECUTION_ATTESTED", evidence: { executionPolicyId: auth.decision.policyId, signedFileId, amountDelta: String(row.amount_delta) } });
    return { amendmentId, versionId, status: "executed", revision: Number(row.revision) + 1, commitmentDelta: exactDelta(String(row.amount_delta)), currency: row.currency };
  });
}

export async function setContractRecordGrant(input: { actorUserId: number; projectId: unknown; contractId: unknown; userId: unknown; permission: unknown; state: unknown; reason: unknown }) {
  const projectId = positiveId(input.projectId, "projectId"), contractId = boundedText(input.contractId, "contractId", 3, 100), userId = positiveId(input.userId, "userId"), permission = contractPermission(input.permission), state = String(input.state), reason = boundedText(input.reason, "reason", 3, 1000);
  if (!["active", "revoked"].includes(state)) throw new FinancialControlError(400, "CONTRACT_GRANT_STATE_INVALID", "Record grant state must be active or revoked.");
  return tx(async (client) => {
    const root = await contractScope(client, contractId, projectId);
    const auth = await authorizeFinancialOperation({ actorUserId: input.actorUserId, projectId, featureKey: "cost.contract.manage", operation: "manage", client });
    await requireRecordPermission(client, { contractId, userId: auth.actor.userId, permission: "manage" });
    const member = (await client.query(`SELECT 1 FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=$1 AND pm.user_id=$2 AND pm.status='active' AND u.company_id=$3`, [projectId, userId, root.company_id])).rows[0];
    if (!member) throw new FinancialControlError(400, "CONTRACT_GRANTEE_INVALID", "Record access is limited to current internal project members.");
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`contract-grant:${contractId}:${userId}:${permission}`]);
    const prior = (await client.query(`SELECT version,state FROM financial_contract_record_grants WHERE contract_id=$1 AND user_id=$2 AND permission=$3 ORDER BY version DESC LIMIT 1`, [contractId, userId, permission])).rows[0];
    if (prior?.state === state) return { contractId, userId, permission, state, version: Number(prior.version), idempotent: true };
    const version = Number(prior?.version ?? 0) + 1;
    await client.query(`INSERT INTO financial_contract_record_grants(id,contract_id,user_id,permission,version,state,reason,granted_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [uuid(), contractId, userId, permission, version, state, reason, auth.actor.userId]);
    await history(client, { companyId: Number(root.company_id), projectId, contractId, actorUserId: auth.actor.userId, eventType: `contract_record_access_${state}`, code: "CONTRACT_RECORD_GRANT_VERSIONED", evidence: { userId, permission, state, version } });
    return { contractId, userId, permission, state, version, idempotent: false };
  });
}

export async function getContractWorkspace(input: { actorUserId: number; projectId: unknown; contractId?: unknown }) {
  await waitForFinancialContractMigration();
  const projectId = positiveId(input.projectId, "projectId");
  await authorizeFinancialOperation({ actorUserId: input.actorUserId, projectId, featureKey: "cost.commitment.view", operation: "read" });
  const contractId = input.contractId == null ? null : boundedText(input.contractId, "contractId", 3, 100);
  const result = await pool.query(`WITH latest_grants AS (SELECT DISTINCT ON(contract_id,permission) contract_id,permission,state FROM financial_contract_record_grants WHERE user_id=$1 ORDER BY contract_id,permission,version DESC), latest_versions AS (SELECT DISTINCT ON(contract_id) * FROM financial_contract_versions ORDER BY contract_id,version DESC), committed AS (SELECT a.contract_id,COALESCE(sum(v.amount_delta) FILTER(WHERE v.status='executed'),0) amendment_total FROM financial_contract_amendments a LEFT JOIN financial_contract_amendment_versions v ON v.amendment_id=a.id GROUP BY a.contract_id) SELECT c.*,v.id version_id,v.version,v.status,v.title,v.currency,v.original_value,v.content_fingerprint,v.revision,v.budget_snapshot_id,v.structure_version_id,v.approved_at,v.executed_at,COALESCE(committed.amendment_total,0) amendment_total FROM financial_contracts c JOIN latest_versions v ON v.contract_id=c.id LEFT JOIN committed ON committed.contract_id=c.id WHERE c.project_id=$2 AND ($3::text IS NULL OR c.id=$3) AND EXISTS(SELECT 1 FROM latest_grants g WHERE g.contract_id=c.id AND g.permission='view' AND g.state='active') ORDER BY c.created_at DESC`, [input.actorUserId, projectId, contractId]);
  const contracts = result.rows.map((r: any) => ({ id: r.id, bimlogId: r.bimlog_id, perspective: r.perspective, contractType: r.contract_type, legalNumber: r.legal_number, counterpartyName: r.counterparty_name, versionId: r.version_id, version: Number(r.version), status: r.status, title: r.title, currency: r.currency, originalValue: exactPositiveAmount(String(r.original_value)), executedAmendmentTotal: exactDelta(String(r.amendment_total)), currentCommitment: r.status === "executed" ? decimalFromScaled(scaledSignedDecimal(String(r.original_value)) + scaledSignedDecimal(String(r.amendment_total))) : "0", contentFingerprint: r.content_fingerprint, revision: Number(r.revision), budgetSnapshotId: r.budget_snapshot_id, structureVersionId: r.structure_version_id, approvedAt: r.approved_at ? iso(r.approved_at) : null, executedAt: r.executed_at ? iso(r.executed_at) : null }));
  let detail: any = null;
  if (contractId && contracts[0]) {
    const lines = await pool.query(`SELECT l.*,b.project_code,b.project_name,b.amount budget_amount,s.source_type schedule_source_type,s.source_id schedule_source_id FROM financial_contract_sov_lines l JOIN approved_budget_snapshot_lines b ON b.id=l.budget_snapshot_line_id LEFT JOIN schedule_item_placements s ON s.id=l.schedule_item_placement_id WHERE l.contract_version_id=$1 ORDER BY l.sort_order,l.stable_line_id`, [contracts[0].versionId]);
    const amendments = await pool.query(`SELECT a.id,a.bimlog_id,a.legal_number,v.id version_id,v.version,v.status,v.title,v.currency,v.amount_delta,v.content_fingerprint,v.revision,v.approved_at,v.executed_at FROM financial_contract_amendments a JOIN LATERAL(SELECT * FROM financial_contract_amendment_versions WHERE amendment_id=a.id ORDER BY version DESC LIMIT 1)v ON true WHERE a.contract_id=$1 ORDER BY a.created_at`, [contractId]);
    const historyRows = await pool.query(`SELECT event_type,before_state,after_state,reason_code,evidence,occurred_at FROM financial_contract_history WHERE contract_id=$1 ORDER BY occurred_at,id`, [contractId]);
    detail = { ...contracts[0], lines: lines.rows.map((r: any) => ({ stableLineId: r.stable_line_id, budgetSnapshotLineId: r.budget_snapshot_line_id, projectCostNodeId: r.project_cost_node_id, projectCode: r.project_code, projectName: r.project_name, description: r.description, amount: exactPositiveAmount(String(r.amount)), budgetAmount: exactDelta(String(r.budget_amount)), schedule: r.schedule_item_placement_id == null ? null : { placementId: Number(r.schedule_item_placement_id), sourceType: r.schedule_source_type, sourceId: Number(r.schedule_source_id) } })), amendments: amendments.rows.map((r: any) => ({ id: r.id, bimlogId: r.bimlog_id, legalNumber: r.legal_number, versionId: r.version_id, version: Number(r.version), status: r.status, title: r.title, currency: r.currency, amountDelta: exactDelta(String(r.amount_delta)), contentFingerprint: r.content_fingerprint, revision: Number(r.revision), approvedAt: r.approved_at ? iso(r.approved_at) : null, executedAt: r.executed_at ? iso(r.executed_at) : null })), history: historyRows.rows.map((r: any) => ({ eventType: r.event_type, beforeState: r.before_state, afterState: r.after_state, reasonCode: r.reason_code, evidence: r.evidence, occurredAt: iso(r.occurred_at) })) };
  }
  const totals = contracts.reduce((acc, c) => { if (c.status === "executed") acc = acc + scaledSignedDecimal(c.currentCommitment); return acc; }, 0n);
  return { projectId, boundary: { operationalOnly: true, accounting: false, payments: false, externalPortal: false, automaticAi: false }, totals: { executedCommitments: decimalFromScaled(totals), currencies: [...new Set(contracts.map((c) => c.currency))] }, contracts, detail };
}

export async function contractExportData(input: { actorUserId: number; projectId: unknown; contractId: unknown }) {
  const projectId = positiveId(input.projectId, "projectId"), contractId = boundedText(input.contractId, "contractId", 3, 100);
  const auth = await authorizeFinancialOperation({ actorUserId: input.actorUserId, projectId, featureKey: "cost.commitment.export", operation: "export" });
  await requireRecordPermission(pool, { contractId, userId: auth.actor.userId, permission: "view" });
  const workspace = await getContractWorkspace({ actorUserId: input.actorUserId, projectId, contractId });
  if (!workspace.detail) throw new FinancialControlError(404, "CONTRACT_NOT_FOUND", "Financial contract not found.");
  const project = (await pool.query(`SELECT p.name,p.code,c.name company_name FROM projects p JOIN project_company_binding_versions b ON b.project_id=p.id JOIN companies c ON c.id=b.company_id WHERE p.id=$1 ORDER BY b.version DESC LIMIT 1`, [projectId])).rows[0];
  return { project: { name: project.name, code: project.code, companyName: project.company_name }, contract: workspace.detail, generatedAt: new Date().toISOString() };
}
