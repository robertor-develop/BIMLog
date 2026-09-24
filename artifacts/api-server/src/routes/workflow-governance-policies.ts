import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";
import { ensureWorkflowGovernancePolicySchema } from "../lib/workflow-governance-policy-migration";
import { validateWorkflowGovernancePolicy, workflowGovernancePolicyFingerprint, workflowPolicyIndependentCheckerAllowed, WorkflowGovernancePolicyError, type WorkflowGovernancePolicy } from "../lib/workflow-governance-policy-contract";
import { waitForFinancialControlMigration } from "../lib/financial-control-migration";
import { ensureDeliveryWorkflowTemplateSchema } from "../lib/delivery-workflow-template-migration";
import { policiesOverlap } from "../lib/workflow-governance-binding";

const router = Router();
const codePattern = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
const param = (value: string | string[]) => Array.isArray(value) ? value[0] ?? "" : value;
type Actor = { userId: number; companyId: number; canManage: boolean };
type Queryable = { query(sql: string, params?: any[]): Promise<{ rows: any[] }> };

async function prepare(req: Request, res: Response, write = false): Promise<Actor | null> {
  await ensureWorkflowGovernancePolicySchema();
  await ensureDeliveryWorkflowTemplateSchema();
  if (!req.user?.userId) { res.status(401).json({ code: "AUTHORITY_INVALID" }); return null; }
  const row = (await pool.query(`SELECT u.id,u.company_id,
    (u.is_super_admin OR EXISTS (SELECT 1 FROM company_master_catalog_administrators a
      WHERE a.company_id=u.company_id AND a.user_id=u.id AND a.state='active')) AS can_manage
    FROM users u WHERE u.id=$1 LIMIT 1`, [req.user.userId])).rows[0];
  if (!row?.company_id) { res.status(401).json({ code: "AUTHORITY_INVALID" }); return null; }
  const actor = { userId: Number(row.id), companyId: Number(row.company_id), canManage: row.can_manage === true };
  if (write && !actor.canManage) { res.status(403).json({ code: "WORKFLOW_POLICY_PMO_REQUIRED" }); return null; }
  return actor;
}
function expectedRevision(req: Request, res: Response): number | null {
  const value = req.body?.expectedRevision;
  if (!Number.isSafeInteger(value) || value < 1) { res.status(400).json({ code: "WORKFLOW_POLICY_EXPECTED_REVISION_REQUIRED" }); return null; }
  return value;
}
function definition(req: Request, res: Response): WorkflowGovernancePolicy | null {
  try { return validateWorkflowGovernancePolicy(req.body?.definition); }
  catch (error) {
    if (!(error instanceof WorkflowGovernancePolicyError)) throw error;
    res.status(400).json({ code: error.code, field: error.field }); return null;
  }
}
async function policy(connection: Queryable, actor: Actor, id: string, lock = false) {
  return (await connection.query(`SELECT id,company_id,code,name FROM company_workflow_governance_policies
    WHERE id=$1 AND company_id=$2 ${lock ? "FOR UPDATE" : ""}`, [id, actor.companyId])).rows[0];
}
async function event(connection: Queryable, actor: Actor, policyId: string, versionId: string, action: string, details: object = {}) {
  await connection.query(`INSERT INTO company_workflow_governance_events
    (id,company_id,policy_id,version_id,action,actor_id,details)
    VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`, [randomUUID(), actor.companyId, policyId, versionId, action, actor.userId, JSON.stringify(details)]);
}
async function financeChecker(connection: Queryable, actor: Actor): Promise<boolean> {
  await waitForFinancialControlMigration();
  return (await connection.query(`SELECT EXISTS(SELECT 1 FROM financial_authority_grants g
    WHERE g.user_id=$1 AND g.company_id=$2 AND g.scope_type='company' AND g.authority='cost_approver'
      AND g.effective_from<=now() AND (g.effective_to IS NULL OR g.effective_to>now())
      AND NOT EXISTS(SELECT 1 FROM financial_authority_revocations r WHERE r.grant_id=g.id AND r.revoked_at<=now())) AS allowed`,
    [actor.userId, actor.companyId])).rows[0]?.allowed === true;
}
async function scopeValid(connection: Queryable, actor: Actor, value: WorkflowGovernancePolicy): Promise<boolean> {
  if (value.scope.allWorkflows) return true;
  const rows = (await connection.query(`SELECT id FROM company_delivery_workflow_templates WHERE company_id=$1 AND id=ANY($2::text[])`,
    [actor.companyId, value.scope.workflowTemplateIds])).rows;
  return rows.length === value.scope.workflowTemplateIds.length;
}
function failed(res: Response, error: unknown): boolean {
  if ((error as { code?: string })?.code === "23505") { res.status(409).json({ code: "WORKFLOW_POLICY_DUPLICATE_OR_OPEN_VERSION" }); return true; }
  return false;
}

