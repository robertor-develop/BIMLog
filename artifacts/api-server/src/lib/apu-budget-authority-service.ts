import crypto from "crypto";
import { pool } from "@workspace/db";
import { FinancialControlError } from "./financial-control-contract";
import { authorizeFinancialOperation } from "./financial-control-service";
import {
  evaluateGenericApuBudgetControl,
  type BudgetControlMoney,
  type GenericApuBudgetControlInput,
  type GenericApuBudgetControlResult,
  type RoleBudgetControlInput,
} from "./generic-apu-budget-control";

type Queryable = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: any[] }>;
};

const MAX_ROLES = 100;
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export interface GenericApuAuthorityRoleCap {
  readonly roleId: string;
  readonly approved: BudgetControlMoney;
  readonly warningRemaining?: BudgetControlMoney;
}

export interface GenericApuAuthorityBinding {
  readonly projectApuVersionId: string;
  readonly projectId: number;
  readonly companyId: number;
  readonly templateVersionId: string;
  readonly revision: number;
  readonly currency: string;
  readonly makerUserId: number;
  readonly status: string;
  /** Immutable role caps read from the bound project APU version provenance. */
  readonly authoritativeRoleCaps: readonly GenericApuAuthorityRoleCap[];
}

export interface GenericApuAuthorityReceipt {
  readonly receiptId: string;
  readonly idempotencyKey: string;
  readonly roleId: string;
  readonly approverUserId: number;
  readonly makerUserId: number;
  readonly amount: string;
  readonly currency: string;
  readonly approvalReason: string;
  readonly approvedAt: string;
  readonly requestFingerprint: string;
}

export interface GenericApuAuthorityStoredReceipt extends GenericApuAuthorityReceipt {
  readonly projectId: number;
  readonly companyId: number;
  readonly projectApuVersionId: string;
  readonly entityId: string;
}

export interface GenericApuAuthorityReversalReceipt {
  readonly reversalReceiptId: string;
  readonly originalReceiptId: string;
  readonly roleId: string;
  readonly actorUserId: number;
  readonly originalApproverUserId: number;
  readonly makerUserId: number;
  readonly amount: string;
  readonly currency: string;
  readonly reason: string;
  readonly reversedAt: string;
  readonly requestFingerprint: string;
}

export interface CallerRoleBudgetControlInput {
  readonly roleId: string;
  readonly committed: BudgetControlMoney;
  readonly actual: BudgetControlMoney;
  readonly projected: BudgetControlMoney;
}

export interface CallerGenericApuBudgetControlInput {
  readonly currency: string;
  readonly frozenTemplateVersionId: string;
  readonly currentRevision: number;
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
  readonly roles: readonly CallerRoleBudgetControlInput[];
}

export interface EvaluateAuthorizedGenericApuBudgetControlInput {
  readonly actorUserId: number;
  readonly projectId: unknown;
  readonly projectApuVersionId: unknown;
  readonly approvalReason?: unknown;
  readonly control: CallerGenericApuBudgetControlInput;
}

export interface ReverseAuthorizedGenericApuBudgetOverrideInput {
  readonly actorUserId: number;
  readonly projectId: unknown;
  readonly projectApuVersionId: unknown;
  readonly receiptId: unknown;
  readonly reason: unknown;
  readonly idempotencyKey: unknown;
}

export interface GenericApuBudgetAuthorityDependencies {
  readonly now: () => Date;
  readonly loadBinding: (
    projectId: number,
    projectApuVersionId: string,
  ) => Promise<GenericApuAuthorityBinding | null>;
  readonly authorizeOverrun: (input: {
    actorUserId: number;
    projectId: number;
    makerUserId: number;
    roleId: string;
    roleCap: BudgetControlMoney;
    amount: BudgetControlMoney;
  }) => Promise<{ companyId: number }>;
  readonly appendReceipt: (input: GenericApuAuthorityReceipt) => Promise<GenericApuAuthorityReceipt>;
  readonly loadReceipt: (input: {
    projectId: number;
    projectApuVersionId: string;
    receiptId: string;
  }) => Promise<GenericApuAuthorityStoredReceipt | null>;
  readonly authorizeReversal: (input: {
    actorUserId: number;
    projectId: number;
    makerUserId: number;
    roleId: string;
    amount: BudgetControlMoney;
  }) => Promise<{ companyId: number }>;
  readonly appendReversal: (input: GenericApuAuthorityReversalReceipt) => Promise<GenericApuAuthorityReversalReceipt>;
}

