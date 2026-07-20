import crypto from "crypto";
import { pool } from "@workspace/db";
import { resolveEffectiveEntitlement } from "./feature-catalog-service";
import { waitForFinancialControlMigration } from "./financial-control-migration";
import {
  FINANCIAL_AUTHORITIES,
  FinancialControlError,
  evaluateFinancialAuthorization,
  isFinancialScopeSuspended,
  parseCurrency,
  parseDecimal,
  parseMoney,
  type ApprovalPolicy,
  type EffectiveGrant,
  type FinancialAuthority,
  type FinancialOperation,
} from "./financial-control-contract";

type Actor = { userId: number; companyId: number; isSuperAdmin: boolean };
type Scope = {
  companyId: number;
  projectId: number | null;
  scopeType: "company" | "project";
};
type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }>;
};
const bounded = (value: unknown, name = "reason") => {
  const text = String(value ?? "").trim();
  if (
    text.length < 3 ||
    text.length > 1000 ||
    /[\u0000-\u001f\u007f]/.test(text)
  )
    throw new FinancialControlError(
      400,
      "FIN_REASON_INVALID",
      `${name} must be 3 to 1000 characters of plain text.`,
    );
  return text;
};
const positive = (value: unknown, name: string) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0)
    throw new FinancialControlError(
      400,
      "FIN_SCOPE_INVALID",
      `${name} must be a positive integer.`,
    );
  return n;
};
const date = (value: unknown, fallback?: Date) => {
  if (value == null && fallback) return fallback;
  const result = new Date(String(value));
  if (!Number.isFinite(result.getTime()))
    throw new FinancialControlError(
      400,
      "FIN_DATE_INVALID",
      "Effective dates must be valid timestamps.",
    );
  return result;
};
const iso = (v: unknown) => new Date(String(v)).toISOString();

