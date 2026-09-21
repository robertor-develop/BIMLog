import { createHash, randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, requireProjectMember } from "../middlewares/auth";
import { ensureCompanyMasterCatalogSchema } from "../lib/company-master-catalog-migration";
import { waitForGenericApuPersistenceMigration } from "../lib/generic-apu-persistence-migration";
import { waitForFinancialControlMigration } from "../lib/financial-control-migration";
import { authorizeFinancialOperation } from "../lib/financial-control-service";
import { FinancialControlError } from "../lib/financial-control-contract";
import { PricingTemplateError, validatePricingTemplate, type PricingTemplateDefinition } from "../lib/company-pricing-template-contract";
import { GenericApuEvaluationError } from "../lib/generic-apu-engine";

const router = Router();
const codePattern = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
const parameter = (value: string | string[]) => Array.isArray(value) ? value[0] ?? "" : value;
type Actor = { userId: number; companyId: number; canManage: boolean };
type Connection = { query(sql: string, values?: unknown[]): Promise<{ rows: any[] }> };

async function hasEffectiveFinanceApprover(connection: Connection, actor: Actor) {
  return (await connection.query(`SELECT EXISTS(SELECT 1 FROM financial_authority_grants g
    WHERE g.user_id=$1 AND g.company_id=$2 AND g.scope_type='company' AND g.authority='cost_approver'
      AND g.effective_from<=now() AND (g.effective_to IS NULL OR g.effective_to>now())
      AND NOT EXISTS(SELECT 1 FROM financial_authority_revocations r WHERE r.grant_id=g.id AND r.revoked_at<=now())) AS allowed`,
    [actor.userId,actor.companyId])).rows[0]?.allowed === true;
}

async function actorFor(req: Request, res: Response, write = false): Promise<Actor | null> {
  await Promise.all([ensureCompanyMasterCatalogSchema(), waitForGenericApuPersistenceMigration()]);
  if (!req.user?.userId) { res.status(401).json({ code: "AUTHORITY_INVALID" }); return null; }
  const result = await pool.query(`SELECT u.id,u.company_id,
    (u.is_super_admin OR EXISTS (SELECT 1 FROM company_master_catalog_administrators a
      WHERE a.company_id=u.company_id AND a.user_id=u.id AND a.state='active')) AS can_manage
    FROM users u WHERE u.id=$1`, [req.user.userId]);
  const row = result.rows[0];
  if (!row?.company_id) { res.status(401).json({ code: "AUTHORITY_INVALID" }); return null; }
  const actor = { userId: Number(row.id), companyId: Number(row.company_id), canManage: row.can_manage === true };
  if (write && !actor.canManage) { res.status(403).json({ code: "PRICING_TEMPLATE_PMO_REQUIRED" }); return null; }
  return actor;
}

function respondError(error: unknown, res: Response) {
  if (error instanceof FinancialControlError) { res.status(error.status).json({ code: error.code, error: error.message }); return; }
  if (error instanceof PricingTemplateError) { res.status(400).json({ code: error.code, field: error.field }); return; }
  if (error instanceof GenericApuEvaluationError) { res.status(error.status).json({ code: error.code, error: error.message }); return; }
  if ((error as { code?: string })?.code === "23505") { res.status(409).json({ code: "PRICING_TEMPLATE_DUPLICATE" }); return; }
  console.error("[company-pricing-templates] request failed");
  res.status(500).json({ code: "PRICING_TEMPLATE_UNAVAILABLE" });
}

router.get("/projects/:projectId/pricing-template-options", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    await waitForGenericApuPersistenceMigration();
    const projectId = Number(parameter(req.params.projectId));
    if (!Number.isSafeInteger(projectId) || projectId <= 0)
      throw new FinancialControlError(400,"PROJECT_INVALID","A valid project is required.");
    const auth = await authorizeFinancialOperation({ actorUserId: req.user!.userId, projectId,
      featureKey: "cost.value_planner.view", operation: "read" });
    const currency = String(req.query.currency ?? "").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new FinancialControlError(400,"PRICING_TEMPLATE_CURRENCY_INVALID","A three-letter project currency is required.");
    const result = await pool.query(`SELECT * FROM (SELECT DISTINCT ON(template_id) id "versionId",template_id "templateId",version,
      name,industry,currency,status,content_fingerprint fingerprint
      FROM generic_apu_template_versions WHERE company_id=$1 AND project_id IS NULL AND status IN('published','retired')
      ORDER BY template_id,version DESC) current_version WHERE status='published' AND currency=$2`, [auth.scope.companyId,currency]);
    res.json({ options: result.rows, currency });
  } catch (error) { respondError(error,res); }
});