export interface GenericApuBudgetAuthorityTransaction {
  run<T>(work: (dependencies: GenericApuBudgetAuthorityDependencies) => Promise<T>): Promise<T>;
}

export interface GenericApuBudgetAuthorityService {
  evaluate(input: EvaluateAuthorizedGenericApuBudgetControlInput): Promise<{
    control: GenericApuBudgetControlResult;
    authorityReceipts: readonly GenericApuAuthorityReceipt[];
  }>;
  reverse(input: ReverseAuthorizedGenericApuBudgetOverrideInput): Promise<GenericApuAuthorityReversalReceipt>;
}

function fail(status: number, code: string, message: string): never {
  throw new FinancialControlError(status, code, message);
}

const positiveId = (value: unknown, field: string): number => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    fail(400, "APU_AUTHORITY_SCOPE_INVALID", `${field} must be a positive integer.`);
  return parsed;
};

const stableId = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !STABLE_ID.test(value))
    fail(400, "APU_AUTHORITY_BINDING_INVALID", `${field} must be a stable bounded identity.`);
  return value;
};

const boundedReason = (value: unknown, field = "approvalReason"): string => {
  const result = String(value ?? "").trim();
  if (result.length < 3 || result.length > 2000 || /[\u0000-\u001f\u007f]/.test(result))
    fail(400, "APU_AUTHORITY_REASON_INVALID", `${field} must be 3 to 2,000 characters of plain text.`);
  return result;
};

const exactKeys = (value: unknown, allowed: readonly string[], field: string): void => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(400, "APU_AUTHORITY_PAYLOAD_INVALID", `${field} must be an object.`);
  const unexpected = Object.keys(value as object).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0)
    fail(400, "APU_AUTHORITY_PAYLOAD_CLOSED", `${field} contains unsupported properties: ${unexpected.sort().join(", ")}.`);
};

function validateCallerControl(input: EvaluateAuthorizedGenericApuBudgetControlInput): void {
  exactKeys(input, ["actorUserId", "projectId", "projectApuVersionId", "approvalReason", "control"], "request");
  exactKeys(input.control, ["currency", "frozenTemplateVersionId", "currentRevision", "expectedRevision", "idempotencyKey", "roles"], "control");
  if (!Array.isArray(input.control.roles) || input.control.roles.length < 1 || input.control.roles.length > MAX_ROLES)
    fail(400, "APU_AUTHORITY_ROLES_BOUNDED", `control.roles must contain between 1 and ${MAX_ROLES} roles.`);
  for (const [index, role] of input.control.roles.entries()) {
    exactKeys(role, ["roleId", "committed", "actual", "projected"], `control.roles[${index}]`);
    for (const moneyField of ["committed", "actual", "projected"] as const)
      exactKeys(role[moneyField], ["amount", "currency"], `control.roles[${index}].${moneyField}`);
  }
}

function authoritativeControl(
  control: CallerGenericApuBudgetControlInput,
  binding: GenericApuAuthorityBinding,
): GenericApuBudgetControlInput {
  if (!Array.isArray(binding.authoritativeRoleCaps) || binding.authoritativeRoleCaps.length < 1 || binding.authoritativeRoleCaps.length > MAX_ROLES)
    fail(409, "APU_AUTHORITY_ROLE_CAPS_INVALID", "The bound project APU version has no valid bounded role-cap policy.");
  const caps = new Map<string, GenericApuAuthorityRoleCap>();
  for (const [index, cap] of binding.authoritativeRoleCaps.entries()) {
    exactKeys(cap, ["roleId", "approved", "warningRemaining"], `authoritativeRoleCaps[${index}]`);
    const roleId = stableId(cap.roleId, `authoritativeRoleCaps[${index}].roleId`);
    if (caps.has(roleId))
      fail(409, "APU_AUTHORITY_ROLE_CAPS_INVALID", `The bound role-cap policy contains duplicate role ${roleId}.`);
    exactKeys(cap.approved, ["amount", "currency"], `authoritativeRoleCaps[${index}].approved`);
    if (cap.warningRemaining)
      exactKeys(cap.warningRemaining, ["amount", "currency"], `authoritativeRoleCaps[${index}].warningRemaining`);
    caps.set(roleId, cap);
  }
  if (control.roles.length !== caps.size)
    fail(409, "APU_AUTHORITY_ROLE_SET_MISMATCH", "The requested roles do not match the authoritative project/version role set.");
  const roles: RoleBudgetControlInput[] = control.roles.map((role) => {
    const roleId = stableId(role.roleId, "control.roles[].roleId");
    const cap = caps.get(roleId);
    if (!cap)
      fail(409, "APU_AUTHORITY_ROLE_SET_MISMATCH", `Role ${roleId} is not bound to this project APU version.`);
    return {
      roleId,
      approved: cap.approved,
      warningRemaining: cap.warningRemaining,
      committed: role.committed,
      actual: role.actual,
      projected: role.projected,
    };
  });
  return { ...control, roles };
}