router.get("/company/workflow-governance-policies", authMiddleware, async (req, res): Promise<void> => {
  const actor = await prepare(req, res); if (!actor) return;
  const rows = (await pool.query(`SELECT p.id,p.code,p.name,v.id "versionId",v.version,v.revision,v.state,v.fingerprint
    FROM company_workflow_governance_policies p JOIN company_workflow_governance_versions v ON v.policy_id=p.id
    WHERE p.company_id=$1 AND ($2::boolean OR v.state='published') ORDER BY p.code,v.version DESC`, [actor.companyId, actor.canManage])).rows;
  res.json({ companyId: actor.companyId, canManage: actor.canManage, versions: rows });
});

router.get("/company/workflow-governance-policies/:id", authMiddleware, async (req, res): Promise<void> => {
  const actor = await prepare(req, res); if (!actor) return;
  const id = param(req.params.id);
  const versions = (await pool.query(`SELECT p.id "policyId",p.code,p.name,v.id "versionId",v.version,v.revision,v.state,
    v.definition,v.fingerprint,v.created_by_id "createdById",v.updated_by_id "updatedById",
    v.approved_by_id "approvedById",v.published_by_id "publishedById",v.retired_by_id "retiredById",
    v.created_at "createdAt",v.approved_at "approvedAt",v.published_at "publishedAt",v.retired_at "retiredAt"
    FROM company_workflow_governance_policies p JOIN company_workflow_governance_versions v ON v.policy_id=p.id
    WHERE p.id=$1 AND p.company_id=$2 AND ($3::boolean OR v.state='published') ORDER BY v.version DESC`,
    [id, actor.companyId, actor.canManage])).rows;
  if (!versions.length) { res.status(404).json({ code: "WORKFLOW_POLICY_NOT_FOUND" }); return; }
  const history = actor.canManage ? (await pool.query(`SELECT e.version_id "versionId",e.action,e.actor_id "actorId",
    u.full_name "actorName",e.details,e.created_at "createdAt"
    FROM company_workflow_governance_events e LEFT JOIN users u ON u.id=e.actor_id AND u.company_id=e.company_id
    WHERE e.policy_id=$1 AND e.company_id=$2 ORDER BY e.created_at,e.id`, [id, actor.companyId])).rows : [];
  res.json({ versions, history });
});