function boundedReason(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 2000 || /[\u0000-\u001f\u007f]/.test(value)) return null;
  return value.trim();
}

async function insertVersion(connection: Connection, input: {
  actor: Actor; templateId: string; version: number; definition: PricingTemplateDefinition;
  fingerprint: string; status: "draft" | "published" | "retired"; authorId: number; reason: string;
  sourceVersionId?: string; code: string;
}) {
  const id = randomUUID();
  // Drafts have an immutable, version-specific record identity; only a published
  // version's fingerprint is the canonical pricing-definition fingerprint.
  const recordFingerprint = input.status === "published" ? input.fingerprint
    : createHash("sha256").update(JSON.stringify({ id, definition: input.definition })).digest("hex");
  await connection.query(`INSERT INTO generic_apu_template_versions
    (id,template_id,company_id,project_id,version,name,industry,status,currency,reason,content_fingerprint,
     supersedes_id,provenance,created_by_id,published_by_id,published_at)
    VALUES($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15)`, [
    id,input.templateId,input.actor.companyId,input.version,input.definition.name,input.definition.industry,
    input.status,input.definition.currency,input.reason,recordFingerprint,input.sourceVersionId ?? null,
    JSON.stringify({ action: input.status === "published" ? "published" : input.status === "retired" ? "retired" : "draft_saved", code: input.code,
      definition: input.definition, definitionFingerprint: input.fingerprint, sourceVersionId: input.sourceVersionId ?? null }),
    input.authorId,input.status !== "draft" ? input.actor.userId : null,
    input.status !== "draft" ? new Date().toISOString() : null,
  ]);
  for (const [index, node] of input.definition.nodes.entries()) {
    const nodeFingerprint = createHash("sha256").update(JSON.stringify(node)).digest("hex");
    await connection.query(`INSERT INTO generic_apu_template_nodes
      (id,template_version_id,stable_node_id,parent_node_id,method,label,category,formula,percent,quantity,
       unit_cost,hours,hourly_rate,currency,sort_order,content_fingerprint,provenance)
      VALUES($1,$2,$3,NULL,$4,$5,'pricing',NULL,NULL,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`, [
      randomUUID(),id,node.id,node.method,node.label,
      node.method === "quantity_unit_cost" ? node.quantity : null,
      node.method === "fixed_amount" ? node.amount : node.method === "quantity_unit_cost" ? node.unitCost : null,
      node.method === "hours_hourly_rate" ? node.hours : null,
      node.method === "hours_hourly_rate" ? node.hourlyRate : null,
      input.definition.currency,index,nodeFingerprint,JSON.stringify({ definitionNode: node }),
    ]);
  }
  return { id, recordFingerprint };
}

router.get("/company/pricing-templates", authMiddleware, async (req, res) => {
  try {
    const actor = await actorFor(req,res,true); if (!actor) return;
    const result = await pool.query(`SELECT DISTINCT ON(template_id) id "versionId",template_id "templateId",version,
      name,industry,status,currency,content_fingerprint "recordFingerprint",provenance,created_at "createdAt"
      FROM generic_apu_template_versions WHERE company_id=$1 AND project_id IS NULL
      ORDER BY template_id,version DESC`, [actor.companyId]);
    res.json({ canManage: actor.canManage, templates: result.rows });
  } catch (error) { respondError(error,res); }
});

router.get("/company/pricing-templates/options", authMiddleware, async (req, res) => {
  try {
    const actor = await actorFor(req,res,true); if (!actor) return;
    const result = await pool.query(`SELECT * FROM (SELECT DISTINCT ON(template_id) id "versionId",template_id "templateId",version,
      name,industry,currency,status,content_fingerprint fingerprint,provenance
      FROM generic_apu_template_versions WHERE company_id=$1 AND project_id IS NULL AND status IN('published','retired')
      ORDER BY template_id,version DESC) current_version WHERE status='published'`, [actor.companyId]);
    res.json({ options: result.rows });
  } catch (error) { respondError(error,res); }
});

router.get("/company/pricing-templates/:templateId", authMiddleware, async (req, res) => {
  try {
    const actor = await actorFor(req,res,true); if (!actor) return;
    const result = await pool.query(`SELECT v.id "versionId",v.template_id "templateId",v.version,v.name,v.industry,
      v.status,v.currency,v.reason,v.content_fingerprint "recordFingerprint",v.provenance,
      v.created_by_id "createdById",v.published_by_id "publishedById",v.created_at "createdAt",v.published_at "publishedAt"
      FROM generic_apu_template_versions v WHERE v.template_id=$1 AND v.company_id=$2 AND v.project_id IS NULL
      ORDER BY v.version DESC`,
      [parameter(req.params.templateId),actor.companyId]);
    if (!result.rows.length) { res.status(404).json({ code: "PRICING_TEMPLATE_NOT_FOUND" }); return; }
    res.json({ versions: result.rows });
  } catch (error) { respondError(error,res); }
});