function fingerprint(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function requireCompanyScope(bindingCompanyId: number, authorizedCompanyId: unknown): void {
  if (!Number.isSafeInteger(authorizedCompanyId) || Number(authorizedCompanyId) <= 0 || Number(authorizedCompanyId) !== bindingCompanyId)
    fail(409, "APU_AUTHORITY_COMPANY_SCOPE_MISMATCH", "The current authoritative project-company scope does not match the immutable project APU binding.");
}

export async function evaluateAuthorizedGenericApuBudgetControlWithDependencies(
  input: EvaluateAuthorizedGenericApuBudgetControlInput,
  dependencies: GenericApuBudgetAuthorityDependencies,
): Promise<{ control: GenericApuBudgetControlResult; authorityReceipts: readonly GenericApuAuthorityReceipt[] }> {
  validateCallerControl(input);
  const actorUserId = positiveId(input.actorUserId, "actorUserId");
  const projectId = positiveId(input.projectId, "projectId");
  const projectApuVersionId = stableId(input.projectApuVersionId, "projectApuVersionId");
  const binding = await dependencies.loadBinding(projectId, projectApuVersionId);
  if (!binding)
    fail(404, "APU_AUTHORITY_BINDING_NOT_FOUND", "The project APU authority binding was not found in the authenticated project scope.");
  if (
    binding.projectId !== projectId ||
    binding.projectApuVersionId !== projectApuVersionId ||
    binding.templateVersionId !== input.control.frozenTemplateVersionId ||
    binding.revision !== input.control.currentRevision ||
    binding.currency !== input.control.currency ||
    !["calculated", "overrun_review_required", "locked"].includes(binding.status)
  )
    fail(409, "APU_AUTHORITY_BINDING_STALE", "The request does not match the immutable project APU authority binding.");

  const controlledInput = authoritativeControl(input.control, binding);
  const preliminary = evaluateGenericApuBudgetControl(controlledInput);
  const overruns = preliminary.roles.filter((role) => role.state === "NEEDS_APPROVAL");
  if (overruns.length === 0)
    return { control: preliminary, authorityReceipts: [] };
  if (binding.makerUserId === actorUserId)
    fail(403, "APU_AUTHORITY_MAKER_CHECKER_REQUIRED", "The project APU maker cannot approve its own overrun.");

  const approvalReason = boundedReason(input.approvalReason);
  const requestFingerprint = fingerprint({ projectId, projectApuVersionId, approvalReason, control: controlledInput });
  const receipts: GenericApuAuthorityReceipt[] = [];
  const approvals = new Map<string, RoleBudgetControlInput["overrunApproval"]>();
  for (const role of overruns) {
    const cap = binding.authoritativeRoleCaps.find((candidate) => candidate.roleId === role.roleId)!;
    const amount = { amount: role.balances.overrun, currency: role.currency };
    const authorizedScope = await dependencies.authorizeOverrun({
      actorUserId,
      projectId,
      makerUserId: binding.makerUserId,
      roleId: role.roleId,
      roleCap: cap.approved,
      amount,
    });
    requireCompanyScope(binding.companyId, authorizedScope.companyId);
    const receipt = await dependencies.appendReceipt({
      receiptId: crypto.randomUUID(),
      idempotencyKey: controlledInput.idempotencyKey,
      roleId: role.roleId,
      approverUserId: actorUserId,
      makerUserId: binding.makerUserId,
      amount: amount.amount,
      currency: amount.currency,
      approvalReason,
      approvedAt: dependencies.now().toISOString(),
      requestFingerprint,
    });
    receipts.push(receipt);
    approvals.set(role.roleId, {
      roleId: role.roleId,
      amount,
      reason: approvalReason,
      approver: `user:${receipt.approverUserId}:receipt:${receipt.receiptId}`,
      timestamp: receipt.approvedAt,
      authorized: true,
    });
  }

  return {
    control: evaluateGenericApuBudgetControl({
      ...controlledInput,
      roles: controlledInput.roles.map((role) => {
        const approval = approvals.get(role.roleId);
        return approval ? { ...role, overrunApproval: approval } : role;
      }),
    }),
    authorityReceipts: receipts,
  };
}

export async function reverseAuthorizedGenericApuBudgetOverrideWithDependencies(
  input: ReverseAuthorizedGenericApuBudgetOverrideInput,
  dependencies: GenericApuBudgetAuthorityDependencies,
): Promise<GenericApuAuthorityReversalReceipt> {
  exactKeys(input, ["actorUserId", "projectId", "projectApuVersionId", "receiptId", "reason", "idempotencyKey"], "request");
  const actorUserId = positiveId(input.actorUserId, "actorUserId");
  const projectId = positiveId(input.projectId, "projectId");
  const projectApuVersionId = stableId(input.projectApuVersionId, "projectApuVersionId");
  const receiptId = stableId(input.receiptId, "receiptId");
  const idempotencyKey = stableId(input.idempotencyKey, "idempotencyKey");
  const reversalReason = boundedReason(input.reason, "reason");
  const original = await dependencies.loadReceipt({ projectId, projectApuVersionId, receiptId });
  if (!original)
    fail(404, "APU_AUTHORITY_RECEIPT_NOT_FOUND", "The issued APU override receipt was not found in the bound project/version scope.");
  if (original.projectId !== projectId || original.projectApuVersionId !== projectApuVersionId)
    fail(409, "APU_AUTHORITY_REVERSAL_SCOPE_MISMATCH", "The override receipt belongs to another project/version scope.");
  const binding = await dependencies.loadBinding(projectId, projectApuVersionId);
  if (!binding || binding.companyId !== original.companyId || binding.makerUserId !== original.makerUserId || !["calculated", "overrun_review_required", "locked"].includes(binding.status))
    fail(409, "APU_AUTHORITY_BINDING_STALE", "The issued override no longer matches an active immutable project APU authority binding.");
  if (original.makerUserId === actorUserId)
    fail(403, "APU_AUTHORITY_MAKER_CHECKER_REQUIRED", "The project APU maker cannot reverse its own issued override.");
  const authorizedScope = await dependencies.authorizeReversal({
    actorUserId,
    projectId,
    makerUserId: original.makerUserId,
    roleId: original.roleId,
    amount: { amount: original.amount, currency: original.currency },
  });
  requireCompanyScope(binding.companyId, authorizedScope.companyId);
  const requestFingerprint = fingerprint({
    projectId,
    projectApuVersionId,
    originalReceiptId: original.receiptId,
    reason: reversalReason,
    idempotencyKey,
  });
  return dependencies.appendReversal({
    reversalReceiptId: crypto.randomUUID(),
    originalReceiptId: original.receiptId,
    roleId: original.roleId,
    actorUserId,
    originalApproverUserId: original.approverUserId,
    makerUserId: original.makerUserId,
    amount: original.amount,
    currency: original.currency,
    reason: reversalReason,
    reversedAt: dependencies.now().toISOString(),
    requestFingerprint,
  });
}

export function createGenericApuBudgetAuthorityService(
  transaction: GenericApuBudgetAuthorityTransaction,
): GenericApuBudgetAuthorityService {
  return {
    evaluate: (input) => transaction.run((dependencies) =>
      evaluateAuthorizedGenericApuBudgetControlWithDependencies(input, dependencies)),
    reverse: (input) => transaction.run((dependencies) =>
      reverseAuthorizedGenericApuBudgetOverrideWithDependencies(input, dependencies)),
  };
}

function parseRoleCaps(value: unknown): GenericApuAuthorityRoleCap[] {
  if (!Array.isArray(value)) return [];
  return value as GenericApuAuthorityRoleCap[];
}

async function loadBinding(client: Queryable, projectId: number, id: string): Promise<GenericApuAuthorityBinding | null> {
  const row = (await client.query(
    `SELECT id,project_id,company_id,template_version_id,version,currency,applied_by_id,status,provenance->'budgetAuthority'->'roleCaps' AS role_caps FROM generic_project_apu_versions WHERE id=$1 AND project_id=$2 FOR SHARE`,
    [id, projectId],
  )).rows[0];
  return row ? {
    projectApuVersionId: String(row.id),
    projectId: Number(row.project_id),
    companyId: Number(row.company_id),
    templateVersionId: String(row.template_version_id),
    revision: Number(row.version),
    currency: String(row.currency),
    makerUserId: Number(row.applied_by_id),
    status: String(row.status),
    authoritativeRoleCaps: parseRoleCaps(row.role_caps),
  } : null;
}

function productionTransaction(): GenericApuBudgetAuthorityTransaction {
  return {
    async run<T>(work: (dependencies: GenericApuBudgetAuthorityDependencies) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        let activeBinding: GenericApuAuthorityBinding | null = null;
        const dependencies: GenericApuBudgetAuthorityDependencies = {
          now: () => new Date(),
          loadBinding: async (projectId, id) => {
            activeBinding = await loadBinding(client, projectId, id);
            return activeBinding;
          },
          authorizeOverrun: async ({ actorUserId, projectId, makerUserId, amount }) => {
            const authorization = await authorizeFinancialOperation({
              actorUserId,
              projectId,
              featureKey: "cost.budget.approve",
              operation: "approve",
              makerUserId,
              category: "generic_apu_overrun",
              amount,
              client,
            });
            return { companyId: authorization.scope.companyId };
          },
          appendReceipt: async (receipt) => {
            if (!activeBinding)
              fail(409, "APU_AUTHORITY_BINDING_STALE", "The authority binding was not loaded in this transaction.");
            const binding = activeBinding;
            const entityId = `apu-budget:${binding.projectApuVersionId}:${receipt.roleId}:${receipt.idempotencyKey}`;
            await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [entityId]);
            const prior = (await client.query(
              `SELECT id,actor_user_id,evidence,occurred_at FROM financial_authority_journal WHERE event_type='generic_apu_overrun_approved' AND entity_type='generic_apu_budget_control' AND entity_id=$1 ORDER BY occurred_at,id LIMIT 1`,
              [entityId],
            )).rows[0];
            if (prior) {
              const evidence = prior.evidence as Record<string, unknown>;
              if (
                Number(prior.actor_user_id) !== receipt.approverUserId ||
                evidence.idempotencyKey !== receipt.idempotencyKey ||
                evidence.requestFingerprint !== receipt.requestFingerprint ||
                evidence.approvalReason !== receipt.approvalReason
              )
                fail(409, "APU_AUTHORITY_IDEMPOTENCY_CONFLICT", "The idempotency key is already bound to another approval request.");
              const reversed = (await client.query(
                `SELECT 1 FROM financial_authority_journal WHERE event_type='generic_apu_overrun_reversed' AND evidence->>'originalReceiptId'=$1 LIMIT 1`,
                [String(prior.id)],
              )).rows[0];
              if (reversed)
                fail(409, "APU_AUTHORITY_OVERRIDE_REVERSED", "The issued APU override was explicitly reversed and cannot be replayed.");
              return {
                ...receipt,
                receiptId: String(prior.id),
                approvalReason: String(evidence.approvalReason),
                approvedAt: new Date(prior.occurred_at).toISOString(),
              };
            }
            await client.query(
              `INSERT INTO financial_authority_journal(id,event_type,company_id,project_id,actor_user_id,subject_user_id,entity_type,entity_id,entity_version,decision,reason_code,explanation_en,explanation_es,evidence) VALUES($1,'generic_apu_overrun_approved',$2,$3,$4,$5,'generic_apu_budget_control',$6,$7,'allow','APU_SERVICE_ISSUED_FINANCE_APPROVAL','A service-issued Generic APU overrun approval was recorded.','Se registró una aprobación de exceso de APU genérico emitida por el servicio.',$8::jsonb)`,
              [receipt.receiptId, binding.companyId, binding.projectId, receipt.approverUserId, receipt.makerUserId, entityId, binding.revision, JSON.stringify({ ...receipt, projectApuVersionId: binding.projectApuVersionId })],
            );
            return receipt;
          },
          loadReceipt: async ({ projectId, projectApuVersionId, receiptId }) => {
            await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`apu-budget-reversal:${receiptId}`]);
            const row = (await client.query(
              `SELECT id,company_id,project_id,actor_user_id,subject_user_id,entity_id,evidence,occurred_at FROM financial_authority_journal WHERE id=$1 AND event_type='generic_apu_overrun_approved' AND entity_type='generic_apu_budget_control' AND project_id=$2 AND evidence->>'projectApuVersionId'=$3 FOR SHARE`,
              [receiptId, projectId, projectApuVersionId],
            )).rows[0];
            if (!row) return null;
            const evidence = row.evidence as Record<string, unknown>;
            return {
              receiptId: String(row.id),
              idempotencyKey: String(evidence.idempotencyKey),
              roleId: String(evidence.roleId),
              approverUserId: Number(row.actor_user_id),
              makerUserId: Number(row.subject_user_id),
              amount: String(evidence.amount),
              currency: String(evidence.currency),
              approvalReason: String(evidence.approvalReason),
              approvedAt: new Date(row.occurred_at).toISOString(),
              requestFingerprint: String(evidence.requestFingerprint),
              projectId: Number(row.project_id),
              companyId: Number(row.company_id),
              projectApuVersionId,
              entityId: String(row.entity_id),
            };
          },
          authorizeReversal: async ({ actorUserId, projectId, makerUserId, amount }) => {
            const authorization = await authorizeFinancialOperation({
              actorUserId,
              projectId,
              featureKey: "cost.budget.approve",
              operation: "approve",
              makerUserId,
              category: "generic_apu_overrun_reversal",
              amount,
              client,
            });
            return { companyId: authorization.scope.companyId };
          },
          appendReversal: async (reversal) => {
            const prior = (await client.query(
              `SELECT id,actor_user_id,evidence,occurred_at FROM financial_authority_journal WHERE event_type='generic_apu_overrun_reversed' AND evidence->>'originalReceiptId'=$1 ORDER BY occurred_at,id LIMIT 1`,
              [reversal.originalReceiptId],
            )).rows[0];
            if (prior) {
              const evidence = prior.evidence as Record<string, unknown>;
              if (Number(prior.actor_user_id) !== reversal.actorUserId || evidence.requestFingerprint !== reversal.requestFingerprint)
                fail(409, "APU_AUTHORITY_REVERSAL_CONFLICT", "The issued APU override has already been reversed by another request.");
              return { ...reversal, reversalReceiptId: String(prior.id), reversedAt: new Date(prior.occurred_at).toISOString() };
            }
            if (!activeBinding)
              fail(409, "APU_AUTHORITY_BINDING_STALE", "The authority binding was not loaded in this transaction.");
            const binding = activeBinding;
            await client.query(
              `INSERT INTO financial_authority_journal(id,event_type,company_id,project_id,actor_user_id,subject_user_id,entity_type,entity_id,entity_version,decision,reason_code,explanation_en,explanation_es,evidence) VALUES($1,'generic_apu_overrun_reversed',$2,$3,$4,$5,'generic_apu_budget_control',$6,$7,'allow','APU_SERVICE_ISSUED_OVERRIDE_REVERSED','An issued Generic APU override was reversed by an authorized immutable journal event.','Una anulación de APU genérico emitida fue revertida mediante un evento de diario inmutable autorizado.',$8::jsonb)`,
              [reversal.reversalReceiptId, binding.companyId, binding.projectId, reversal.actorUserId, reversal.makerUserId, `apu-budget-reversal:${reversal.originalReceiptId}`, binding.revision, JSON.stringify(reversal)],
            );
            return reversal;
          },
        };
        const result = await work(dependencies);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

const productionService = createGenericApuBudgetAuthorityService(productionTransaction());

export const evaluateAuthorizedGenericApuBudgetControl =
  productionService.evaluate.bind(productionService);

export const reverseAuthorizedGenericApuBudgetOverride =
  productionService.reverse.bind(productionService);
