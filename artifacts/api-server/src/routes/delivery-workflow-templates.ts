import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";
import { ensureCompanyMasterCatalogSchema } from "../lib/company-master-catalog-migration";
import { ensureDeliveryWorkflowTemplateSchema } from "../lib/delivery-workflow-template-migration";
import { boundedDeliveryWorkflowDraft, deliveryWorkflowFingerprint, DeliveryWorkflowDefinitionError, validateDeliveryWorkflowDefinition } from "../lib/delivery-workflow-template-contract";
import { deliveryWorkflowOptions } from "../lib/delivery-workflow-selection";
import { previewGovernedWorkflowAllocation } from "../lib/delivery-workflow-allocation-source";
import { EconomicAllocationError } from "../lib/delivery-workflow-economic-allocation";
import { FinancialControlError } from "../lib/financial-control-contract";
import { waitForFinancialControlMigration } from "../lib/financial-control-migration";
import { economicCheckerAllowed, workflowTemplateCheckerAllowed } from "../lib/delivery-workflow-allocation-source-contract";
import { boundedWorkflowRetirementReason } from "../lib/delivery-workflow-retirement";
import { ensureWorkflowGovernancePolicySchema } from "../lib/workflow-governance-policy-migration";
import { applicablePublishedGovernance, assertGovernanceChangeAllowed, publishedGovernanceRows, validateWorkflowAgainstGovernance } from "../lib/workflow-governance-binding";

const router = Router();
const templateCode = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
const param = (value: string | string[]) => Array.isArray(value) ? value[0] ?? "" : value;
type Actor = { userId: number; companyId: number; canManage: boolean };
type Connection = { query(sql: string, params?: any[]): Promise<{ rows: any[] }> };

async function prepare(req: Request, res: Response, write = false): Promise<Actor | null> {
  await ensureCompanyMasterCatalogSchema();
  await ensureDeliveryWorkflowTemplateSchema();
  if (!req.user?.userId) { res.status(401).json({ code: "AUTHORITY_INVALID" }); return null; }
  const result = await pool.query(`SELECT u.id,u.company_id,
    (u.is_super_admin OR EXISTS (SELECT 1 FROM company_master_catalog_administrators a
      WHERE a.company_id=u.company_id AND a.user_id=u.id AND a.state='active')) AS can_manage
    FROM users u WHERE u.id=$1 LIMIT 1`, [req.user.userId]);
  const row = result.rows[0];
  if (!row || !row.company_id) { res.status(401).json({ code: "AUTHORITY_INVALID" }); return null; }
  const actor = { userId: Number(row.id), companyId: Number(row.company_id), canManage: row.can_manage === true };
  if (write && !actor.canManage) { res.status(403).json({ code: "DELIVERY_WORKFLOW_PMO_REQUIRED" }); return null; }
  return actor;
}