export async function financialActor(userId: number): Promise<Actor> {
  await waitForFinancialControlMigration();
  const result = await pool.query(
    `SELECT id,company_id,is_super_admin FROM users WHERE id=$1`,
    [userId],
  );
  const row = result.rows[0];
  if (!row)
    throw new FinancialControlError(
      401,
      "FIN_ACTOR_MISSING",
      "The authenticated user no longer exists.",
    );
  return {
    userId: Number(row.id),
    companyId: Number(row.company_id),
    isSuperAdmin: row.is_super_admin === true,
  };
}
async function scopeFor(
  actor: Actor,
  projectIdValue?: unknown,
  companyIdValue?: unknown,
): Promise<Scope> {
  const companyId =
    companyIdValue == null
      ? actor.companyId
      : positive(companyIdValue, "companyId");
  if (companyId !== actor.companyId && !actor.isSuperAdmin)
    throw new FinancialControlError(
      403,
      "FIN_CROSS_COMPANY_DENIED",
      "The requested company is outside the current authenticated scope.",
    );
  if (projectIdValue == null)
    return { companyId, projectId: null, scopeType: "company" };
  const projectId = positive(projectIdValue, "projectId");
  const binding = await pool.query(
    `SELECT company_id FROM project_company_binding_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 1`,
    [projectId],
  );
  if (!binding.rows[0])
    throw new FinancialControlError(
      409,
      "FIN_PROJECT_BINDING_REQUIRED",
      "An accepted audited project-company binding is required.",
    );
  if (Number(binding.rows[0].company_id) !== companyId)
    throw new FinancialControlError(
      403,
      "FIN_PROJECT_COMPANY_MISMATCH",
      "The project is not bound to the requested company.",
    );
  return { companyId, projectId, scopeType: "project" };
}
async function membershipActive(
  userId: number,
  scope: Scope,
  client: Queryable = pool,
): Promise<boolean> {
  if (scope.projectId === null) {
    const u = await client.query(
      `SELECT 1 FROM users WHERE id=$1 AND company_id=$2`,
      [userId, scope.companyId],
    );
    return Boolean(u.rows[0]);
  }
  const m = await client.query(
    `SELECT 1 FROM project_members pm JOIN users u ON u.id=pm.user_id JOIN LATERAL(SELECT company_id FROM project_company_binding_versions WHERE project_id=pm.project_id ORDER BY version DESC LIMIT 1)b ON b.company_id=$3 WHERE pm.user_id=$1 AND pm.project_id=$2 AND pm.status='active' AND u.company_id=$3`,
    [userId, scope.projectId, scope.companyId],
  );
  return Boolean(m.rows[0]);
}
async function grantsFor(
  userId: number,
  scope: Scope,
  client: Queryable = pool,
): Promise<EffectiveGrant[]> {
  const r = await client.query(
    `SELECT g.*,r.grant_id IS NOT NULL AS revoked FROM financial_authority_grants g LEFT JOIN financial_authority_revocations r ON r.grant_id=g.id WHERE g.user_id=$1 AND g.company_id=$2 AND (g.project_id IS NULL OR g.project_id=$3) ORDER BY g.created_at,g.id`,
    [userId, scope.companyId, scope.projectId],
  );
  return r.rows.map((row: any) => ({
    id: String(row.id),
    authority: String(row.authority) as FinancialAuthority,
    scopeType: row.scope_type,
    companyId: Number(row.company_id),
    projectId: row.project_id == null ? null : Number(row.project_id),
    effectiveFrom: new Date(row.effective_from),
    effectiveTo: row.effective_to ? new Date(row.effective_to) : null,
    revoked: row.revoked === true,
  }));
}
async function hasAdmin(
  actor: Actor,
  scope: Scope,
  client: Queryable = pool,
): Promise<boolean> {
  if (!(await membershipActive(actor.userId, scope, client))) return false;
  const grants = await grantsFor(actor.userId, scope, client);
  const now = new Date();
  return grants.some(
    (g) =>
      g.authority === "financial_administrator" &&
      !g.revoked &&
      g.effectiveFrom <= now &&
      (!g.effectiveTo || g.effectiveTo > now) &&
      (g.projectId === null || g.projectId === scope.projectId),
  );
}
async function suspended(scope: Scope): Promise<boolean> {
  const r = await pool.query(
    `SELECT project_id,action,occurred_at FROM financial_suspension_events WHERE company_id=$1 AND (project_id IS NULL OR project_id=$2) ORDER BY occurred_at DESC,id DESC`,
    [scope.companyId, scope.projectId],
  );
  return isFinancialScopeSuspended(
    r.rows.map((row) => ({
      projectId: row.project_id == null ? null : Number(row.project_id),
      action: row.action,
      occurredAt: new Date(row.occurred_at),
    })),
    scope.projectId ?? undefined,
  );
}
async function requireNotSuspended(scope: Scope) {
  if (await suspended(scope))
    throw new FinancialControlError(
      423,
      "FIN_SCOPE_SUSPENDED",
      "Financial control mutations are suspended for this scope; only an authorized release or audit read is permitted.",
    );
}
async function journal(
  client: Queryable,
  input: {
    eventType: string;
    scope: Scope;
    actorUserId: number;
    subjectUserId?: number;
    entityType: string;
    entityId: string;
    version?: number;
    decision?: "allow" | "deny";
    reasonCode: string;
    en: string;
    es: string;
    evidence?: Record<string, unknown>;
  },
) {
  await client.query(
    `INSERT INTO financial_authority_journal(id,event_type,company_id,project_id,actor_user_id,subject_user_id,entity_type,entity_id,entity_version,decision,reason_code,explanation_en,explanation_es,evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
    [
      crypto.randomUUID(),
      input.eventType,
      input.scope.companyId,
      input.scope.projectId,
      input.actorUserId,
      input.subjectUserId ?? null,
      input.entityType,
      input.entityId,
      input.version ?? null,
      input.decision ?? null,
      input.reasonCode,
      input.en,
      input.es,
      JSON.stringify(input.evidence ?? {}),
    ],
  );
}

export async function ownFinancialState(
  userId: number,
  projectIdValue?: unknown,
) {
  const actor = await financialActor(userId),
    scope = await scopeFor(actor, projectIdValue);
  const grants = await grantsFor(userId, scope);
  const entitlement = await resolveEffectiveEntitlement({
    featureKey: "cost_financial_control",
    userId: actor.userId,
    companyId: actor.companyId,
    projectId: scope.projectId ?? undefined,
  });
  const now = new Date();
  const active = grants.filter(
    (g) =>
      !g.revoked &&
      g.effectiveFrom <= now &&
      (!g.effectiveTo || g.effectiveTo > now),
  );
  const context = await pool.query(
    `SELECT base_currency,reporting_currency,permitted_transaction_currencies,version,effective_from,effective_to FROM financial_context_versions WHERE company_id=$1 AND (project_id=$2 OR project_id IS NULL) AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) ORDER BY CASE WHEN project_id=$2 THEN 0 ELSE 1 END,version DESC LIMIT 1`,
    [scope.companyId, scope.projectId],
  );
  const approver = active.some((g) => g.authority === "cost_approver");
  const limits = approver
    ? await pool.query(
        `WITH latest AS(SELECT DISTINCT ON(project_id,transaction_category,currency) project_id,transaction_category,currency,max_amount,version,state,effective_from,effective_to FROM financial_approval_policy_versions WHERE company_id=$1 AND (project_id IS NULL OR project_id=$2) AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) ORDER BY project_id,transaction_category,currency,version DESC) SELECT DISTINCT ON(transaction_category,currency) transaction_category,currency,max_amount,version,state,effective_from,effective_to FROM latest WHERE state='active' ORDER BY transaction_category,currency,CASE WHEN project_id=$2 THEN 0 ELSE 1 END`,
        [scope.companyId, scope.projectId],
      )
    : { rows: [] };
  const projectScopes = await pool.query(
    `SELECT p.id,p.name FROM project_members pm JOIN projects p ON p.id=pm.project_id JOIN LATERAL(SELECT company_id FROM project_company_binding_versions WHERE project_id=p.id ORDER BY version DESC LIMIT 1)b ON b.company_id=$2 WHERE pm.user_id=$1 AND pm.status='active' ORDER BY p.name LIMIT 500`,
    [actor.userId, scope.companyId],
  );
  return {
    scope,
    projectScopes: projectScopes.rows,
    status: (await suspended(scope)) ? "suspended" : "active",
    commercial: {
      decision: entitlement.decision,
      code: entitlement.code,
      state: entitlement.state,
      authorizesExecution: false,
    },
    context: context.rows[0]
      ? {
          baseCurrency: context.rows[0].base_currency,
          reportingCurrency: context.rows[0].reporting_currency,
          permittedTransactionCurrencies:
            context.rows[0].permitted_transaction_currencies,
          version: Number(context.rows[0].version),
          effectiveFrom: iso(context.rows[0].effective_from),
          effectiveTo: context.rows[0].effective_to
            ? iso(context.rows[0].effective_to)
            : null,
        }
      : null,
    authorities: active.map((g) => ({
      grantId: g.id,
      authority: g.authority,
      scopeType: g.scopeType,
      effectiveFrom: g.effectiveFrom.toISOString(),
      effectiveTo: g.effectiveTo?.toISOString() ?? null,
    })),
    approvalLimits: limits.rows
      .filter((row) => row.state === "active")
      .map((row) => ({
        transactionCategory: row.transaction_category,
        currency: row.currency,
        maxAmount: String(row.max_amount),
        version: Number(row.version),
        effectiveFrom: iso(row.effective_from),
        effectiveTo: row.effective_to ? iso(row.effective_to) : null,
      })),
    canManage: active.some((g) => g.authority === "financial_administrator"),
    canAudit: active.some(
      (g) =>
        g.authority === "auditor" || g.authority === "financial_administrator",
    ),
    canBootstrapControlPlane: actor.isSuperAdmin,
    explanation: active.length
      ? {
          en: "Only the explicit authorities shown are effective; commercial availability remains a separate required gate.",
          es: "Solo las autoridades explícitas mostradas están vigentes; la disponibilidad comercial sigue siendo un requisito independiente.",
        }
      : {
          en: "No explicit current financial authority is assigned. Existing application roles do not grant financial access.",
          es: "No se asignó ninguna autoridad financiera explícita vigente. Los roles existentes de la aplicación no conceden acceso financiero.",
        },
  };
}

export async function financialAuditState(
  userId: number,
  projectIdValue?: unknown,
) {
  const actor = await financialActor(userId),
    scope = await scopeFor(actor, projectIdValue),
    grants = await grantsFor(actor.userId, scope),
    now = new Date();
  const authorized =
    (await membershipActive(actor.userId, scope)) &&
    grants.some(
      (g) =>
        !g.revoked &&
        (g.authority === "auditor" ||
          g.authority === "financial_administrator") &&
        g.effectiveFrom <= now &&
        (!g.effectiveTo || g.effectiveTo > now),
    );
  if (!authorized)
    throw new FinancialControlError(
      403,
      "FIN_AUDIT_AUTHORITY_REQUIRED",
      "Explicit current Auditor or Financial Administrator authority is required.",
    );
  const result = await pool.query(
    `SELECT event_type,subject_user_id,entity_type,entity_id,entity_version,decision,reason_code,explanation_en,explanation_es,occurred_at FROM financial_authority_journal WHERE company_id=$1 AND (project_id IS NULL OR project_id=$2) ORDER BY occurred_at DESC LIMIT 500`,
    [scope.companyId, scope.projectId],
  );
  return {
    scope,
    suspended: await suspended(scope),
    journal: result.rows,
  };
}

export async function financialAdminState(
  userId: number,
  projectIdValue?: unknown,
) {
  const actor = await financialActor(userId),
    scope = await scopeFor(actor, projectIdValue);
  if (!(await hasAdmin(actor, scope)))
    throw new FinancialControlError(
      403,
      "FIN_ADMIN_REQUIRED",
      "Explicit current Financial Administrator authority is required.",
    );
  const [
    contexts,
    grants,
    policies,
    suspensions,
    users,
    projects,
    journalRows,
  ] = await Promise.all([
    pool.query(
      `SELECT * FROM financial_context_versions WHERE company_id=$1 AND (project_id IS NULL OR project_id=$2) ORDER BY created_at DESC LIMIT 100`,
      [scope.companyId, scope.projectId],
    ),
    pool.query(
      `SELECT g.*,u.full_name,u.email,r.revoked_at,r.reason AS revocation_reason FROM financial_authority_grants g JOIN users u ON u.id=g.user_id LEFT JOIN financial_authority_revocations r ON r.grant_id=g.id WHERE g.company_id=$1 AND (g.project_id IS NULL OR g.project_id=$2) ORDER BY g.created_at DESC LIMIT 200`,
      [scope.companyId, scope.projectId],
    ),
    pool.query(
      `SELECT * FROM financial_approval_policy_versions WHERE company_id=$1 AND (project_id IS NULL OR project_id=$2) ORDER BY created_at DESC LIMIT 100`,
      [scope.companyId, scope.projectId],
    ),
    pool.query(
      `SELECT * FROM financial_suspension_events WHERE company_id=$1 AND (project_id IS NULL OR project_id=$2) ORDER BY occurred_at DESC LIMIT 100`,
      [scope.companyId, scope.projectId],
    ),
    pool.query(
      `SELECT id,full_name,email FROM users WHERE company_id=$1 ORDER BY full_name,email LIMIT 500`,
      [scope.companyId],
    ),
    pool.query(
      `SELECT p.id,p.name,b.company_id FROM projects p JOIN LATERAL(SELECT company_id FROM project_company_binding_versions WHERE project_id=p.id ORDER BY version DESC LIMIT 1)b ON b.company_id=$1 ORDER BY p.name LIMIT 500`,
      [scope.companyId],
    ),
    pool.query(
      `SELECT event_type,subject_user_id,entity_type,entity_id,entity_version,decision,reason_code,explanation_en,explanation_es,occurred_at FROM financial_authority_journal WHERE company_id=$1 AND (project_id IS NULL OR project_id=$2) ORDER BY occurred_at DESC LIMIT 200`,
      [scope.companyId, scope.projectId],
    ),
  ]);
  return {
    scope,
    contexts: contexts.rows,
    grants: grants.rows,
    policies: policies.rows,
    suspensions: suspensions.rows,
    users: users.rows,
    projects: projects.rows,
    journal: journalRows.rows,
  };
}

export async function bootstrapFinancialControls(input: {
  actorUserId: number;
  companyId: unknown;
  projectId?: unknown;
  administratorUserId: unknown;
  baseCurrency: unknown;
  reportingCurrency: unknown;
  permittedCurrencies: unknown;
  reason: unknown;
}) {
  const actor = await financialActor(input.actorUserId);
  if (!actor.isSuperAdmin)
    throw new FinancialControlError(
      403,
      "FIN_SUPER_BOOTSTRAP_REQUIRED",
      "Verified Super Administrator status is required for this explicit bootstrap action.",
    );
  const scope = await scopeFor(actor, input.projectId, input.companyId),
    administratorUserId = positive(
      input.administratorUserId,
      "administratorUserId",
    ),
    reason = bounded(input.reason),
    base = parseCurrency(input.baseCurrency),
    reporting = parseCurrency(input.reportingCurrency),
    permitted = Array.isArray(input.permittedCurrencies)
      ? [...new Set(input.permittedCurrencies.map(parseCurrency))]
      : [];
  if (!permitted.includes(base)) permitted.push(base);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const freshActor = await client.query(
      `SELECT is_super_admin FROM users WHERE id=$1 FOR SHARE`,
      [actor.userId],
    );
    if (freshActor.rows[0]?.is_super_admin !== true)
      throw new FinancialControlError(
        403,
        "FIN_SUPER_BOOTSTRAP_REQUIRED",
        "Super Administrator authority changed before bootstrap.",
      );
    const target = await client.query(
      `SELECT 1 FROM users WHERE id=$1 AND company_id=$2 FOR SHARE`,
      [administratorUserId, scope.companyId],
    );
    if (
      !target.rows[0] ||
      !(await membershipActive(administratorUserId, scope, client))
    )
      throw new FinancialControlError(
        400,
        "FIN_BOOTSTRAP_TARGET_INVALID",
        "The administrator must be a current user and, for project scope, an active member.",
      );
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [
      `financial-bootstrap:${scope.companyId}:${scope.projectId ?? 0}`,
    ]);
    const existing = await client.query(
      `SELECT 1 FROM financial_authority_grants g WHERE g.company_id=$1 AND g.project_id IS NOT DISTINCT FROM $2 AND g.authority='financial_administrator' AND g.effective_from<=now() AND (g.effective_to IS NULL OR g.effective_to>now()) AND NOT EXISTS(SELECT 1 FROM financial_authority_revocations r WHERE r.grant_id=g.id)`,
      [scope.companyId, scope.projectId],
    );
    if (existing.rows[0])
      throw new FinancialControlError(
        409,
        "FIN_BOOTSTRAP_ALREADY_COMPLETE",
        "An active Financial Administrator already exists; normal financial administration is required.",
      );
    const contextId = crypto.randomUUID(),
      grantId = crypto.randomUUID();
    await client.query(
      `INSERT INTO financial_context_versions(id,company_id,project_id,scope_type,version,base_currency,reporting_currency,permitted_transaction_currencies,effective_from,reason,created_by_id) VALUES($1,$2,$3,$4,1,$5,$6,$7::jsonb,now(),$8,$9)`,
      [
        contextId,
        scope.companyId,
        scope.projectId,
        scope.scopeType,
        base,
        reporting,
        JSON.stringify(permitted),
        reason,
        actor.userId,
      ],
    );
    await client.query(
      `INSERT INTO financial_authority_grants(id,user_id,company_id,project_id,scope_type,authority,version,effective_from,reason,granted_by_id) VALUES($1,$2,$3,$4,$5,'financial_administrator',1,now(),$6,$7)`,
      [
        grantId,
        administratorUserId,
        scope.companyId,
        scope.projectId,
        scope.scopeType,
        reason,
        actor.userId,
      ],
    );
    await journal(client, {
      eventType: "bootstrap",
      scope,
      actorUserId: actor.userId,
      subjectUserId: administratorUserId,
      entityType: "financial_control_scope",
      entityId: contextId,
      version: 1,
      reasonCode: "FIN_EXPLICIT_BOOTSTRAP",
      en: "A reason-required financial control bootstrap created the initial context and Financial Administrator grant.",
      es: "Un inicio explícito y motivado del control financiero creó el contexto inicial y la concesión de Administrador Financiero.",
      evidence: { contextId, grantId, superAdminEmergencyAuthority: true },
    });
    await client.query("COMMIT");
    return { contextId, grantId, scope };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createFinancialContext(input: {
  actorUserId: number;
  projectId?: unknown;
  baseCurrency: unknown;
  reportingCurrency: unknown;
  permittedCurrencies: unknown;
  effectiveFrom?: unknown;
  effectiveTo?: unknown;
  reason: unknown;
}) {
  const actor = await financialActor(input.actorUserId),
    scope = await scopeFor(actor, input.projectId);
  if (!(await hasAdmin(actor, scope)))
    throw new FinancialControlError(
      403,
      "FIN_ADMIN_REQUIRED",
      "Financial Administrator authority is required.",
    );
  await requireNotSuspended(scope);
  const reason = bounded(input.reason),
    base = parseCurrency(input.baseCurrency),
    reporting = parseCurrency(input.reportingCurrency),
    permitted = Array.isArray(input.permittedCurrencies)
      ? [...new Set(input.permittedCurrencies.map(parseCurrency))]
      : [];
  if (!permitted.includes(base)) permitted.push(base);
  const from = date(input.effectiveFrom, new Date()),
    to = input.effectiveTo == null ? null : date(input.effectiveTo);
  if (to && to <= from)
    throw new FinancialControlError(
      400,
      "FIN_DATE_INVALID",
      "effectiveTo must be after effectiveFrom.",
    );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (!(await hasAdmin(actor, scope, client)))
      throw new FinancialControlError(
        403,
        "FIN_AUTHORITY_CHANGED",
        "Financial Administrator authority changed.",
      );
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [
      `financial-context:${scope.companyId}:${scope.projectId ?? 0}`,
    ]);
    const prior = await client.query(
      `SELECT id,version FROM financial_context_versions WHERE company_id=$1 AND project_id IS NOT DISTINCT FROM $2 ORDER BY version DESC LIMIT 1`,
      [scope.companyId, scope.projectId],
    );
    const version = Number(prior.rows[0]?.version ?? 0) + 1,
      id = crypto.randomUUID();
    await client.query(
      `INSERT INTO financial_context_versions(id,company_id,project_id,scope_type,version,base_currency,reporting_currency,permitted_transaction_currencies,effective_from,effective_to,supersedes_id,reason,created_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13)`,
      [
        id,
        scope.companyId,
        scope.projectId,
        scope.scopeType,
        version,
        base,
        reporting,
        JSON.stringify(permitted),
        from,
        to,
        prior.rows[0]?.id ?? null,
        reason,
        actor.userId,
      ],
    );
    await journal(client, {
      eventType: "context_version_created",
      scope,
      actorUserId: actor.userId,
      entityType: "financial_context",
      entityId: id,
      version,
      reasonCode: "FIN_CONTEXT_VERSION",
      en: "A new immutable financial context version was created.",
      es: "Se creó una nueva versión inmutable del contexto financiero.",
      evidence: {
        baseCurrency: base,
        reportingCurrency: reporting,
        permittedTransactionCurrencies: permitted,
      },
    });
    await client.query("COMMIT");
    return { id, version };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createFinancialGrant(input: {
  actorUserId: number;
  projectId?: unknown;
  userId: unknown;
  authority: unknown;
  effectiveFrom?: unknown;
  effectiveTo?: unknown;
  reason: unknown;
}) {
  const actor = await financialActor(input.actorUserId),
    scope = await scopeFor(actor, input.projectId);
  if (!(await hasAdmin(actor, scope)))
    throw new FinancialControlError(
      403,
      "FIN_ADMIN_REQUIRED",
      "Financial Administrator authority is required.",
    );
  await requireNotSuspended(scope);
  const userId = positive(input.userId, "userId"),
    authority = String(input.authority) as FinancialAuthority;
  if (!FINANCIAL_AUTHORITIES.includes(authority))
    throw new FinancialControlError(
      400,
      "FIN_AUTHORITY_INVALID",
      "The financial authority is not recognized.",
    );
  if (!(await membershipActive(userId, scope)))
    throw new FinancialControlError(
      400,
      "FIN_GRANTEE_SCOPE_INVALID",
      "The grantee must be current in the company and project scope.",
    );
  const reason = bounded(input.reason),
    from = date(input.effectiveFrom, new Date()),
    to = input.effectiveTo == null ? null : date(input.effectiveTo);
  if (to && to <= from)
    throw new FinancialControlError(
      400,
      "FIN_DATE_INVALID",
      "effectiveTo must be after effectiveFrom.",
    );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (!(await hasAdmin(actor, scope, client)))
      throw new FinancialControlError(
        403,
        "FIN_AUTHORITY_CHANGED",
        "Financial Administrator authority changed.",
      );
    if (!(await membershipActive(userId, scope, client)))
      throw new FinancialControlError(
        403,
        "FIN_GRANTEE_SCOPE_CHANGED",
        "The grantee company or project membership changed before the grant was recorded.",
      );
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [
      `financial-grant:${userId}:${scope.companyId}:${scope.projectId ?? 0}:${authority}`,
    ]);
    const next = await client.query(
      `SELECT COALESCE(MAX(version),0)+1 AS version FROM financial_authority_grants WHERE user_id=$1 AND company_id=$2 AND project_id IS NOT DISTINCT FROM $3 AND authority=$4`,
      [userId, scope.companyId, scope.projectId, authority],
    );
    const version = Number(next.rows[0].version),
      id = crypto.randomUUID();
    await client.query(
      `INSERT INTO financial_authority_grants(id,user_id,company_id,project_id,scope_type,authority,version,effective_from,effective_to,reason,granted_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        id,
        userId,
        scope.companyId,
        scope.projectId,
        scope.scopeType,
        authority,
        version,
        from,
        to,
        reason,
        actor.userId,
      ],
    );
    await journal(client, {
      eventType: "authority_granted",
      scope,
      actorUserId: actor.userId,
      subjectUserId: userId,
      entityType: "authority_grant",
      entityId: id,
      version,
      reasonCode: "FIN_AUTHORITY_GRANTED",
      en: "An explicit, effective-dated financial authority was granted.",
      es: "Se concedió una autoridad financiera explícita con vigencia definida.",
      evidence: { authority },
    });
    await client.query("COMMIT");
    return { id, version };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeFinancialGrant(input: {
  actorUserId: number;
  grantId: string;
  reason: unknown;
}) {
  const actor = await financialActor(input.actorUserId),
    row = (
      await pool.query(
        `SELECT company_id,project_id,user_id,authority FROM financial_authority_grants WHERE id=$1`,
        [input.grantId],
      )
    ).rows[0];
  if (!row)
    throw new FinancialControlError(
      404,
      "FIN_GRANT_NOT_FOUND",
      "Financial authority grant not found.",
    );
  const scope = await scopeFor(actor, row.project_id, row.company_id);
  if (!(await hasAdmin(actor, scope)))
    throw new FinancialControlError(
      403,
      "FIN_ADMIN_REQUIRED",
      "Financial Administrator authority is required.",
    );
  await requireNotSuspended(scope);
  const reason = bounded(input.reason),
    client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (!(await hasAdmin(actor, scope, client)))
      throw new FinancialControlError(
        403,
        "FIN_AUTHORITY_CHANGED",
        "Financial Administrator authority changed.",
      );
    const id = crypto.randomUUID();
    await client.query(
      `INSERT INTO financial_authority_revocations(id,grant_id,reason,revoked_by_id) VALUES($1,$2,$3,$4)`,
      [id, input.grantId, reason, actor.userId],
    );
    await journal(client, {
      eventType: "authority_revoked",
      scope,
      actorUserId: actor.userId,
      subjectUserId: Number(row.user_id),
      entityType: "authority_grant",
      entityId: input.grantId,
      reasonCode: "FIN_AUTHORITY_REVOKED",
      en: "The financial authority grant was revoked immediately.",
      es: "La concesión de autoridad financiera fue revocada de inmediato.",
      evidence: { authority: row.authority, revocationId: id },
    });
    await client.query("COMMIT");
    return { id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createApprovalPolicy(input: {
  actorUserId: number;
  projectId?: unknown;
  transactionCategory: unknown;
  currency: unknown;
  maxAmount: unknown;
  state?: unknown;
  effectiveFrom?: unknown;
  effectiveTo?: unknown;
  reason: unknown;
}) {
  const actor = await financialActor(input.actorUserId),
    scope = await scopeFor(actor, input.projectId);
  if (!(await hasAdmin(actor, scope)))
    throw new FinancialControlError(
      403,
      "FIN_ADMIN_REQUIRED",
      "Financial Administrator authority is required.",
    );
  await requireNotSuspended(scope);
  const category = bounded(input.transactionCategory, "transactionCategory"),
    currency = parseCurrency(input.currency),
    maxAmount = parseDecimal(input.maxAmount, "maxAmount"),
    state = input.state === "revoked" ? "revoked" : "active",
    reason = bounded(input.reason),
    from = date(input.effectiveFrom, new Date()),
    to = input.effectiveTo == null ? null : date(input.effectiveTo);
  if (to && to <= from)
    throw new FinancialControlError(
      400,
      "FIN_DATE_INVALID",
      "effectiveTo must be after effectiveFrom.",
    );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (!(await hasAdmin(actor, scope, client)))
      throw new FinancialControlError(
        403,
        "FIN_AUTHORITY_CHANGED",
        "Financial Administrator authority changed.",
      );
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [
      `financial-policy:${scope.companyId}:${scope.projectId ?? 0}:${category}:${currency}`,
    ]);
    const prior = await client.query(
      `SELECT id,version FROM financial_approval_policy_versions WHERE company_id=$1 AND project_id IS NOT DISTINCT FROM $2 AND transaction_category=$3 AND currency=$4 ORDER BY version DESC LIMIT 1`,
      [scope.companyId, scope.projectId, category, currency],
    );
    const version = Number(prior.rows[0]?.version ?? 0) + 1,
      id = crypto.randomUUID();
    await client.query(
      `INSERT INTO financial_approval_policy_versions(id,company_id,project_id,scope_type,transaction_category,currency,max_amount,version,effective_from,effective_to,supersedes_id,state,reason,created_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        id,
        scope.companyId,
        scope.projectId,
        scope.scopeType,
        category,
        currency,
        maxAmount,
        version,
        from,
        to,
        prior.rows[0]?.id ?? null,
        state,
        reason,
        actor.userId,
      ],
    );
    await journal(client, {
      eventType: "approval_policy_version_created",
      scope,
      actorUserId: actor.userId,
      entityType: "approval_policy",
      entityId: id,
      version,
      reasonCode: "FIN_APPROVAL_POLICY_VERSION",
      en: "An immutable approval policy version was created.",
      es: "Se creó una versión inmutable de la política de aprobación.",
      evidence: { transactionCategory: category, currency, maxAmount, state },
    });
    await client.query("COMMIT");
    return { id, version };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function changeFinancialSuspension(input: {
  actorUserId: number;
  projectId?: unknown;
  action: unknown;
  reason: unknown;
  emergency?: boolean;
  companyId?: unknown;
}) {
  const actor = await financialActor(input.actorUserId),
    scope = await scopeFor(actor, input.projectId, input.companyId),
    action = String(input.action);
  if (action !== "activate" && action !== "release")
    throw new FinancialControlError(
      400,
      "FIN_SUSPENSION_ACTION_INVALID",
      "Suspension action must be activate or release.",
    );
  const admin = await hasAdmin(actor, scope);
  if (!admin && !(actor.isSuperAdmin && input.emergency === true))
    throw new FinancialControlError(
      403,
      "FIN_SUSPENSION_AUTHORITY_REQUIRED",
      "Financial Administrator authority or an explicit Super Administrator emergency action is required.",
    );
  const reason = bounded(input.reason),
    client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (admin && !(await hasAdmin(actor, scope, client)))
      throw new FinancialControlError(
        403,
        "FIN_AUTHORITY_CHANGED",
        "Financial Administrator authority changed.",
      );
    if (!admin) {
      const freshActor = await client.query(
        `SELECT is_super_admin FROM users WHERE id=$1 FOR SHARE`,
        [actor.userId],
      );
      if (freshActor.rows[0]?.is_super_admin !== true)
        throw new FinancialControlError(
          403,
          "FIN_SUPER_EMERGENCY_AUTHORITY_CHANGED",
          "Super Administrator emergency authority changed.",
        );
    }
    const id = crypto.randomUUID();
    await client.query(
      `INSERT INTO financial_suspension_events(id,company_id,project_id,scope_type,action,reason,actor_user_id) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        id,
        scope.companyId,
        scope.projectId,
        scope.scopeType,
        action,
        reason,
        actor.userId,
      ],
    );
    await journal(client, {
      eventType: `suspension_${action}`,
      scope,
      actorUserId: actor.userId,
      entityType: "financial_suspension",
      entityId: id,
      reasonCode:
        actor.isSuperAdmin && !admin
          ? "FIN_SUPER_EMERGENCY_ACTION"
          : `FIN_SUSPENSION_${action.toUpperCase()}`,
      en:
        action === "activate"
          ? "Financial operations were suspended for this scope."
          : "Financial operations were released from suspension for this scope.",
      es:
        action === "activate"
          ? "Las operaciones financieras fueron suspendidas para este alcance."
          : "Las operaciones financieras fueron liberadas de la suspensión para este alcance.",
      evidence: { emergency: actor.isSuperAdmin && !admin },
    });
    await client.query("COMMIT");
    return { id, action };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function evaluateSyntheticFinancialRequest(input: {
  actorUserId: number;
  projectId?: unknown;
  operation: unknown;
  makerUserId?: unknown;
  category?: unknown;
  amount?: unknown;
  relatedRequests?: unknown;
}) {
  const actor = await financialActor(input.actorUserId),
    scope = await scopeFor(actor, input.projectId),
    operation = String(input.operation) as FinancialOperation;
  if (
    ![
      "read",
      "prepare",
      "review",
      "approve",
      "manage",
      "audit_read",
      "export",
      "integrate",
      "ai",
    ].includes(operation)
  )
    throw new FinancialControlError(
      400,
      "FIN_OPERATION_INVALID",
      "The financial operation is not recognized.",
    );
  const entitlement = await resolveEffectiveEntitlement({
      featureKey: "cost_financial_control",
      userId: actor.userId,
      companyId: actor.companyId,
      projectId: scope.projectId ?? undefined,
    }),
    grants = await grantsFor(actor.userId, scope);
  const policiesResult = await pool.query(
    `SELECT * FROM financial_approval_policy_versions WHERE company_id=$1 AND (project_id IS NULL OR project_id=$2)`,
    [scope.companyId, scope.projectId],
  );
  const policies: ApprovalPolicy[] = policiesResult.rows.map((r) => ({
    id: String(r.id),
    scopeType: r.scope_type,
    companyId: Number(r.company_id),
    projectId: r.project_id == null ? null : Number(r.project_id),
    category: String(r.transaction_category),
    money: {
      amount: parseDecimal(String(r.max_amount)),
      currency: parseCurrency(r.currency),
    },
    effectiveFrom: new Date(r.effective_from),
    effectiveTo: r.effective_to ? new Date(r.effective_to) : null,
    state: r.state,
    version: Number(r.version),
  }));
  const related = Array.isArray(input.relatedRequests)
    ? input.relatedRequests.map((r: unknown) => {
        const x = r as Record<string, unknown>;
        return {
          makerUserId: positive(x.makerUserId, "related makerUserId"),
          category: bounded(x.category, "related category"),
          amount: parseMoney(x.amount),
          createdAt: date(x.createdAt),
        };
      })
    : [];
  const decision = evaluateFinancialAuthorization({
    operation,
    userId: actor.userId,
    companyId: scope.companyId,
    projectId: scope.projectId ?? undefined,
    makerUserId:
      input.makerUserId == null
        ? undefined
        : positive(input.makerUserId, "makerUserId"),
    category:
      input.category == null ? undefined : bounded(input.category, "category"),
    amount: input.amount == null ? undefined : parseMoney(input.amount),
    entitlementDecision: entitlement.decision === "allow" ? "allow" : "deny",
    companyCurrent: actor.companyId === scope.companyId,
    membershipActive: await membershipActive(actor.userId, scope),
    suspended: await suspended(scope),
    grants,
    policies,
    relatedRequests: related,
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await journal(client, {
      eventType: "authorization_evaluated",
      scope,
      actorUserId: actor.userId,
      subjectUserId: actor.userId,
      entityType: "synthetic_authorization_request",
      entityId: crypto.randomUUID(),
      decision: decision.decision,
      reasonCode: decision.code,
      en: decision.explanation.en,
      es: decision.explanation.es,
      evidence: {
        operation,
        matchedGrantIds: decision.matchedGrantIds,
        policyId: decision.policyId ?? null,
        requiresHigherReview: decision.requiresHigherReview === true,
        synthetic: true,
        entitlementCode: entitlement.code,
      },
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return {
    ...decision,
    commercial: {
      decision: entitlement.decision,
      code: entitlement.code,
      state: entitlement.state,
    },
    synthetic: true,
    noFinancialRecordCreated: true,
  };
}
