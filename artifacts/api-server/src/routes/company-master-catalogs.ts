import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, isSuperAdminMiddleware } from "../middlewares/auth";
import { ensureCompanyMasterCatalogSchema } from "../lib/company-master-catalog-migration";
import { classificationColumn, normalizeCompanyCatalogUsage, type CompanyCatalogKind } from "../lib/company-master-catalog-usage";

const router = Router();
const kinds = new Set(["client", "discipline", "service", "phase"]);
const codePattern = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
const plainName = (value: unknown) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= 200 && !/[\u0000-\u001f\u007f]/.test(value);
const parameter = (value: string | string[]) => Array.isArray(value) ? value[0] ?? "" : value;

function aliasesOf(value: unknown, name: string, code: string): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) return null;
  const seen = new Set([name.trim().toLocaleLowerCase(), code.trim().toLocaleLowerCase()]);
  const aliases: string[] = [];
  for (const candidate of value) {
    if (!plainName(candidate)) return null;
    const alias = candidate.trim();
    const key = alias.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    aliases.push(alias);
  }
  return aliases;
}

async function actor(req: Request): Promise<{ userId: number; companyId: number; isSuperAdmin: boolean; isPmo: boolean } | null> {
  if (!req.user?.userId) return null;
  const result = await pool.query(`SELECT u.id,u.company_id,u.is_super_admin,
    EXISTS(SELECT 1 FROM company_master_catalog_administrators a
      WHERE a.company_id=u.company_id AND a.user_id=u.id AND a.state='active') AS is_pmo
    FROM users u WHERE u.id=$1 LIMIT 1`, [req.user.userId]);
  const row = result.rows[0];
  if (!row) return null;
  return { userId: Number(row.id), companyId: Number(row.company_id), isSuperAdmin: row.is_super_admin === true, isPmo: row.is_pmo === true };
}

function kindOf(req: Request, res: Response): string | null {
  const kind = parameter(req.params.kind);
  if (!kinds.has(kind)) { res.status(404).json({ code: "COMPANY_CATALOG_KIND_NOT_FOUND" }); return null; }
  return kind;
}

router.get("/company/master-catalogs/capabilities", authMiddleware, async (req, res): Promise<void> => {
  await ensureCompanyMasterCatalogSchema();
  const current = await actor(req);
  if (!current) { res.status(401).json({ code: "AUTHORITY_INVALID" }); return; }
  const policy = (await pool.query(`SELECT mode,version FROM company_master_catalog_policies WHERE company_id=$1`, [current.companyId])).rows[0];
  res.json({ companyId: current.companyId, canManage: current.isPmo || current.isSuperAdmin, isSuperAdmin: current.isSuperAdmin,
    mode: policy?.mode ?? "defaults_allowed", policyVersion: policy?.version ?? null });
});

router.patch("/company/master-catalogs/policy", authMiddleware, async (req, res): Promise<void> => {
  await ensureCompanyMasterCatalogSchema();
  const current = await actor(req);
  if (!current || (!current.isPmo && !current.isSuperAdmin)) { res.status(403).json({ code: "COMPANY_CATALOG_PMO_REQUIRED" }); return; }
  const mode = req.body?.mode;
  const expectedVersion = Number(req.body?.expectedVersion);
  if (!["approved_only", "defaults_allowed"].includes(mode) || !Number.isSafeInteger(expectedVersion) || expectedVersion <= 0) {
    res.status(400).json({ code: "COMPANY_CATALOG_POLICY_INVALID" }); return;
  }
  const result = await pool.query(`UPDATE company_master_catalog_policies SET mode=$2,version=version+1,updated_by_id=$3,updated_at=now()
    WHERE company_id=$1 AND version=$4 RETURNING mode,version`, [current.companyId,mode,current.userId,expectedVersion]);
  if (!result.rows[0]) { res.status(409).json({ code: "COMPANY_CATALOG_POLICY_STALE" }); return; }
  res.json({ policy: result.rows[0] });
});

