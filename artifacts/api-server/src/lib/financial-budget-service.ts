import crypto from "crypto";
import { pool } from "@workspace/db";
import { FinancialControlError } from "./financial-control-contract";
import { authorizeFinancialOperation } from "./financial-control-service";
import { waitForFinancialBudgetMigration } from "./financial-budget-migration";
import {
  boundedText,
  budgetCurrency,
  canonicalFingerprint,
  decimalFromScaled,
  exactApprovalExposure,
  exactSignedDecimal,
  exactTotal,
  normalizeBudgetLines,
  positiveId,
  scaledSignedDecimal,
  validateHierarchy,
  type BudgetLineInput,
} from "./financial-budget-contract";

type Client = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: any[] }>;
};
const uuid = () => crypto.randomUUID();
const iso = (v: unknown) => new Date(String(v)).toISOString();
async function audit(
  client: Client,
  input: {
    eventType: string;
    companyId: number;
    projectId: number | null;
    actorUserId: number;
    entityType: string;
    entityId: string;
    version?: number;
    code: string;
    evidence?: Record<string, unknown>;
  },
) {
  await client.query(
    `INSERT INTO financial_authority_journal(id,event_type,company_id,project_id,actor_user_id,entity_type,entity_id,entity_version,decision,reason_code,explanation_en,explanation_es,evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'allow',$9,$10,$11,$12::jsonb)`,
    [
      uuid(),
      input.eventType,
      input.companyId,
      input.projectId,
      input.actorUserId,
      input.entityType,
      input.entityId,
      input.version ?? null,
      input.code,
      `Controlled ${input.eventType} recorded.`,
      `Se registró ${input.eventType} controlado.`,
      JSON.stringify(input.evidence ?? {}),
    ],
  );
}
async function tx<T>(run: (client: any) => Promise<T>): Promise<T> {
  await waitForFinancialBudgetMigration();
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
function libraryNodes(raw: unknown) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 10000)
    throw new FinancialControlError(
      400,
      "COST_NODES_INVALID",
      "One to 10,000 cost nodes are required.",
    );
  const nodes = raw.map((x, index) => {
    const r = x as Record<string, unknown>;
    return {
      stableNodeId: boundedText(r.stableNodeId, "stableNodeId", 3, 100),
      parentStableNodeId:
        r.parentStableNodeId == null
          ? null
          : boundedText(r.parentStableNodeId, "parentStableNodeId", 3, 100),
      code: boundedText(r.code, "code", 1, 80),
      name: boundedText(r.name, "name", 1, 200),
      description:
        r.description == null
          ? null
          : boundedText(r.description, "description", 1, 1000),
      active: r.active !== false,
      sortOrder: Number.isSafeInteger(Number(r.sortOrder))
        ? Number(r.sortOrder)
        : index,
      wbs: r.wbs == null ? null : boundedText(r.wbs, "wbs", 1, 100),
      csi: r.csi == null ? null : boundedText(r.csi, "csi", 1, 100),
      schedule:
        r.schedule == null ? null : boundedText(r.schedule, "schedule", 1, 100),
      externalProfile:
        r.externalProfile == null
          ? null
          : boundedText(r.externalProfile, "externalProfile", 1, 100),
      effectiveFrom: String(
        r.effectiveFrom ?? new Date().toISOString().slice(0, 10),
      ),
      effectiveTo: r.effectiveTo == null ? null : String(r.effectiveTo),
      deprecationReason:
        r.deprecationReason == null
          ? null
          : boundedText(r.deprecationReason, "deprecationReason", 3, 500),
    };
  });
  validateHierarchy(nodes);
  return nodes;
}