router.post("/company/workflow-governance-policies", authMiddleware, async (req, res): Promise<void> => {
  const actor = await prepare(req, res, true); if (!actor) return;
  const code = String(req.body?.code ?? "").trim().toUpperCase();
  const name = req.body?.name;
  if (!codePattern.test(code) || typeof name !== "string" || !name.trim() || name.trim().length > 200 || /[\u0000-\u001f\u007f]/.test(name)) {
    res.status(400).json({ code: "WORKFLOW_POLICY_IDENTITY_INVALID" }); return;
  }
  const value = definition(req, res); if (!value) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (!await scopeValid(client, actor, value)) { await client.query("ROLLBACK"); res.status(400).json({ code: "WORKFLOW_POLICY_SCOPE_INVALID" }); return; }
    const policyId = randomUUID(); const versionId = randomUUID();
    await client.query(`INSERT INTO company_workflow_governance_policies(id,company_id,code,name,created_by_id)
      VALUES($1,$2,$3,$4,$5)`, [policyId, actor.companyId, code, name.trim(), actor.userId]);
    await client.query(`INSERT INTO company_workflow_governance_versions(id,policy_id,version,definition,created_by_id,updated_by_id)
      VALUES($1,$2,1,$3::jsonb,$4,$4)`, [versionId, policyId, JSON.stringify(value), actor.userId]);
    await event(client, actor, policyId, versionId, "created");
    await client.query("COMMIT");
    res.status(201).json({ policyId, versionId, version: 1, revision: 1, state: "draft" });
  } catch (error) { await client.query("ROLLBACK"); if (!failed(res, error)) throw error; }
  finally { client.release(); }
});

router.post("/company/workflow-governance-policies/:id/versions", authMiddleware, async (req, res): Promise<void> => {
  const actor = await prepare(req, res, true); if (!actor) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await policy(client, actor, param(req.params.id), true);
    if (!current) { await client.query("ROLLBACK"); res.status(404).json({ code: "WORKFLOW_POLICY_NOT_FOUND" }); return; }
    const open = (await client.query(`SELECT id FROM company_workflow_governance_versions WHERE policy_id=$1 AND state IN ('draft','approved')`, [current.id])).rows;
    if (open.length) { await client.query("ROLLBACK"); res.status(409).json({ code: "WORKFLOW_POLICY_OPEN_VERSION_EXISTS" }); return; }
    const latest = (await client.query(`SELECT version,definition FROM company_workflow_governance_versions
      WHERE policy_id=$1 AND state IN ('published','superseded','retired') ORDER BY version DESC LIMIT 1`, [current.id])).rows[0];
    if (!latest) { await client.query("ROLLBACK"); res.status(409).json({ code: "WORKFLOW_POLICY_NO_BASE_VERSION" }); return; }
    const versionId = randomUUID(); const version = Number(latest.version) + 1;
    await client.query(`INSERT INTO company_workflow_governance_versions(id,policy_id,version,definition,created_by_id,updated_by_id)
      VALUES($1,$2,$3,$4::jsonb,$5,$5)`, [versionId, current.id, version, JSON.stringify(latest.definition), actor.userId]);
    await event(client, actor, current.id, versionId, "created", { clonedFromVersion: latest.version });
    await client.query("COMMIT");
    res.status(201).json({ policyId: current.id, versionId, version, revision: 1, state: "draft" });
  } catch (error) { await client.query("ROLLBACK"); if (!failed(res, error)) throw error; }
  finally { client.release(); }
});

router.patch("/company/workflow-governance-policies/:id/versions/:versionId", authMiddleware, async (req, res): Promise<void> => {
  const actor = await prepare(req, res, true); if (!actor) return;
  const revision = expectedRevision(req, res); if (revision === null) return;
  const value = definition(req, res); if (!value) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (!await scopeValid(client, actor, value)) { await client.query("ROLLBACK"); res.status(400).json({ code: "WORKFLOW_POLICY_SCOPE_INVALID" }); return; }
    const row = (await client.query(`UPDATE company_workflow_governance_versions v SET definition=$5::jsonb,
      revision=revision+1,updated_by_id=$6,updated_at=now() FROM company_workflow_governance_policies p
      WHERE v.id=$1 AND v.policy_id=p.id AND p.id=$2 AND p.company_id=$3 AND v.state='draft' AND v.revision=$4
      RETURNING v.id,v.version,v.revision,v.state`,
      [param(req.params.versionId), param(req.params.id), actor.companyId, revision, JSON.stringify(value), actor.userId])).rows[0];
    if (!row) { await client.query("ROLLBACK"); res.status(409).json({ code: "WORKFLOW_POLICY_NOT_DRAFT_OR_STALE" }); return; }
    await event(client, actor, param(req.params.id), row.id, "edited", { revision: row.revision });
    await client.query("COMMIT");
    res.json({ version: row });
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
});