router.get("/company/master-catalogs/:kind", authMiddleware, async (req, res): Promise<void> => {
  const kind = kindOf(req, res); if (!kind) return;
  await ensureCompanyMasterCatalogSchema();
  const current = await actor(req);
  if (!current) { res.status(401).json({ code: "AUTHORITY_INVALID" }); return; }
  const includeInactive = req.query.includeInactive === "true" && (current.isPmo || current.isSuperAdmin);
  const result = await pool.query(`SELECT id,kind,code,name,aliases,canonical_company_id "canonicalCompanyId",state,version,created_at "createdAt",updated_at "updatedAt"
    FROM company_master_catalog_entries WHERE company_id=$1 AND kind=$2 AND ($3::boolean OR state='active') ORDER BY name,id`, [current.companyId,kind,includeInactive]);
  res.json({ kind, companyId: current.companyId, canManage: current.isPmo || current.isSuperAdmin, entries: result.rows });
});

router.get("/company/master-catalogs/:kind/:id/usage", authMiddleware, async (req, res): Promise<void> => {
  const kind = kindOf(req, res) as CompanyCatalogKind | null; if (!kind) return;
  await ensureCompanyMasterCatalogSchema();
  const current = await actor(req);
  if (!current) { res.status(401).json({ code: "AUTHORITY_INVALID" }); return; }
  const entry = (await pool.query(`SELECT id,company_id,kind,canonical_company_id "canonicalCompanyId",state,version
    FROM company_master_catalog_entries entry WHERE entry.id=$1 AND entry.company_id=$2 AND entry.kind=$3 LIMIT 1`,
    [parameter(req.params.id), current.companyId, kind])).rows[0];
  if (!entry) { res.status(404).json({ code: "COMPANY_CATALOG_NOT_FOUND" }); return; }

  if (kind === "client") {
    const result = await pool.query(`SELECT
      count(*)::int "intakeCount",
      0::int "taskCount",
      0::int "workPackageCount"
      FROM job_intakes ji
      WHERE ji.company_id=$2 AND ji.data #>> '{identity,clientCompanyId}'=$1`,
    [String(entry.canonicalCompanyId ?? ""), current.companyId]);
    res.json({ entry, usage: normalizeCompanyCatalogUsage(result.rows[0] ?? {}) }); return;
  }

  const column = classificationColumn(kind)!;
  const result = await pool.query(`SELECT
    (SELECT count(*)::int FROM job_intakes ji WHERE ji.company_id=$2 AND ji.data #>> ARRAY['classification',$3||'Id']=$1) "intakeCount",
    (SELECT count(*)::int FROM job_activation_tasks task
      JOIN job_activation_work_items item ON item.id=task.work_item_id
      JOIN job_intakes ji ON ji.id=item.intake_id
      WHERE ji.company_id=$2 AND task.${column}=$1) "taskCount",
    (SELECT count(*)::int FROM job_activation_work_packages package
      JOIN job_intakes ji ON ji.id=package.intake_id
      WHERE ji.company_id=$2 AND package.${column}=$1) "workPackageCount"`,
  [entry.id, current.companyId, kind]);
  res.json({ entry, usage: normalizeCompanyCatalogUsage(result.rows[0] ?? {}) });
});