export async function createCompanyCostLibrary(input: {
  actorUserId: number;
  projectId: unknown;
  libraryId?: unknown;
  reason: unknown;
  effectiveDate?: unknown;
  nodes: unknown;
}) {
  const projectId = positiveId(input.projectId, "projectId"),
    nodes = libraryNodes(input.nodes),
    reason = boundedText(input.reason, "reason", 3, 1000);
  return tx(async (client) => {
    const auth = await authorizeFinancialOperation({
      actorUserId: input.actorUserId,
      projectId,
      featureKey: "cost.structure.manage",
      operation: "manage",
      client,
    });
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [
      `cost-library:${auth.scope.companyId}`,
    ]);
    const libraryId =
      input.libraryId == null
        ? uuid()
        : boundedText(input.libraryId, "libraryId", 3, 100);
    const prior = await client.query(
      `SELECT id,version FROM company_cost_library_versions WHERE library_id=$1 AND company_id=$2 ORDER BY version DESC LIMIT 1`,
      [libraryId, auth.scope.companyId],
    );
    const version = Number(prior.rows[0]?.version ?? 0) + 1;
    const content = {
      libraryId,
      version,
      companyId: auth.scope.companyId,
      nodes,
    };
    const fingerprint = canonicalFingerprint(content),
      id = uuid();
    await client.query(
      `INSERT INTO company_cost_library_versions(id,library_id,company_id,version,effective_date,status,reason,content_fingerprint,supersedes_id,created_by_id,reviewed_by_id,approved_by_id,reviewed_at,approved_at) VALUES($1,$2,$3,$4,$5,'approved',$6,$7,$8,$9,$9,$9,now(),now())`,
      [
        id,
        libraryId,
        auth.scope.companyId,
        version,
        input.effectiveDate ?? new Date(),
        reason,
        fingerprint,
        prior.rows[0]?.id ?? null,
        auth.actor.userId,
      ],
    );
    for (const node of nodes)
      await client.query(
        `INSERT INTO company_cost_nodes(id,library_version_id,stable_node_id,parent_stable_node_id,hierarchical_path,company_code,name,description,active,sort_order,wbs_mapping,csi_mapping,schedule_activity_mapping,external_mapping_profile_ref,effective_from,effective_to,deprecation_reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          uuid(),
          id,
          node.stableNodeId,
          node.parentStableNodeId,
          buildPath(node.stableNodeId, nodes),
          node.code,
          node.name,
          node.description,
          node.active,
          node.sortOrder,
          node.wbs,
          node.csi,
          node.schedule,
          node.externalProfile,
          node.effectiveFrom,
          node.effectiveTo,
          node.deprecationReason,
        ],
      );
    await audit(client, {
      eventType: "company_library_version_approved",
      companyId: auth.scope.companyId,
      projectId: null,
      actorUserId: auth.actor.userId,
      entityType: "company_cost_library",
      entityId: id,
      version,
      code: "COST_LIBRARY_APPROVED",
      evidence: {
        contentFingerprint: fingerprint,
        changedFields: ["nodes"],
        supersedesId: prior.rows[0]?.id ?? null,
      },
    });
    return {
      id,
      libraryId,
      version,
      status: "approved",
      contentFingerprint: fingerprint,
    };
  });
}
function buildPath(id: string, nodes: ReturnType<typeof libraryNodes>) {
  const by = new Map(nodes.map((n) => [n.stableNodeId, n]));
  const parts: string[] = [];
  let current = by.get(id);
  while (current) {
    parts.unshift(current.code);
    current = current.parentStableNodeId
      ? by.get(current.parentStableNodeId)
      : undefined;
  }
  return parts.join("/");
}

export async function createProjectCostStructure(input: {
  actorUserId: number;
  projectId: unknown;
  libraryVersionId: unknown;
  structureId?: unknown;
  reason: unknown;
  nodes?: unknown;
}) {
  const projectId = positiveId(input.projectId, "projectId"),
    libraryVersionId = boundedText(
      input.libraryVersionId,
      "libraryVersionId",
      3,
      100,
    ),
    reason = boundedText(input.reason, "reason", 3, 1000);
  return tx(async (client) => {
    const auth = await authorizeFinancialOperation({
      actorUserId: input.actorUserId,
      projectId,
      featureKey: "cost.structure.manage",
      operation: "manage",
      client,
    });
    const library = (
      await client.query(
        `SELECT * FROM company_cost_library_versions WHERE id=$1 AND status='approved' FOR SHARE`,
        [libraryVersionId],
      )
    ).rows[0];
    if (!library || Number(library.company_id) !== auth.scope.companyId)
      throw new FinancialControlError(
        403,
        "COST_LIBRARY_SCOPE_DENIED",
        "Only an approved library from the project's company can be pinned.",
      );
    const companyNodes = (
      await client.query(
        `SELECT * FROM company_cost_nodes WHERE library_version_id=$1 ORDER BY hierarchical_path,sort_order`,
        [libraryVersionId],
      )
    ).rows;
    const mapped = Array.isArray(input.nodes)
      ? (input.nodes as any[])
      : companyNodes.map((n: any) => ({
          stableProjectNodeId: n.stable_node_id,
          companyStableNodeId: n.stable_node_id,
          parentProjectNodeId: n.parent_stable_node_id,
          code: n.company_code,
          name: n.name,
          description: n.description,
          active: n.active,
          sortOrder: n.sort_order,
          wbs: n.wbs_mapping,
          csi: n.csi_mapping,
          schedule: n.schedule_activity_mapping,
          provenance: "company_library",
        }));
    const validation = validateProjectNodes(mapped, companyNodes);
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [
      `project-cost-structure:${projectId}`,
    ]);
    const structureId =
      input.structureId == null
        ? uuid()
        : boundedText(input.structureId, "structureId", 3, 100);
    const prior = await client.query(
      `SELECT id,version FROM project_cost_structure_versions WHERE structure_id=$1 AND project_id=$2 ORDER BY version DESC LIMIT 1`,
      [structureId, projectId],
    );
    const version = Number(prior.rows[0]?.version ?? 0) + 1,
      id = uuid(),
      fingerprint = canonicalFingerprint({
        projectId,
        libraryVersionId,
        version,
        nodes: mapped,
      });
    await client.query(
      `INSERT INTO project_cost_structure_versions(id,structure_id,project_id,company_id,library_version_id,version,status,reason,validation_fingerprint,content_fingerprint,supersedes_id,created_by_id,reviewed_by_id,approved_by_id,approved_at) VALUES($1,$2,$3,$4,$5,$6,'approved',$7,$8,$9,$10,$11,$11,$11,now())`,
      [
        id,
        structureId,
        projectId,
        auth.scope.companyId,
        libraryVersionId,
        version,
        reason,
        validation,
        fingerprint,
        prior.rows[0]?.id ?? null,
        auth.actor.userId,
      ],
    );
    for (const n of mapped)
      await client.query(
        `INSERT INTO project_cost_nodes(id,structure_version_id,stable_project_node_id,company_stable_node_id,company_library_version_id,parent_project_node_id,project_code,project_name,description,wbs_mapping,schedule_activity_ref,csi_mapping,active,sort_order,effective_from,mapping_provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,current_date,$15)`,
        [
          uuid(),
          id,
          String(n.stableProjectNodeId),
          String(n.companyStableNodeId),
          libraryVersionId,
          n.parentProjectNodeId ?? null,
          boundedText(n.code, "code", 1, 80),
          boundedText(n.name, "name", 1, 200),
          n.description ?? null,
          n.wbs ?? null,
          n.schedule ?? null,
          n.csi ?? null,
          n.active !== false,
          Number(n.sortOrder ?? 0),
          boundedText(n.provenance ?? "company_library", "provenance", 1, 200),
        ],
      );
    await audit(client, {
      eventType: "project_structure_pinned",
      companyId: auth.scope.companyId,
      projectId,
      actorUserId: auth.actor.userId,
      entityType: "project_cost_structure",
      entityId: id,
      version,
      code: "PROJECT_STRUCTURE_APPROVED",
      evidence: {
        libraryVersionId,
        validationFingerprint: validation,
        contentFingerprint: fingerprint,
        previousStructureVersionId: prior.rows[0]?.id ?? null,
      },
    });
    return {
      id,
      structureId,
      version,
      libraryVersionId,
      status: "approved",
      contentFingerprint: fingerprint,
    };
  });
}
function validateProjectNodes(nodes: any[], companyNodes: any[]) {
  const companyIds = new Set(companyNodes.map((n) => String(n.stable_node_id)));
  const normalized = nodes.map((n, index) => ({
    stableNodeId: boundedText(
      n.stableProjectNodeId,
      "stableProjectNodeId",
      3,
      100,
    ),
    parentStableNodeId:
      n.parentProjectNodeId == null
        ? null
        : boundedText(n.parentProjectNodeId, "parentProjectNodeId", 3, 100),
    code: boundedText(n.code, "code", 1, 80),
    sortOrder: Number(n.sortOrder ?? index),
    active: n.active !== false,
  }));
  validateHierarchy(normalized);
  for (const n of nodes)
    if (!companyIds.has(String(n.companyStableNodeId)))
      throw new FinancialControlError(
        400,
        "PROJECT_COST_MAPPING_INVALID",
        "Every project node must map to the pinned company-library version.",
      );
  return canonicalFingerprint(normalized);
}

export type CreateBudgetDraftInput = {
  actorUserId: number;
  projectId: unknown;
  structureVersionId: unknown;
  budgetId?: unknown;
  currency: unknown;
  purpose: unknown;
  lines: unknown;
  sourceFileId?: unknown;
};

export async function createBudgetDraft(input: CreateBudgetDraftInput) {
  return tx((client) => createBudgetDraftWithClient(input, client));
}

export async function createBudgetDraftWithClient(
  input: CreateBudgetDraftInput,
  client: Client,
) {
  const projectId = positiveId(input.projectId, "projectId"),
    structureVersionId = boundedText(
      input.structureVersionId,
      "structureVersionId",
      3,
      100,
    ),
    currency = budgetCurrency(input.currency),
    purpose = boundedText(input.purpose, "purpose", 3, 1000),
    lines = normalizeBudgetLines(input.lines),
    total = exactTotal(lines);
  const auth = await authorizeFinancialOperation({
      actorUserId: input.actorUserId,
      projectId,
      featureKey: "cost.budget.prepare",
      operation: "prepare",
      client,
    });
    const structure = (
      await client.query(
        `SELECT id,company_id,status FROM project_cost_structure_versions WHERE id=$1 AND project_id=$2 FOR SHARE`,
        [structureVersionId, projectId],
      )
    ).rows[0];
    if (
      !structure ||
      structure.status !== "approved" ||
      Number(structure.company_id) !== auth.scope.companyId
    )
      throw new FinancialControlError(
        400,
        "BUDGET_STRUCTURE_INVALID",
        "The budget must pin an approved structure from the same project and company.",
      );
    await validateLineNodes(client, structureVersionId, lines);
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [
      `budget:${projectId}:${String(input.budgetId ?? "new")}`,
    ]);
    const budgetId =
      input.budgetId == null
        ? uuid()
        : boundedText(input.budgetId, "budgetId", 3, 100);
    const prior = await client.query(
      `SELECT version FROM project_budget_versions WHERE budget_id=$1 AND project_id=$2 ORDER BY version DESC LIMIT 1`,
      [budgetId, projectId],
    );
    const version = Number(prior.rows[0]?.version ?? 0) + 1,
      id = uuid(),
      fingerprint = canonicalFingerprint({
        budgetId,
        version,
        projectId,
        structureVersionId,
        currency,
        lines,
      });
    let sourceFileId: null | number = null;
    if (input.sourceFileId != null) {
      sourceFileId = positiveId(input.sourceFileId, "sourceFileId");
      const file = (
        await client.query(
          `SELECT id FROM files WHERE id=$1 AND project_id=$2`,
          [sourceFileId, projectId],
        )
      ).rows[0];
      if (!file)
        throw new FinancialControlError(
          400,
          "BUDGET_SOURCE_FILE_INVALID",
          "The source file must be an authenticated file in this project.",
        );
    }
    await client.query(
      `INSERT INTO project_budget_versions(id,budget_id,project_id,company_id,structure_version_id,version,currency,status,purpose,prepared_by_id,content_fingerprint,calculated_total,source_file_id) VALUES($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9,$10,$11,$12)`,
      [
        id,
        budgetId,
        projectId,
        auth.scope.companyId,
        structureVersionId,
        version,
        currency,
        purpose,
        auth.actor.userId,
        fingerprint,
        total,
        sourceFileId,
      ],
    );
    for (const line of lines) await insertLine(client, id, line);
    await audit(client, {
      eventType: sourceFileId
        ? "budget_draft_imported"
        : "budget_draft_created",
      companyId: auth.scope.companyId,
      projectId,
      actorUserId: auth.actor.userId,
      entityType: "project_budget",
      entityId: id,
      version,
      code: "BUDGET_DRAFT_CREATED",
      evidence: {
        structureVersionId,
        currency,
        total,
        contentFingerprint: fingerprint,
        sourceFileId,
      },
    });
  return {
    id,
    budgetId,
    version,
    status: "draft",
    currency,
    total,
    contentFingerprint: fingerprint,
  };
}
async function validateLineNodes(
  client: Client,
  structureVersionId: string,
  lines: BudgetLineInput[],
) {
  const ids = lines.map((l) => l.projectCostNodeId);
  const r = await client.query(
    `SELECT id,active FROM project_cost_nodes WHERE structure_version_id=$1 AND id=ANY($2::text[])`,
    [structureVersionId, ids],
  );
  if (
    r.rows.length !== new Set(ids).size ||
    r.rows.some((x) => x.active !== true)
  )
    throw new FinancialControlError(
      400,
      "BUDGET_COST_NODE_INVALID",
      "Every budget line must use an active node from the pinned project structure.",
    );
}
async function insertLine(
  client: Client,
  budgetVersionId: string,
  line: BudgetLineInput,
) {
  await client.query(
    `INSERT INTO project_budget_lines(id,budget_version_id,stable_line_id,project_cost_node_id,description,amount,quantity,unit,unit_rate,notes,provenance,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      uuid(),
      budgetVersionId,
      line.stableLineId,
      line.projectCostNodeId,
      line.description,
      line.amount,
      line.quantity,
      line.unit,
      line.unitRate,
      line.notes,
      line.provenance,
      line.sortOrder,
    ],
  );
}

export async function transitionBudget(input: {
  actorUserId: number;
  projectId: unknown;
  budgetVersionId: unknown;
  action: unknown;
  reason?: unknown;
  expectedRevision?: unknown;
}) {
  const projectId = positiveId(input.projectId, "projectId"),
    budgetVersionId = boundedText(
      input.budgetVersionId,
      "budgetVersionId",
      3,
      100,
    ),
    action = String(input.action),
    map: Record<
      string,
      { from: string[]; to: string; operation: "prepare" | "review" }
    > = {
      submit: { from: ["draft"], to: "submitted", operation: "prepare" },
      start_review: {
        from: ["submitted"],
        to: "under_review",
        operation: "review",
      },
      return: {
        from: ["submitted", "under_review"],
        to: "returned",
        operation: "review",
      },
      reject: {
        from: ["submitted", "under_review"],
        to: "rejected",
        operation: "review",
      },
      withdraw: { from: ["submitted"], to: "withdrawn", operation: "prepare" },
    };
  const rule = map[action];
  if (!rule)
    throw new FinancialControlError(
      400,
      "BUDGET_ACTION_INVALID",
      "The budget lifecycle action is not recognized.",
    );
  const reason = ["return", "reject", "withdraw"].includes(action)
    ? boundedText(input.reason, "reason", 3, 1000)
    : null;
  return tx(async (client) => {
    const row = (
      await client.query(
        `SELECT * FROM project_budget_versions WHERE id=$1 AND project_id=$2 FOR UPDATE`,
        [budgetVersionId, projectId],
      )
    ).rows[0];
    if (!row)
      throw new FinancialControlError(
        404,
        "BUDGET_NOT_FOUND",
        "Budget version not found.",
      );
    if (!rule.from.includes(row.status))
      throw new FinancialControlError(
        409,
        "BUDGET_STATE_CONFLICT",
        "The budget status changed; reload before continuing.",
      );
    if (
      input.expectedRevision != null &&
      Number(input.expectedRevision) !== Number(row.revision)
    )
      throw new FinancialControlError(
        409,
        "BUDGET_STALE_VERSION",
        "The budget changed; reload before continuing.",
      );
    const auth = await authorizeFinancialOperation({
      actorUserId: input.actorUserId,
      projectId,
      featureKey:
        rule.operation === "prepare"
          ? "cost.budget.prepare"
          : "cost.budget.review",
      operation: rule.operation,
      makerUserId: Number(row.prepared_by_id),
      client,
    });
    const actorSet =
      action === "submit"
        ? `,submitted_by_id=$3,submitted_at=now()`
        : action === "start_review"
          ? `,reviewed_by_id=$3,reviewed_at=now()`
          : ``;
    await client.query(
      `UPDATE project_budget_versions SET status=$1,outcome_reason=$2,revision=revision+1,updated_at=now()${actorSet} WHERE id=${actorSet ? "$4" : "$3"}`,
      actorSet
        ? [rule.to, reason, auth.actor.userId, budgetVersionId]
        : [rule.to, reason, budgetVersionId],
    );
    await audit(client, {
      eventType: `budget_${rule.to}`,
      companyId: auth.scope.companyId,
      projectId,
      actorUserId: auth.actor.userId,
      entityType: "project_budget",
      entityId: budgetVersionId,
      version: Number(row.version),
      code: `BUDGET_${rule.to.toUpperCase()}`,
      evidence: {
        beforeStatus: row.status,
        afterStatus: rule.to,
        changedFields: ["status", ...(reason ? ["outcome_reason"] : [])],
      },
    });
    return {
      id: budgetVersionId,
      status: rule.to,
      revision: Number(row.revision) + 1,
    };
  });
}

export async function approveBudget(input: {
  actorUserId: number;
  projectId: unknown;
  budgetVersionId: unknown;
  expectedRevision: unknown;
  confirmationFingerprint: unknown;
}) {
  const projectId = positiveId(input.projectId, "projectId"),
    budgetVersionId = boundedText(
      input.budgetVersionId,
      "budgetVersionId",
      3,
      100,
    );
  return tx(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [
      `budget-approval:${budgetVersionId}`,
    ]);
    const row = (
      await client.query(
        `SELECT * FROM project_budget_versions WHERE id=$1 AND project_id=$2 FOR UPDATE`,
        [budgetVersionId, projectId],
      )
    ).rows[0];
    if (!row)
      throw new FinancialControlError(
        404,
        "BUDGET_NOT_FOUND",
        "Budget version not found.",
      );
    if (row.status === "approved") {
      const existing = (
        await client.query(
          `SELECT * FROM approved_budget_snapshots WHERE budget_version_id=$1`,
          [budgetVersionId],
        )
      ).rows[0];
      return snapshotResponse(existing, true);
    }
    if (row.status !== "under_review")
      throw new FinancialControlError(
        409,
        "BUDGET_APPROVAL_STATE_INVALID",
        "Only a budget under review may be approved.",
      );
    if (Number(input.expectedRevision) !== Number(row.revision))
      throw new FinancialControlError(
        409,
        "BUDGET_STALE_VERSION",
        "The budget changed; reload before approval.",
      );
    if (
      String(input.confirmationFingerprint) !== String(row.content_fingerprint)
    )
      throw new FinancialControlError(
        409,
        "BUDGET_CONFIRMATION_STALE",
        "The exact approval confirmation no longer matches the budget.",
      );
    const previous = (
      await client.query(
        `SELECT * FROM project_budget_versions WHERE project_id=$1 AND status='approved' ORDER BY approved_at DESC LIMIT 1 FOR SHARE`,
        [projectId],
      )
    ).rows[0];
    const category = previous ? "budget_revision" : "original_budget";
    const lines = (
      await client.query(
        `SELECT l.*,n.project_code,n.project_name,n.stable_project_node_id,n.parent_project_node_id FROM project_budget_lines l JOIN project_cost_nodes n ON n.id=l.project_cost_node_id WHERE l.budget_version_id=$1 ORDER BY l.sort_order,l.stable_line_id`,
        [budgetVersionId],
      )
    ).rows;
    const approvalExposure = exactApprovalExposure(
      lines.map((line: any) => ({ amount: String(line.amount) })),
    );
    const auth = await authorizeFinancialOperation({
      actorUserId: input.actorUserId,
      projectId,
      featureKey: "cost.budget.approve",
      operation: "approve",
      makerUserId: Number(row.prepared_by_id),
      category,
      amount: {
        amount: approvalExposure,
        currency: String(row.currency),
      },
      trustedConfirmations: ["confirm_exact_budget"],
      client,
    });
    if (!auth.decision.policyId)
      throw new FinancialControlError(
        403,
        "FIN_APPROVAL_POLICY_MISSING",
        "Approval-limit evidence is required.",
      );
    const policy = (
      await client.query(
        `SELECT max_amount FROM financial_approval_policy_versions WHERE id=$1`,
        [auth.decision.policyId],
      )
    ).rows[0];
    const original = (
      await client.query(
        `SELECT s.total FROM approved_budget_snapshots s JOIN project_budget_versions b ON b.id=s.budget_version_id WHERE b.project_id=$1 ORDER BY b.approved_at LIMIT 1`,
        [projectId],
      )
    ).rows[0];
    const originalTotal = String(original?.total ?? row.calculated_total),
      difference = decimalFromScaled(
        scaledSignedDecimal(String(row.calculated_total)) -
          scaledSignedDecimal(originalTotal),
      );
    const structureNodes = (
      await client.query(
        `SELECT stable_project_node_id,parent_project_node_id,project_code,project_name FROM project_cost_nodes WHERE structure_version_id=$1`,
        [row.structure_version_id],
      )
    ).rows;
    const nodeByStableId = new Map(
      structureNodes.map((node: any) => [String(node.stable_project_node_id), node]),
    );
    const hierarchicalPath = (stableNodeId: unknown) => {
      const labels: string[] = [];
      const visited = new Set<string>();
      let cursor = stableNodeId == null ? null : String(stableNodeId);
      while (cursor) {
        if (visited.has(cursor))
          throw new FinancialControlError(
            409,
            "COST_STRUCTURE_HIERARCHY_INVALID",
            "The pinned cost structure contains a hierarchy cycle.",
          );
        visited.add(cursor);
        const node: any = nodeByStableId.get(cursor);
        if (!node) break;
        labels.unshift(`${node.project_code} — ${node.project_name}`);
        cursor = node.parent_project_node_id
          ? String(node.parent_project_node_id)
          : null;
      }
      return labels.join(" / ");
    };
    const snapshotContent = {
      budgetId: row.budget_id,
      budgetVersion: Number(row.version),
      projectId,
      companyId: Number(row.company_id),
      structureVersionId: row.structure_version_id,
      currency: row.currency,
      total: String(row.calculated_total),
      lines: lines.map((l: any) => ({
        stableLineId: l.stable_line_id,
        projectCostNodeId: l.project_cost_node_id,
        projectCode: l.project_code,
        projectName: l.project_name,
        hierarchicalPath: hierarchicalPath(l.stable_project_node_id),
        description: l.description,
        amount: String(l.amount),
        quantity: l.quantity == null ? null : String(l.quantity),
        unit: l.unit,
        unitRate: l.unit_rate == null ? null : String(l.unit_rate),
        notes: l.notes,
        sortOrder: Number(l.sort_order),
      })),
    };
    const snapshotId = uuid(),
      snapshotFingerprint = canonicalFingerprint(snapshotContent);
    await client.query(
      `INSERT INTO approved_budget_snapshots(id,budget_version_id,budget_id,budget_version,project_id,company_id,structure_version_id,currency,total,original_total,current_total,difference_from_original,approved_by_id,approved_at,approval_policy_id,approval_limit,content_fingerprint,snapshot_fingerprint,previous_snapshot_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$9,$11,$12,now(),$13,$14,$15,$16,$17)`,
      [
        snapshotId,
        budgetVersionId,
        row.budget_id,
        row.version,
        projectId,
        row.company_id,
        row.structure_version_id,
        row.currency,
        row.calculated_total,
        originalTotal,
        difference,
        auth.actor.userId,
        auth.decision.policyId,
        policy.max_amount,
        row.content_fingerprint,
        snapshotFingerprint,
        previous?.approved_snapshot_id ?? null,
      ],
    );
    for (const l of snapshotContent.lines)
      await client.query(
        `INSERT INTO approved_budget_snapshot_lines(id,snapshot_id,stable_line_id,project_cost_node_id,project_code,project_name,hierarchical_path,description,amount,quantity,unit,unit_rate,notes,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          uuid(),
          snapshotId,
          l.stableLineId,
          l.projectCostNodeId,
          l.hierarchicalPath,
          l.projectName,
          l.projectCode,
          l.description,
          l.amount,
          l.quantity,
          l.unit,
          l.unitRate,
          l.notes,
          l.sortOrder,
        ],
      );
    await audit(client, {
      eventType: "budget_snapshot_created",
      companyId: auth.scope.companyId,
      projectId,
      actorUserId: auth.actor.userId,
      entityType: "approved_budget_snapshot",
      entityId: snapshotId,
      version: Number(row.version),
      code: auth.decision.code,
      evidence: {
        contentFingerprint: row.content_fingerprint,
        snapshotFingerprint,
        approvalPolicyId: auth.decision.policyId,
        approvalLimit: String(policy.max_amount),
        approvalExposure,
        matchedGrantIds: auth.decision.matchedGrantIds,
        previousSnapshotId: previous?.approved_snapshot_id ?? null,
      },
    });
    await client.query(
      `UPDATE project_budget_versions SET status='approved',approved_by_id=$2,approved_at=now(),approved_snapshot_id=$3,previous_approved_id=$4,revision=revision+1,updated_at=now() WHERE id=$1`,
      [budgetVersionId, auth.actor.userId, snapshotId, previous?.id ?? null],
    );
    return {
      id: snapshotId,
      budgetVersionId,
      status: "approved",
      contentFingerprint: row.content_fingerprint,
      snapshotFingerprint,
      originalTotal,
      currentTotal: String(row.calculated_total),
      differenceFromOriginal: difference,
      idempotent: false,
    };
  });
}
function snapshotResponse(row: any, idempotent = false) {
  return {
    id: String(row.id),
    budgetVersionId: String(row.budget_version_id),
    status: "approved",
    contentFingerprint: String(row.content_fingerprint),
    snapshotFingerprint: String(row.snapshot_fingerprint),
    originalTotal: String(row.original_total),
    currentTotal: String(row.current_total),
    differenceFromOriginal: String(row.difference_from_original),
    idempotent,
  };
}

export async function getFinancialBudgetWorkspace(input: {
  actorUserId: number;
  projectId: unknown;
  snapshotId?: unknown;
}) {
  await waitForFinancialBudgetMigration();
  const projectId = positiveId(input.projectId, "projectId");
  await authorizeFinancialOperation({
    actorUserId: input.actorUserId,
    projectId,
    featureKey: input.snapshotId ? "cost.report.view" : "cost.budget.view",
    operation: "read",
  });
  const project = (
    await pool.query(
      `SELECT p.id,p.name,p.code,c.name company_name,b.company_id FROM projects p JOIN LATERAL(SELECT company_id FROM project_company_binding_versions WHERE project_id=p.id ORDER BY version DESC LIMIT 1)b ON true JOIN companies c ON c.id=b.company_id WHERE p.id=$1`,
      [projectId],
    )
  ).rows[0];
  if (!project)
    throw new FinancialControlError(
      404,
      "PROJECT_NOT_FOUND",
      "Project not found.",
    );
  const structures = (
    await pool.query(
      `SELECT s.*,l.library_id,l.version library_version FROM project_cost_structure_versions s JOIN company_cost_library_versions l ON l.id=s.library_version_id WHERE s.project_id=$1 ORDER BY s.version DESC`,
      [projectId],
    )
  ).rows;
  const nodes = structures[0]
    ? (
        await pool.query(
          `SELECT id,stable_project_node_id,parent_project_node_id,project_code,project_name,description,active,sort_order,mapping_provenance FROM project_cost_nodes WHERE structure_version_id=$1 ORDER BY sort_order,project_code`,
          [structures[0].id],
        )
      ).rows
    : [];
  const budgets = (
    await pool.query(
      `SELECT id,budget_id,version,structure_version_id,currency,status,purpose,calculated_total,content_fingerprint,revision,prepared_by_id,submitted_at,reviewed_at,approved_at,approved_snapshot_id,created_at FROM project_budget_versions WHERE project_id=$1 ORDER BY created_at DESC`,
      [projectId],
    )
  ).rows;
  const snapshots = (
    await pool.query(
      `SELECT * FROM approved_budget_snapshots WHERE project_id=$1 ORDER BY approved_at DESC`,
      [projectId],
    )
  ).rows;
  let snapshot = null;
  if (input.snapshotId) {
    const row = snapshots.find(
      (s: any) => String(s.id) === String(input.snapshotId),
    );
    if (!row)
      throw new FinancialControlError(
        404,
        "SNAPSHOT_NOT_FOUND",
        "Approved snapshot not found.",
      );
    const lines = (
      await pool.query(
        `SELECT stable_line_id,project_code,project_name,hierarchical_path,description,amount,quantity,unit,unit_rate,notes,sort_order FROM approved_budget_snapshot_lines WHERE snapshot_id=$1 ORDER BY sort_order,stable_line_id`,
        [row.id],
      )
    ).rows;
    snapshot = {
      ...snapshotResponse(row),
      currency: row.currency,
      budgetVersion: Number(row.budget_version),
      approvedAt: iso(row.approved_at),
      approvedById: Number(row.approved_by_id),
      approvalLimit: String(row.approval_limit),
      lines,
    };
  }
  return {
    project: {
      id: Number(project.id),
      name: project.name,
      code: project.code,
      companyName: project.company_name,
    },
    structures,
    nodes,
    budgets,
    snapshots: snapshots.map((row: any) => snapshotResponse(row)),
    snapshot,
    boundary: {
      en: "Operational approved budgets only. No accounting actuals, payments, commitments, forecasts, or cash disbursements.",
      es: "Solo presupuestos operativos aprobados. Sin valores contables reales, pagos, compromisos, pronósticos ni desembolsos.",
    },
  };
}