router.post("/company/workflow-governance-policies/:id/versions/:versionId/approve", authMiddleware, async (req, res): Promise<void> => {
  const actor = await prepare(req, res, true); if (!actor) return;
  const revision = expectedRevision(req, res); if (revision === null) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await policy(client, actor, param(req.params.id), true);
    if (!current) { await client.query("ROLLBACK"); res.status(404).json({ code: "WORKFLOW_POLICY_NOT_FOUND" }); return; }
    const row = (await client.query(`SELECT id,definition,revision,state,created_by_id,updated_by_id FROM company_workflow_governance_versions
      WHERE id=$1 AND policy_id=$2 FOR UPDATE`, [param(req.params.versionId), current.id])).rows[0];
    if (!row || row.state !== "draft" || Number(row.revision) !== revision) {
      await client.query("ROLLBACK"); res.status(409).json({ code: "WORKFLOW_POLICY_NOT_DRAFT_OR_STALE" }); return;
    }
    const value = validateWorkflowGovernancePolicy(row.definition);
    if (!await scopeValid(client, actor, value)) { await client.query("ROLLBACK"); res.status(409).json({ code: "WORKFLOW_POLICY_SCOPE_CHANGED" }); return; }
    if (!workflowPolicyIndependentCheckerAllowed({ actorUserId:actor.userId,
      createdById:Number(row.created_by_id),updatedById:Number(row.updated_by_id) })) {
      await client.query("ROLLBACK"); res.status(403).json({ code: "WORKFLOW_POLICY_INDEPENDENT_CHECKER_REQUIRED" }); return;
    }
    if (!await financeChecker(client, actor)) {
      await client.query("ROLLBACK"); res.status(403).json({ code: "WORKFLOW_POLICY_FINANCE_CHECKER_REQUIRED" }); return;
    }
    const fingerprint = workflowGovernancePolicyFingerprint(value);
    await client.query(`UPDATE company_workflow_governance_versions SET state='approved',fingerprint=$2,
      approved_by_id=$3,approved_at=now(),revision=revision+1,updated_by_id=$3,updated_at=now() WHERE id=$1`,
      [row.id, fingerprint, actor.userId]);
    await event(client, actor, current.id, row.id, "approved", { fingerprint });
    await client.query("COMMIT");
    res.json({ versionId: row.id, state: "approved", fingerprint, revision: revision + 1 });
  } catch (error) { await client.query("ROLLBACK"); if (error instanceof WorkflowGovernancePolicyError) res.status(409).json({ code: error.code, field: error.field }); else throw error; }
  finally { client.release(); }
});