router.post("/company/master-catalogs/:kind", authMiddleware, async (req, res): Promise<void> => {
  const kind = kindOf(req, res); if (!kind) return;
  await ensureCompanyMasterCatalogSchema();
  const current = await actor(req);
  if (!current || (!current.isPmo && !current.isSuperAdmin)) { res.status(403).json({ code: "COMPANY_CATALOG_PMO_REQUIRED" }); return; }
  const code = String(req.body?.code ?? "").trim().toUpperCase();
  const name = req.body?.name;
  const aliases = plainName(name) ? aliasesOf(req.body?.aliases, name.trim(), code) : null;
  if (!codePattern.test(code) || !plainName(name) || aliases === null) { res.status(400).json({ code: "COMPANY_CATALOG_INVALID" }); return; }
  const suppliedClientCompanyId = req.body?.canonicalCompanyId == null ? null : Number(req.body.canonicalCompanyId);
  if (kind === "client" && suppliedClientCompanyId !== null && (!Number.isSafeInteger(suppliedClientCompanyId) || suppliedClientCompanyId <= 0)) { res.status(400).json({ code: "CLIENT_COMPANY_INVALID" }); return; }
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    let clientCompanyId: number | null = null;
    if (kind === "client") {
      await connection.query(`SELECT pg_advisory_xact_lock(hashtext(lower($1)))`, [name.trim()]);
      if (suppliedClientCompanyId !== null) {
        const existing = await connection.query(`SELECT id,name FROM companies WHERE id=$1 LIMIT 1`, [suppliedClientCompanyId]);
        if (!existing.rows[0] || existing.rows[0].name.trim().toLowerCase() !== name.trim().toLowerCase()) { await connection.query("ROLLBACK"); res.status(400).json({ code: "CLIENT_COMPANY_MISMATCH" }); return; }
        clientCompanyId = suppliedClientCompanyId;
      } else {
        const existing = await connection.query(`SELECT id FROM companies WHERE lower(trim(name))=lower(trim($1)) ORDER BY id LIMIT 1`, [name.trim()]);
        clientCompanyId = Number(existing.rows[0]?.id ?? (await connection.query(`INSERT INTO companies(name) VALUES($1) RETURNING id`, [name.trim()])).rows[0].id);
      }
    }
    const result = await connection.query(`INSERT INTO company_master_catalog_entries
      (id,company_id,kind,code,name,aliases,canonical_company_id,created_by_id,updated_by_id)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$8)
      RETURNING id,kind,code,name,aliases,canonical_company_id "canonicalCompanyId",state,version`,
      [randomUUID(),current.companyId,kind,code,name.trim(),JSON.stringify(aliases),clientCompanyId,current.userId]);
    await connection.query("COMMIT");
    res.status(201).json({ entry: result.rows[0] });
  } catch (error: any) {
    await connection.query("ROLLBACK");
    if (error?.code === "23505") { res.status(409).json({ code: "COMPANY_CATALOG_DUPLICATE" }); return; }
    throw error;
  } finally {
    connection.release();
  }
});

router.patch("/company/master-catalogs/:kind/:id", authMiddleware, async (req, res): Promise<void> => {
  const kind = kindOf(req, res); if (!kind) return;
  await ensureCompanyMasterCatalogSchema();
  const current = await actor(req);
  if (!current || (!current.isPmo && !current.isSuperAdmin)) { res.status(403).json({ code: "COMPANY_CATALOG_PMO_REQUIRED" }); return; }
  const state = req.body?.state;
  const name = req.body?.name;
  const aliasesProvided = req.body?.aliases !== undefined;
  const expectedVersion = Number(req.body?.expectedVersion);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion <= 0 || (state !== undefined && !["active","inactive","retired"].includes(state)) || (name !== undefined && !plainName(name))) {
    res.status(400).json({ code: "COMPANY_CATALOG_UPDATE_INVALID" }); return;
  }
  if (kind === "client" && name !== undefined) { res.status(400).json({ code: "CLIENT_NAME_CANONICAL_COMPANY_ONLY" }); return; }
  const currentEntry = (await pool.query(`SELECT code,name FROM company_master_catalog_entries WHERE id=$1 AND company_id=$2 AND kind=$3 LIMIT 1`, [parameter(req.params.id),current.companyId,kind])).rows[0];
  if (!currentEntry) { res.status(404).json({ code: "COMPANY_CATALOG_NOT_FOUND" }); return; }
  const aliases = aliasesProvided ? aliasesOf(req.body.aliases, name?.trim() ?? currentEntry.name, currentEntry.code) : undefined;
  if (aliasesProvided && aliases === null) { res.status(400).json({ code: "COMPANY_CATALOG_ALIASES_INVALID" }); return; }
  const result = await pool.query(`UPDATE company_master_catalog_entries SET
    name=COALESCE($5,name), aliases=CASE WHEN $6::boolean THEN $7::jsonb ELSE aliases END,
    state=COALESCE($8,state), retired_at=CASE WHEN $8='retired' THEN now() WHEN $8 IS NOT NULL THEN NULL ELSE retired_at END,
    version=version+1,updated_by_id=$9,updated_at=now()
    WHERE id=$1 AND company_id=$2 AND kind=$3 AND version=$4
    RETURNING id,kind,code,name,aliases,canonical_company_id "canonicalCompanyId",state,version`,
    [parameter(req.params.id),current.companyId,kind,expectedVersion,name?.trim() ?? null,aliasesProvided,JSON.stringify(aliases ?? []),state ?? null,current.userId]);
  if (!result.rows[0]) { res.status(409).json({ code: "COMPANY_CATALOG_NOT_FOUND_OR_VERSION_CONFLICT" }); return; }
  res.json({ entry: result.rows[0] });
});