router.post("/company/pricing-templates/preview", authMiddleware, async (req, res) => {
  try {
    const actor = await actorFor(req,res,true); if (!actor) return;
    const result = validatePricingTemplate(req.body?.definition);
    res.json({ fingerprint: result.fingerprint, total: result.preview.roundedTotal,
      currency: result.definition.currency, lines: result.preview.lines });
  } catch (error) { respondError(error,res); }
});

router.post("/company/pricing-templates", authMiddleware, async (req, res) => {
  try {
    const actor = await actorFor(req,res,true); if (!actor) return;
    const code = String(req.body?.code ?? "").trim().toUpperCase();
    const reason = boundedReason(req.body?.reason);
    if (!codePattern.test(code) || !reason) { res.status(400).json({ code: "PRICING_TEMPLATE_CODE_OR_REASON_INVALID" }); return; }
    const { definition, fingerprint } = validatePricingTemplate(req.body?.definition);
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      await connection.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`pricing:${actor.companyId}:${code}`]);
      const existing = await connection.query(`SELECT id FROM generic_apu_template_versions
        WHERE company_id=$1 AND project_id IS NULL AND version=1 AND provenance->>'code'=$2 LIMIT 1`,
        [actor.companyId,code]);
      if (existing.rows.length) { await connection.query("ROLLBACK"); res.status(409).json({ code: "PRICING_TEMPLATE_CODE_EXISTS" }); return; }
      const templateId = randomUUID();
      const version = await insertVersion(connection,{ actor,templateId,version:1,definition,fingerprint,status:"draft",authorId:actor.userId,reason,code });
      await connection.query("COMMIT");
      res.status(201).json({ templateId,versionId:version.id,version:1,status:"draft" });
    } catch (error) { await connection.query("ROLLBACK"); throw error; }
    finally { connection.release(); }
  } catch (error) { respondError(error,res); }
});

router.post("/company/pricing-templates/:templateId/versions", authMiddleware, async (req, res) => {
  try {
    const actor = await actorFor(req,res,true); if (!actor) return;
    const reason = boundedReason(req.body?.reason);
    const expectedVersion = Number(req.body?.expectedVersion);
    if (!reason || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
      res.status(400).json({ code: "PRICING_TEMPLATE_VERSION_OR_REASON_INVALID" }); return;
    }
    const { definition, fingerprint } = validatePricingTemplate(req.body?.definition);
    const templateId = parameter(req.params.templateId);
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      await connection.query("SELECT pg_advisory_xact_lock(hashtext($1))", [templateId]);
      const latest = (await connection.query(`SELECT id,version,provenance FROM generic_apu_template_versions
        WHERE template_id=$1 AND company_id=$2 AND project_id IS NULL ORDER BY version DESC LIMIT 1`,
        [templateId,actor.companyId])).rows[0];
      if (!latest) { await connection.query("ROLLBACK"); res.status(404).json({ code: "PRICING_TEMPLATE_NOT_FOUND" }); return; }
      if (Number(latest.version) !== expectedVersion) { await connection.query("ROLLBACK"); res.status(409).json({ code: "PRICING_TEMPLATE_STALE_VERSION" }); return; }
      const version = await insertVersion(connection,{ actor,templateId,version:expectedVersion+1,definition,fingerprint,
        status:"draft",authorId:actor.userId,reason,sourceVersionId:latest.id,code:latest.provenance?.code ?? "" });
      await connection.query("COMMIT");
      res.status(201).json({ templateId,versionId:version.id,version:expectedVersion+1,status:"draft" });
    } catch (error) { await connection.query("ROLLBACK"); throw error; }
    finally { connection.release(); }
  } catch (error) { respondError(error,res); }
});

