import { randomUUID } from "node:crypto";
import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { enterprisePhasesTable, enterpriseServicesTable, enterpriseTradesTable } from "@workspace/db/schema";
import { authMiddleware, isSuperAdminMiddleware } from "../middlewares/auth";

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
  if (catalogName === "disciplines") {
    const includeInactive = req.query.includeInactive === "true" && req.user?.isSuperAdmin === true;
    const entries = await db.select().from(enterpriseTradesTable).where(includeInactive ? undefined : eq(enterpriseTradesTable.state, "active")).orderBy(asc(enterpriseTradesTable.name));
    res.json({ catalog: catalogName, entries }); return;
  }
  const table = catalog(catalogName);
  if (!table) { res.status(404).json({ code: "MASTER_CATALOG_NOT_FOUND" }); return; }
  const includeInactive = req.query.includeInactive === "true" && req.user?.isSuperAdmin === true;
  const entries = await db.select().from(table).where(includeInactive ? undefined : eq(table.state, "active")).orderBy(asc(table.name));
  res.json({ catalog: catalogName, entries });
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