router.post("/admin/company-master-catalog-grants", authMiddleware, isSuperAdminMiddleware, async (req, res): Promise<void> => {
  await ensureCompanyMasterCatalogSchema();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!email || email.length > 254 || !email.includes("@")) { res.status(400).json({ code: "COMPANY_CATALOG_GRANT_INVALID" }); return; }
  const target = await pool.query(`SELECT id,company_id,email,full_name FROM users WHERE lower(email)=$1 LIMIT 1`, [email]);
  if (!target.rows[0]) { res.status(404).json({ code: "COMPANY_CATALOG_GRANT_USER_NOT_FOUND" }); return; }
  const targetUserId = Number(target.rows[0].id);
  const targetCompanyId = Number(target.rows[0].company_id);
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    const result = await connection.query(`INSERT INTO company_master_catalog_administrators(id,company_id,user_id,granted_by_id)
      VALUES($1,$2,$3,$4) RETURNING id,company_id "companyId",user_id "userId",state`,
      [randomUUID(),targetCompanyId,targetUserId,req.user!.userId]);
    await connection.query(`INSERT INTO company_master_catalog_policies(company_id,mode,updated_by_id)
      VALUES($1,'defaults_allowed',$2) ON CONFLICT (company_id) DO NOTHING`, [targetCompanyId,req.user!.userId]);
    await connection.query("COMMIT");
    res.status(201).json({ grant: { ...result.rows[0], email: target.rows[0].email, fullName: target.rows[0].full_name } });
  } catch (error: any) {
    await connection.query("ROLLBACK");
    if (error?.code === "23505") { res.status(409).json({ code: "COMPANY_CATALOG_GRANT_EXISTS" }); return; }
    throw error;
  } finally {
    connection.release();
  }
});

router.get("/admin/company-master-catalog-grants/:companyId", authMiddleware, isSuperAdminMiddleware, async (req, res): Promise<void> => {
  await ensureCompanyMasterCatalogSchema();
  const companyId = Number(parameter(req.params.companyId));
  if (!Number.isSafeInteger(companyId) || companyId <= 0) { res.status(400).json({ code: "COMPANY_ID_INVALID" }); return; }
  const result = await pool.query(`SELECT a.id,a.user_id "userId",u.full_name "fullName",u.email,a.state,a.granted_at "grantedAt",a.revoked_at "revokedAt"
    FROM company_master_catalog_administrators a JOIN users u ON u.id=a.user_id
    WHERE a.company_id=$1 ORDER BY a.granted_at DESC`, [companyId]);
  res.json({ companyId, grants: result.rows });
});

router.post("/admin/company-master-catalog-grants/revoke-by-email", authMiddleware, isSuperAdminMiddleware, async (req, res): Promise<void> => {
  await ensureCompanyMasterCatalogSchema();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!email || email.length > 254 || !email.includes("@")) { res.status(400).json({ code: "COMPANY_CATALOG_GRANT_INVALID" }); return; }
  const result = await pool.query(`UPDATE company_master_catalog_administrators a SET state='revoked',revoked_by_id=$2,revoked_at=now()
    FROM users u WHERE a.user_id=u.id AND a.company_id=u.company_id AND lower(u.email)=$1 AND a.state='active'
    RETURNING a.id,a.company_id "companyId",a.user_id "userId",a.state`, [email,req.user!.userId]);
  if (!result.rows[0]) { res.status(404).json({ code: "COMPANY_CATALOG_GRANT_NOT_ACTIVE" }); return; }
  res.json({ grant: result.rows[0] });
});

router.post("/admin/company-master-catalog-grants/:id/revoke", authMiddleware, isSuperAdminMiddleware, async (req, res): Promise<void> => {
  await ensureCompanyMasterCatalogSchema();
  const result = await pool.query(`UPDATE company_master_catalog_administrators SET state='revoked',revoked_by_id=$2,revoked_at=now()
    WHERE id=$1 AND state='active' RETURNING id,company_id "companyId",user_id "userId",state`, [parameter(req.params.id),req.user!.userId]);
  if (!result.rows[0]) { res.status(404).json({ code: "COMPANY_CATALOG_GRANT_NOT_ACTIVE" }); return; }
  res.json({ grant: result.rows[0] });
});

export default router;