router.post("/company/pricing-templates/:templateId/publish", authMiddleware, async (req, res) => {
  try {
    const actor = await actorFor(req,res,true); if (!actor) return;
    await waitForFinancialControlMigration();
    const reason = boundedReason(req.body?.reason);
    const expectedVersion = Number(req.body?.expectedVersion);
    if (!reason || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
      res.status(400).json({ code: "PRICING_TEMPLATE_VERSION_OR_REASON_INVALID" }); return;
    }
    const templateId = parameter(req.params.templateId);
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      await connection.query("SELECT pg_advisory_xact_lock(hashtext($1))", [templateId]);
      const latest = (await connection.query(`SELECT id,version,status,created_by_id,content_fingerprint,provenance FROM generic_apu_template_versions
        WHERE template_id=$1 AND company_id=$2 AND project_id IS NULL ORDER BY version DESC LIMIT 1`,
        [templateId,actor.companyId])).rows[0];
      if (!latest) { await connection.query("ROLLBACK"); res.status(404).json({ code: "PRICING_TEMPLATE_NOT_FOUND" }); return; }
      if (Number(latest.version) !== expectedVersion || latest.status !== "draft") {
        await connection.query("ROLLBACK"); res.status(409).json({ code: "PRICING_TEMPLATE_NOT_LATEST_DRAFT" }); return;
      }
      if (Number(latest.created_by_id) === actor.userId) {
        await connection.query("ROLLBACK"); res.status(403).json({ code: "PRICING_TEMPLATE_MAKER_CHECKER_REQUIRED" }); return;
      }
      if (!(await hasEffectiveFinanceApprover(connection,actor))) {
        await connection.query("ROLLBACK"); res.status(403).json({ code: "PRICING_TEMPLATE_FINANCE_APPROVER_REQUIRED" }); return;
      }
      const { definition, fingerprint } = validatePricingTemplate(latest.provenance?.definition);
      if (fingerprint !== latest.provenance?.definitionFingerprint) {
        await connection.query("ROLLBACK"); res.status(409).json({ code: "PRICING_TEMPLATE_FINGERPRINT_MISMATCH" }); return;
      }
      const version = await insertVersion(connection,{ actor,templateId,version:expectedVersion+1,definition,fingerprint,
        status:"published",authorId:Number(latest.created_by_id),reason,sourceVersionId:latest.id,code:latest.provenance.code });
      await connection.query("COMMIT");
      res.status(201).json({ templateId,versionId:version.id,version:expectedVersion+1,status:"published",fingerprint });
    } catch (error) { await connection.query("ROLLBACK"); throw error; }
    finally { connection.release(); }
  } catch (error) { respondError(error,res); }
});

router.post("/company/pricing-templates/:templateId/retire", authMiddleware, async (req, res) => {
  try {
    const actor = await actorFor(req,res,true); if (!actor) return;
    await waitForFinancialControlMigration();
    const reason = boundedReason(req.body?.reason);
    const expectedVersion = Number(req.body?.expectedVersion);
    if (!reason || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
      res.status(400).json({ code: "PRICING_TEMPLATE_VERSION_OR_REASON_INVALID" }); return;
    }
    const templateId = parameter(req.params.templateId);
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      await connection.query("SELECT pg_advisory_xact_lock(hashtext($1))", [templateId]);
      const latest = (await connection.query(`SELECT id,version,status,created_by_id,content_fingerprint,provenance FROM generic_apu_template_versions
        WHERE template_id=$1 AND company_id=$2 AND project_id IS NULL ORDER BY version DESC LIMIT 1`,
        [templateId,actor.companyId])).rows[0];
      if (!latest) { await connection.query("ROLLBACK"); res.status(404).json({ code: "PRICING_TEMPLATE_NOT_FOUND" }); return; }
      if (Number(latest.version) !== expectedVersion || latest.status !== "published") {
        await connection.query("ROLLBACK"); res.status(409).json({ code: "PRICING_TEMPLATE_NOT_LATEST_PUBLISHED" }); return;
      }
      if (Number(latest.created_by_id) === actor.userId) {
        await connection.query("ROLLBACK"); res.status(403).json({ code: "PRICING_TEMPLATE_MAKER_CHECKER_REQUIRED" }); return;
      }
      if (!(await hasEffectiveFinanceApprover(connection,actor))) {
        await connection.query("ROLLBACK"); res.status(403).json({ code: "PRICING_TEMPLATE_FINANCE_APPROVER_REQUIRED" }); return;
      }
      const { definition, fingerprint } = validatePricingTemplate(latest.provenance?.definition);
      if (fingerprint !== latest.provenance?.definitionFingerprint || fingerprint !== latest.content_fingerprint) {
        await connection.query("ROLLBACK"); res.status(409).json({ code: "PRICING_TEMPLATE_FINGERPRINT_MISMATCH" }); return;
      }
      const version = await insertVersion(connection,{ actor,templateId,version:expectedVersion+1,definition,fingerprint,
        status:"retired",authorId:Number(latest.created_by_id),reason,sourceVersionId:latest.id,code:latest.provenance.code });
      await connection.query("COMMIT");
      res.status(201).json({ templateId,versionId:version.id,version:expectedVersion+1,status:"retired",sourceFingerprint:fingerprint });
    } catch (error) { await connection.query("ROLLBACK"); throw error; }
    finally { connection.release(); }
  } catch (error) { respondError(error,res); }
});

export default router;
