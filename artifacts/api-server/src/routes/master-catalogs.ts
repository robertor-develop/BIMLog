import { randomUUID } from "node:crypto";
import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { enterprisePhasesTable, enterpriseServicesTable, enterpriseTradesTable } from "@workspace/db/schema";
import { authMiddleware, isSuperAdminMiddleware } from "../middlewares/auth";
import { ensureCompanyMasterCatalogSchema } from "../lib/company-master-catalog-migration";

const router = Router();
const tables = { services: enterpriseServicesTable, phases: enterprisePhasesTable } as const;
type CatalogName = keyof typeof tables;

function catalog(name: string) {
  if (name !== "services" && name !== "phases") return null;
  return tables[name as CatalogName];
}

function param(value: string | string[]) { return Array.isArray(value) ? value[0] ?? "" : value; }

function normalizedCode(value: unknown) {
  const code = String(value ?? "").trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(code) ? code : null;
}

router.get("/master-catalogs/:catalog", authMiddleware, async (req, res): Promise<void> => {
  const catalogName = param(req.params.catalog);
  await ensureCompanyMasterCatalogSchema();
  const actor = (await pool.query(`SELECT company_id FROM users WHERE id=$1 LIMIT 1`, [req.user!.userId])).rows[0];
  if (!actor) { res.status(401).json({ code: "AUTHORITY_INVALID" }); return; }
  let companyId = Number(actor.company_id);
  if (req.query.projectId !== undefined) {
    const projectId = Number(req.query.projectId);
    if (!Number.isSafeInteger(projectId) || projectId <= 0) { res.status(400).json({ code: "PROJECT_ID_INVALID" }); return; }
    const project = (await pool.query(`SELECT COALESCE((SELECT company_id FROM project_company_binding_versions WHERE project_id=p.id ORDER BY version DESC LIMIT 1),creator.company_id) company_id,
      EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=$2 AND pm.status='active') member,
      u.is_super_admin FROM projects p JOIN users creator ON creator.id=p.created_by_id JOIN users u ON u.id=$2 WHERE p.id=$1 AND p.status<>'archived'`, [projectId,req.user!.userId])).rows[0];
    if (!project || (!project.is_super_admin && (!project.member || Number(project.company_id) !== companyId))) { res.status(403).json({ code: "PROJECT_CATALOG_SCOPE_FORBIDDEN" }); return; }
    companyId = Number(project.company_id);
  }
  const kind = ({ clients: "client", disciplines: "discipline", services: "service", phases: "phase" } as Record<string,string>)[catalogName];
  if (!kind) { res.status(404).json({ code: "MASTER_CATALOG_NOT_FOUND" }); return; }
  const companyRows = (await pool.query(`SELECT id,code,name,state,version,canonical_company_id "canonicalCompanyId"
    FROM company_master_catalog_entries WHERE company_id=$1 AND kind=$2 AND state='active' ORDER BY name,id`, [companyId,kind])).rows;
  if (catalogName === "clients") {
    const governed = Boolean((await pool.query(`SELECT 1 FROM company_master_catalog_administrators WHERE company_id=$1 AND state='active' LIMIT 1`, [companyId])).rows[0]);
    const clients = (await pool.query(`SELECT e.id "catalogEntryId",e.code,c.name,c.id,e.state,e.version
      FROM company_master_catalog_entries e JOIN companies c ON c.id=e.canonical_company_id
      WHERE e.company_id=$1 AND e.kind='client' AND e.state='active' ORDER BY c.name,c.id`, [companyId])).rows;
    res.json({ catalog: catalogName, governed, entries: clients.map(row => ({ ...row, source: "company" })) }); return;
  }
  if (catalogName === "disciplines") {
    const includeInactive = req.query.includeInactive === "true" && req.user?.isSuperAdmin === true;
    const entries = await db.select().from(enterpriseTradesTable).where(includeInactive ? undefined : eq(enterpriseTradesTable.state, "active")).orderBy(asc(enterpriseTradesTable.name));
    const localCodes = new Set(companyRows.map(row => row.code));
    res.json({ catalog: catalogName, entries: [...companyRows.map(row => ({ ...row, source: "company" })), ...entries.filter(row => !localCodes.has(row.code)).map(row => ({ ...row, source: "bimlog" }))] }); return;
  }
  const table = catalog(catalogName);
  if (!table) { res.status(404).json({ code: "MASTER_CATALOG_NOT_FOUND" }); return; }
  const includeInactive = req.query.includeInactive === "true" && req.user?.isSuperAdmin === true;
  const entries = await db.select().from(table).where(includeInactive ? undefined : eq(table.state, "active")).orderBy(asc(table.name));
  const localCodes = new Set(companyRows.map(row => row.code));
  res.json({ catalog: catalogName, entries: [...companyRows.map(row => ({ ...row, source: "company" })), ...entries.filter(row => !localCodes.has(row.code)).map(row => ({ ...row, source: "bimlog" }))] });
});

router.post("/admin/master-catalogs/:catalog", authMiddleware, isSuperAdminMiddleware, async (req, res): Promise<void> => {
  const table = catalog(param(req.params.catalog));
  const code = normalizedCode(req.body?.code);
  const name = String(req.body?.name ?? "").trim();
  if (!table) { res.status(404).json({ code: "MASTER_CATALOG_NOT_FOUND" }); return; }
  if (!code || !name) { res.status(400).json({ code: "MASTER_CATALOG_INVALID", error: "A valid code and name are required." }); return; }
  const id = randomUUID();
  const [entry] = await db.insert(table).values({ id, code, name, createdById: req.user!.userId, updatedById: req.user!.userId }).returning();
  res.status(201).json({ entry });
});

router.patch("/admin/master-catalogs/:catalog/:id", authMiddleware, isSuperAdminMiddleware, async (req, res): Promise<void> => {
  const table = catalog(param(req.params.catalog));
  const id = param(req.params.id);
  if (!table) { res.status(404).json({ code: "MASTER_CATALOG_NOT_FOUND" }); return; }
  const state = req.body?.state == null ? undefined : String(req.body.state);
  const name = req.body?.name == null ? undefined : String(req.body.name).trim();
  if (state && !["active", "inactive", "retired"].includes(state)) { res.status(400).json({ code: "MASTER_CATALOG_STATE_INVALID" }); return; }
  if (name !== undefined && !name) { res.status(400).json({ code: "MASTER_CATALOG_NAME_INVALID" }); return; }
  const [current] = await db.select().from(table).where(eq(table.id, id)).limit(1);
  if (!current) { res.status(404).json({ code: "MASTER_CATALOG_ENTRY_NOT_FOUND" }); return; }
  const [entry] = await db.update(table).set({
    ...(name === undefined ? {} : { name }),
    ...(state === undefined ? {} : { state, retiredAt: state === "retired" ? new Date() : null }),
    version: current.version + 1,
    updatedById: req.user!.userId,
    updatedAt: new Date(),
  }).where(and(eq(table.id, id), eq(table.version, current.version))).returning();
  if (!entry) { res.status(409).json({ code: "MASTER_CATALOG_VERSION_CONFLICT" }); return; }
  res.json({ entry });
});

export default router;