router.post("/company/workflow-governance-policies/:id/versions/:versionId/publish", authMiddleware, async (req, res): Promise<void> => {
  const actor = await prepare(req, res, true); if (!actor) return;
  const revision = expectedRevision(req, res); if (revision === null) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:workflow-policy-publish'),$1::integer)",[actor.companyId]);
    const current = await policy(client, actor, param(req.params.id), true);
    if (!current) { await client.query("ROLLBACK"); res.status(404).json({ code: "WORKFLOW_POLICY_NOT_FOUND" }); return; }
    const row = (await client.query(`SELECT id,definition,fingerprint,revision,state FROM company_workflow_governance_versions
      WHERE id=$1 AND policy_id=$2 FOR UPDATE`, [param(req.params.versionId), current.id])).rows[0];
    if (!row || row.state !== "approved" || Number(row.revision) !== revision) {
      await client.query("ROLLBACK"); res.status(409).json({ code: "WORKFLOW_POLICY_NOT_APPROVED_OR_STALE" }); return;
    }
    const value = validateWorkflowGovernancePolicy(row.definition);
    if (workflowGovernancePolicyFingerprint(value) !== row.fingerprint || !await scopeValid(client, actor, value)) {
      await client.query("ROLLBACK"); res.status(409).json({ code: "WORKFLOW_POLICY_SOURCE_CHANGED" }); return;
    }
    if (!await financeChecker(client, actor)) { await client.query("ROLLBACK"); res.status(403).json({ code: "WORKFLOW_POLICY_FINANCE_CHECKER_REQUIRED" }); return; }
    const others = (await client.query(`SELECT v.definition FROM company_workflow_governance_policies p
      JOIN company_workflow_governance_versions v ON v.policy_id=p.id
      WHERE p.company_id=$1 AND p.id<>$2 AND v.state='published' FOR UPDATE OF p`, [actor.companyId,current.id])).rows;
    if (others.some(other => policiesOverlap(value, validateWorkflowGovernancePolicy(other.definition)))) {
      await client.query("ROLLBACK"); res.status(409).json({ code: "WORKFLOW_POLICY_SCOPE_OVERLAP" }); return;
    }
    const prior = (await client.query(`UPDATE company_workflow_governance_versions SET state='superseded',updated_by_id=$2,updated_at=now()
      WHERE policy_id=$1 AND state='published' RETURNING id`, [current.id, actor.userId])).rows;
    for (const item of prior) await event(client, actor, current.id, item.id, "superseded", { byVersionId: row.id });
    await client.query(`UPDATE company_workflow_governance_versions SET state='published',published_by_id=$2,published_at=now(),
      revision=revision+1,updated_by_id=$2,updated_at=now() WHERE id=$1`, [row.id, actor.userId]);
    await event(client, actor, current.id, row.id, "published", { fingerprint: row.fingerprint });
    await client.query("COMMIT");
    res.json({ versionId: row.id, state: "published", fingerprint: row.fingerprint, revision: revision + 1 });
  } catch (error) { await client.query("ROLLBACK"); if (error instanceof WorkflowGovernancePolicyError) res.status(409).json({ code: error.code, field: error.field }); else throw error; }
  finally { client.release(); }
});

router.post("/company/workflow-governance-policies/:id/versions/:versionId/retire", authMiddleware, async (req, res): Promise<void> => {
  const actor = await prepare(req, res, true); if (!actor) return;
  const revision = expectedRevision(req, res); if (revision === null) return;
  const reason = req.body?.reason;
  if (typeof reason !== "string" || reason.trim().length < 5 || reason.trim().length > 500 || /[\u0000-\u001f\u007f]/.test(reason)) {
    res.status(400).json({ code: "WORKFLOW_POLICY_REASON_REQUIRED" }); return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:workflow-policy-publish'),$1::integer)",[actor.companyId]);
    const current = await policy(client, actor, param(req.params.id), true);
    if (!current) { await client.query("ROLLBACK"); res.status(404).json({ code: "WORKFLOW_POLICY_NOT_FOUND" }); return; }
    if (!await financeChecker(client, actor)) { await client.query("ROLLBACK"); res.status(403).json({ code: "WORKFLOW_POLICY_FINANCE_CHECKER_REQUIRED" }); return; }
    const row = (await client.query(`UPDATE company_workflow_governance_versions SET state='retired',retired_by_id=$4,
      retired_at=now(),revision=revision+1,updated_by_id=$4,updated_at=now()
      WHERE id=$1 AND policy_id=$2 AND state='published' AND revision=$3 RETURNING id,revision`,
      [param(req.params.versionId), current.id, revision, actor.userId])).rows[0];
    if (!row) { await client.query("ROLLBACK"); res.status(409).json({ code: "WORKFLOW_POLICY_NOT_PUBLISHED_OR_STALE" }); return; }
    await event(client, actor, current.id, row.id, "retired", { reason: reason.trim() });
    await client.query("COMMIT");
    res.json({ versionId: row.id, state: "retired", revision: row.revision });
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
});

export default router;