async function scopedTemplate(connection: Connection, id: string, actor: Actor, lock = false) {
  return (await connection.query(`SELECT id,company_id,code,name FROM company_delivery_workflow_templates
    WHERE id=$1 AND company_id=$2 ${lock ? "FOR UPDATE" : ""}`, [id, actor.companyId])).rows[0];
}
async function event(connection: Connection, actor: Actor, templateId: string, versionId: string, action: string, details: object = {}) {
  await connection.query(`INSERT INTO company_delivery_workflow_events
    (id,company_id,template_id,version_id,action,actor_id,details) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [randomUUID(),actor.companyId,templateId,versionId,action,actor.userId,JSON.stringify(details)]);
}
function invalid(res: Response, error: unknown): boolean {
  if (error instanceof DeliveryWorkflowDefinitionError) { res.status(400).json({ code: error.code, field: error.field }); return true; }
  if (error instanceof EconomicAllocationError) { res.status(400).json({ code: error.code, field: error.field }); return true; }
  if (error instanceof FinancialControlError) { res.status(error.status).json({ code: error.code }); return true; }
  return false;
}
async function economicPreview(connection: Connection, actor: Actor, definition: ReturnType<typeof validateDeliveryWorkflowDefinition>) {
  if (!definition.economicAllocation) return null;
  return previewGovernedWorkflowAllocation({
    client: connection, companyId: actor.companyId,
    sourceVersionId: definition.economicAllocation.sourceVersionId,
    proposal: definition.economicAllocation.proposal,
    workflowPhases: definition.phases,
  });
}
async function canApproveEconomics(connection: Connection, actor: Actor) {
  await waitForFinancialControlMigration();
  return (await connection.query(`SELECT EXISTS(SELECT 1 FROM financial_authority_grants g
    WHERE g.user_id=$1 AND g.company_id=$2 AND g.scope_type='company' AND g.authority='cost_approver'
      AND g.effective_from<=now() AND (g.effective_to IS NULL OR g.effective_to>now())
      AND NOT EXISTS(SELECT 1 FROM financial_authority_revocations r WHERE r.grant_id=g.id AND r.revoked_at<=now())) AS allowed`,
    [actor.userId,actor.companyId])).rows[0]?.allowed === true;
}
function conflict(res: Response, error: unknown): boolean {
  if ((error as { code?: string })?.code === "23505") { res.status(409).json({ code: "DELIVERY_WORKFLOW_DUPLICATE_OR_OPEN_VERSION" }); return true; }
  return false;
}
function expectedRevision(req: Request, res: Response): number | null {
  const revision = Number(req.body?.expectedRevision);
  if (!Number.isSafeInteger(revision) || revision < 1) { res.status(400).json({ code: "DELIVERY_WORKFLOW_EXPECTED_REVISION_REQUIRED" }); return null; }
  return revision;
}

router.get("/company/delivery-workflows", authMiddleware, async (req, res): Promise<void> => {
  const actor = await prepare(req, res); if (!actor) return;
  const result = await pool.query(`SELECT t.id,t.code,t.name,v.id "versionId",v.version,v.state,v.fingerprint,v.effective_from "effectiveFrom"
    FROM company_delivery_workflow_templates t JOIN company_delivery_workflow_versions v ON v.template_id=t.id
    WHERE t.company_id=$1 AND ($2::boolean OR v.state='published')
    ORDER BY t.code,v.version DESC`, [actor.companyId,actor.canManage]);
  res.json({ companyId: actor.companyId, canManage: actor.canManage, versions: result.rows });
});

router.get("/company/delivery-workflows/options", authMiddleware, async (req, res): Promise<void> => {
  const actor = await prepare(req, res); if (!actor) return;
  await ensureWorkflowGovernancePolicySchema();
  res.json(await deliveryWorkflowOptions(pool, actor.companyId));
});

router.post("/company/delivery-workflows/preview", authMiddleware, async (req, res): Promise<void> => {
  const actor = await prepare(req, res, true); if (!actor) return;
  try {
    const definition = validateDeliveryWorkflowDefinition(req.body?.definition);
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      const allocation = await economicPreview(connection, actor, definition);
      await connection.query("COMMIT");
      res.json({ definition, fingerprint: deliveryWorkflowFingerprint(definition), allocation,
        phaseCount: definition.phases.length,
        taskCount: definition.phases.reduce((count, phase) => count + phase.tasks.length, 0) });
    } catch (error) { await connection.query("ROLLBACK"); throw error; }
    finally { connection.release(); }
  } catch (error) { if (!invalid(res, error)) throw error; }
});

router.get("/company/delivery-workflows/:id", authMiddleware, async (req, res): Promise<void> => {
  const actor = await prepare(req, res); if (!actor) return;
  const result = await pool.query(`SELECT t.id "templateId",t.code,t.name,v.id "versionId",v.version,v.state,v.revision,
    v.definition,v.fingerprint,v.effective_from "effectiveFrom",v.created_at "createdAt"
    FROM company_delivery_workflow_templates t JOIN company_delivery_workflow_versions v ON v.template_id=t.id
    WHERE t.id=$1 AND t.company_id=$2 AND ($3::boolean OR v.state='published') ORDER BY v.version DESC`,
    [param(req.params.id),actor.companyId,actor.canManage]);
  if (!result.rows.length) { res.status(404).json({ code: "DELIVERY_WORKFLOW_NOT_FOUND" }); return; }
  const history = actor.canManage ? (await pool.query(`SELECT e.version_id "versionId",e.action,e.actor_id "actorId",u.full_name "actorName",e.details,e.created_at "createdAt"
    FROM company_delivery_workflow_events e LEFT JOIN users u ON u.id=e.actor_id AND u.company_id=e.company_id
    WHERE e.template_id=$1 AND e.company_id=$2 ORDER BY e.created_at,e.id`,
    [param(req.params.id),actor.companyId])).rows : [];
  res.json({ versions: result.rows, history });
});

router.post("/company/delivery-workflows", authMiddleware, async (req, res): Promise<void> => {
  const actor = await prepare(req, res, true); if (!actor) return;
  const code = String(req.body?.code ?? "").trim().toUpperCase();
  const name = req.body?.name;
  if (!templateCode.test(code) || typeof name !== "string" || !name.trim() || name.trim().length > 200 || /[\u0000-\u001f\u007f]/.test(name)) {
    res.status(400).json({ code: "DELIVERY_WORKFLOW_TEMPLATE_INVALID" }); return;
  }
  let definition: Record<string, unknown>;
  try { definition = boundedDeliveryWorkflowDraft(req.body?.definition); } catch (error) { if (invalid(res, error)) return; throw error; }
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    const templateId = randomUUID(); const versionId = randomUUID();
    await connection.query(`INSERT INTO company_delivery_workflow_templates(id,company_id,code,name,created_by_id)
      VALUES($1,$2,$3,$4,$5)`, [templateId,actor.companyId,code,name.trim(),actor.userId]);
    await connection.query(`INSERT INTO company_delivery_workflow_versions(id,template_id,version,definition,created_by_id,updated_by_id)
      VALUES($1,$2,1,$3::jsonb,$4,$4)`, [versionId,templateId,JSON.stringify(definition),actor.userId]);
    await event(connection,actor,templateId,versionId,"created");
    await connection.query("COMMIT");
    res.status(201).json({ templateId, versionId, version: 1, state: "draft", revision: 1 });
  } catch (error) { await connection.query("ROLLBACK"); if (!conflict(res,error)) throw error; }
  finally { connection.release(); }
});

router.post("/company/delivery-workflows/:id/versions", authMiddleware, async (req, res): Promise<void> => {
  const actor = await prepare(req, res, true); if (!actor) return;
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    const template = await scopedTemplate(connection,param(req.params.id),actor,true);
    if (!template) { await connection.query("ROLLBACK"); res.status(404).json({ code: "DELIVERY_WORKFLOW_NOT_FOUND" }); return; }
    const existing = await connection.query(`SELECT id FROM company_delivery_workflow_versions WHERE template_id=$1 AND state IN ('draft','approved')`, [template.id]);
    if (existing.rows.length) { await connection.query("ROLLBACK"); res.status(409).json({ code: "DELIVERY_WORKFLOW_OPEN_VERSION_EXISTS" }); return; }
    const latest = (await connection.query(`SELECT version,definition FROM company_delivery_workflow_versions
      WHERE template_id=$1 AND state IN ('published','superseded','retired') ORDER BY version DESC LIMIT 1`, [template.id])).rows[0];
    if (!latest) { await connection.query("ROLLBACK"); res.status(409).json({ code: "DELIVERY_WORKFLOW_NO_BASE_VERSION" }); return; }
    const versionId = randomUUID(); const version = Number(latest.version) + 1;
    await connection.query(`INSERT INTO company_delivery_workflow_versions(id,template_id,version,definition,created_by_id,updated_by_id)
      VALUES($1,$2,$3,$4::jsonb,$5,$5)`, [versionId,template.id,version,JSON.stringify(latest.definition),actor.userId]);
    await event(connection,actor,template.id,versionId,"created",{ clonedFromVersion: latest.version });
    await connection.query("COMMIT");
    res.status(201).json({ templateId: template.id, versionId, version, state: "draft", revision: 1 });
  } catch (error) { await connection.query("ROLLBACK"); if (!conflict(res,error)) throw error; }
  finally { connection.release(); }
});

router.patch("/company/delivery-workflows/:id/versions/:versionId", authMiddleware, async (req, res): Promise<void> => {
  const actor = await prepare(req, res, true); if (!actor) return;
  const revision = expectedRevision(req,res); if (revision === null) return;
  let definition: Record<string, unknown>;
  try { definition = boundedDeliveryWorkflowDraft(req.body?.definition); } catch (error) { if (invalid(res,error)) return; throw error; }
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    const result = await connection.query(`UPDATE company_delivery_workflow_versions v SET definition=$5::jsonb,revision=revision+1,
      updated_by_id=$6,updated_at=now() FROM company_delivery_workflow_templates t
      WHERE v.id=$1 AND v.template_id=t.id AND t.id=$2 AND t.company_id=$3 AND v.state='draft' AND v.revision=$4
      RETURNING v.id,v.version,v.revision,v.state`,
      [param(req.params.versionId),param(req.params.id),actor.companyId,revision,JSON.stringify(definition),actor.userId]);
    if (!result.rows[0]) { await connection.query("ROLLBACK"); res.status(409).json({ code: "DELIVERY_WORKFLOW_NOT_DRAFT_OR_STALE" }); return; }
    await event(connection,actor,param(req.params.id),param(req.params.versionId),"edited",{ revision: result.rows[0].revision });
    await connection.query("COMMIT");
    res.json({ version: result.rows[0] });
  } catch (error) { await connection.query("ROLLBACK"); throw error; }
  finally { connection.release(); }
});

router.post("/company/delivery-workflows/:id/versions/:versionId/approve", authMiddleware, async (req, res): Promise<void> => {
  const actor = await prepare(req,res,true); if (!actor) return;
  const revision = expectedRevision(req,res); if (revision === null) return;
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    const template = await scopedTemplate(connection,param(req.params.id),actor,true);
    if (!template) { await connection.query("ROLLBACK"); res.status(404).json({ code: "DELIVERY_WORKFLOW_NOT_FOUND" }); return; }
    const version = (await connection.query(`SELECT id,definition,revision,state,created_by_id,updated_by_id FROM company_delivery_workflow_versions
      WHERE id=$1 AND template_id=$2 FOR UPDATE`, [param(req.params.versionId),template.id])).rows[0];
    if (!version || version.state !== "draft" || Number(version.revision) !== revision) {
      await connection.query("ROLLBACK"); res.status(409).json({ code: "DELIVERY_WORKFLOW_NOT_DRAFT_OR_STALE" }); return;
    }
    const definition = validateDeliveryWorkflowDefinition(version.definition);
    const governance = applicablePublishedGovernance(await publishedGovernanceRows(connection,actor.companyId),String(template.id));
    if (governance) validateWorkflowAgainstGovernance(governance.definition,definition);
    const allocation = await economicPreview(connection, actor, definition);
    if (!workflowTemplateCheckerAllowed({
      creatorId: Number(version.created_by_id), lastEditorId: Number(version.updated_by_id), checkerId: actor.userId,
    })) {
      await connection.query("ROLLBACK"); res.status(403).json({ code: "DELIVERY_WORKFLOW_INDEPENDENT_CHECKER_REQUIRED" }); return;
    }
    if (allocation && !economicCheckerAllowed({
      creatorId: Number(version.created_by_id), lastEditorId: Number(version.updated_by_id),
      checkerId: actor.userId, hasFinanceGrant: await canApproveEconomics(connection, actor),
    })) {
      await connection.query("ROLLBACK"); res.status(403).json({ code: "DELIVERY_WORKFLOW_FINANCE_CHECKER_REQUIRED" }); return;
    }
    const fingerprint = deliveryWorkflowFingerprint(definition);
    await connection.query(`UPDATE company_delivery_workflow_versions SET state='approved',definition=$2::jsonb,fingerprint=$3,
      approved_at=now(),approved_by_id=$4,revision=revision+1,updated_by_id=$4,updated_at=now() WHERE id=$1`,
      [version.id,JSON.stringify(definition),fingerprint,actor.userId]);
    await event(connection,actor,template.id,version.id,"approved",{
      fingerprint, governancePolicyVersionId: governance?.versionId ?? null,
      governancePolicyFingerprint: governance?.fingerprint ?? null,
      ...(allocation ? { economicAllocationFingerprint: allocation.fingerprint,
        commercialApuVersionId: allocation.commercialApuVersionId } : {}),
    });
    await connection.query("COMMIT");
    res.json({ versionId: version.id, state: "approved", fingerprint, revision: revision + 1 });
  } catch (error) { await connection.query("ROLLBACK"); if (!invalid(res,error)) throw error; }
  finally { connection.release(); }
});

router.post("/company/delivery-workflows/:id/versions/:versionId/publish", authMiddleware, async (req, res): Promise<void> => {
  const actor = await prepare(req,res,true); if (!actor) return;
  const revision = expectedRevision(req,res); if (revision === null) return;
  await ensureWorkflowGovernancePolicySchema();
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    await connection.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:workflow-policy-publish'),$1::integer)",[actor.companyId]);
    await connection.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:workflow-policy-publish'),$1::integer)",[actor.companyId]);
    const template = await scopedTemplate(connection,param(req.params.id),actor,true);
    if (!template) { await connection.query("ROLLBACK"); res.status(404).json({ code: "DELIVERY_WORKFLOW_NOT_FOUND" }); return; }
    const version = (await connection.query(`SELECT id,definition,fingerprint,revision,state FROM company_delivery_workflow_versions
      WHERE id=$1 AND template_id=$2 FOR UPDATE`, [param(req.params.versionId),template.id])).rows[0];
    if (!version || version.state !== "approved" || Number(version.revision) !== revision) {
      await connection.query("ROLLBACK"); res.status(409).json({ code: "DELIVERY_WORKFLOW_NOT_APPROVED_OR_STALE" }); return;
    }
    const definition = validateDeliveryWorkflowDefinition(version.definition);
    if (deliveryWorkflowFingerprint(definition) !== version.fingerprint) {
      await connection.query("ROLLBACK"); res.status(409).json({ code: "DELIVERY_WORKFLOW_FINGERPRINT_MISMATCH" }); return;
    }
    const governance = applicablePublishedGovernance(await publishedGovernanceRows(connection,actor.companyId),String(template.id));
    if (governance) validateWorkflowAgainstGovernance(governance.definition,definition);
    const allocation = await economicPreview(connection, actor, definition);
    if (allocation) {
      const receipt = (await connection.query(`SELECT details FROM company_delivery_workflow_events
        WHERE company_id=$1 AND template_id=$2 AND version_id=$3 AND action='approved'
        ORDER BY created_at DESC,id DESC LIMIT 1`, [actor.companyId,template.id,version.id])).rows[0];
      if (receipt?.details?.economicAllocationFingerprint !== allocation.fingerprint) {
        await connection.query("ROLLBACK"); res.status(409).json({ code: "DELIVERY_WORKFLOW_ALLOCATION_CHANGED" }); return;
      }
    }
    const prior = (await connection.query(`UPDATE company_delivery_workflow_versions SET state='superseded',updated_at=now(),updated_by_id=$2
      WHERE template_id=$1 AND state='published' RETURNING id`, [template.id,actor.userId])).rows;
    for (const row of prior) await event(connection,actor,template.id,row.id,"superseded",{ byVersionId: version.id });
    await connection.query(`UPDATE company_delivery_workflow_versions SET state='published',published_at=now(),published_by_id=$2,
      effective_from=now(),revision=revision+1,updated_by_id=$2,updated_at=now() WHERE id=$1`, [version.id,actor.userId]);
    await event(connection,actor,template.id,version.id,"published",{
      fingerprint: version.fingerprint, ...(allocation ? { economicAllocationFingerprint: allocation.fingerprint } : {}),
      governancePolicyVersionId: governance?.versionId ?? null, governancePolicyFingerprint: governance?.fingerprint ?? null,
    });
    await connection.query("COMMIT");
    res.json({ versionId: version.id, state: "published", fingerprint: version.fingerprint, revision: revision + 1 });
  } catch (error) { await connection.query("ROLLBACK"); if (!invalid(res,error) && !conflict(res,error)) throw error; }
  finally { connection.release(); }
});

router.post("/company/delivery-workflows/:id/versions/:versionId/retire", authMiddleware, async (req, res): Promise<void> => {
  const actor = await prepare(req,res,true); if (!actor) return;
  const revision = expectedRevision(req,res); if (revision === null) return;
  const reason = boundedWorkflowRetirementReason(req.body?.reason);
  if (!reason) {
    res.status(400).json({ code: "DELIVERY_WORKFLOW_RETIRE_REASON_REQUIRED" }); return;
  }
  await ensureWorkflowGovernancePolicySchema();
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    await connection.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:workflow-policy-publish'),$1::integer)",[actor.companyId]);
    const template = await scopedTemplate(connection,param(req.params.id),actor,true);
    if (!template) { await connection.query("ROLLBACK"); res.status(404).json({ code: "DELIVERY_WORKFLOW_NOT_FOUND" }); return; }
    const governance = applicablePublishedGovernance(await publishedGovernanceRows(connection,actor.companyId),String(template.id));
    if (governance) assertGovernanceChangeAllowed(governance.definition,"retire_version");
    const version = (await connection.query(`UPDATE company_delivery_workflow_versions SET state='retired',retired_at=now(),retired_by_id=$4,
      revision=revision+1,updated_by_id=$4,updated_at=now() WHERE id=$1 AND template_id=$2 AND state IN ('published','superseded')
      AND revision=$3 RETURNING id,version,revision`, [param(req.params.versionId),template.id,revision,actor.userId])).rows[0];
    if (!version) { await connection.query("ROLLBACK"); res.status(409).json({ code: "DELIVERY_WORKFLOW_NOT_PUBLISHED_OR_STALE" }); return; }
    await event(connection,actor,template.id,version.id,"retired",{ reason });
    await connection.query("COMMIT"); res.json({ versionId: version.id, state: "retired", revision: version.revision });
  } catch (error) { await connection.query("ROLLBACK"); if (!invalid(res,error)) throw error; }
  finally { connection.release(); }
});

export default router;
