import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  companiesTable,
  usersTable,
  projectsTable,
  projectMembersTable,
  filesTable,
  namingConventionsTable,
  namingFieldsTable,
  rfisTable,
  submittalsTable,
  activityLogTable,
} from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

const SEED_KEY = "bimlog-prod-seed-2026-ignite";

const CONFIG_OPTIONS = [
  { category: "file_status",      value: "active",        label: "Active",          labelEs: "Activo",                   sortOrder: 1, meta: null },
  { category: "file_status",      value: "superseded",    label: "Superseded",      labelEs: "Reemplazado",              sortOrder: 2, meta: null },
  { category: "file_status",      value: "archived",      label: "Archived",        labelEs: "Archivado",                sortOrder: 3, meta: null },
  { category: "member_role",      value: "project_admin", label: "Project Admin",   labelEs: "Administrador de Proyecto",sortOrder: 1, meta: JSON.stringify({ permission: "admin" }) },
  { category: "member_role",      value: "company_lead",  label: "Company Lead",    labelEs: "Líder de Empresa",         sortOrder: 2, meta: JSON.stringify({ permission: "write" }) },
  { category: "member_role",      value: "drafter",       label: "Drafter",         labelEs: "Dibujante",                sortOrder: 3, meta: JSON.stringify({ permission: "write" }) },
  { category: "member_role",      value: "project_manager",label:"Project Manager", labelEs: "Gerente de Proyecto",      sortOrder: 4, meta: JSON.stringify({ permission: "write" }) },
  { category: "member_role",      value: "read_only",     label: "Read Only",       labelEs: "Solo Lectura",             sortOrder: 5, meta: JSON.stringify({ permission: "read" }) },
  { category: "project_status",   value: "active",        label: "Active",          labelEs: "Activo",                   sortOrder: 1, meta: null },
  { category: "project_status",   value: "on_hold",       label: "On Hold",         labelEs: "En Pausa",                 sortOrder: 2, meta: null },
  { category: "project_status",   value: "completed",     label: "Completed",       labelEs: "Completado",               sortOrder: 3, meta: null },
  { category: "project_status",   value: "archived",      label: "Archived",        labelEs: "Archivado",                sortOrder: 4, meta: null },
  { category: "rfi_priority",     value: "low",           label: "Low",             labelEs: "Baja",                     sortOrder: 1, meta: null },
  { category: "rfi_priority",     value: "medium",        label: "Medium",          labelEs: "Media",                    sortOrder: 2, meta: null },
  { category: "rfi_priority",     value: "high",          label: "High",            labelEs: "Alta",                     sortOrder: 3, meta: null },
  { category: "rfi_status",       value: "open",          label: "Open",            labelEs: "Abierto",                  sortOrder: 1, meta: null },
  { category: "rfi_status",       value: "in_review",     label: "In Review",       labelEs: "En Revisión",              sortOrder: 2, meta: null },
  { category: "rfi_status",       value: "responded",     label: "Responded",       labelEs: "Respondido",               sortOrder: 3, meta: JSON.stringify({ setsRespondedAt: "true" }) },
  { category: "rfi_status",       value: "closed",        label: "Closed",          labelEs: "Cerrado",                  sortOrder: 4, meta: null },
  { category: "separator",        value: "-",             label: "Hyphen (-)",      labelEs: "Guión (-)",                sortOrder: 1, meta: null },
  { category: "separator",        value: "_",             label: "Underscore (_)",  labelEs: "Guión bajo (_)",           sortOrder: 2, meta: null },
  { category: "separator",        value: ".",             label: "Period (.)",      labelEs: "Punto (.)",                sortOrder: 3, meta: null },
  { category: "submittal_status", value: "pending",       label: "Pending",         labelEs: "Pendiente",                sortOrder: 1, meta: null },
  { category: "submittal_status", value: "submitted",     label: "Submitted",       labelEs: "Enviado",                  sortOrder: 2, meta: null },
  { category: "submittal_status", value: "approved",      label: "Approved",        labelEs: "Aprobado",                 sortOrder: 3, meta: null },
  { category: "submittal_status", value: "rejected",      label: "Rejected",        labelEs: "Rechazado",                sortOrder: 4, meta: null },
  { category: "submittal_status", value: "resubmit",      label: "Resubmit",        labelEs: "Reenviar",                 sortOrder: 5, meta: null },
  { category: "submittal_type",   value: "shop_drawing",  label: "Shop Drawing",    labelEs: "Plano de Taller",          sortOrder: 1, meta: null },
  { category: "submittal_type",   value: "product_data",  label: "Product Data",    labelEs: "Datos de Producto",        sortOrder: 2, meta: null },
  { category: "submittal_type",   value: "sample",        label: "Sample",          labelEs: "Muestra",                  sortOrder: 3, meta: null },
];

router.post("/admin/prod-seed", authMiddleware, async (req, res) => {
  const key = req.headers["x-seed-key"];
  if (key !== SEED_KEY) {
    res.status(403).json({ error: "Invalid seed key" });
    return;
  }

  const callingUserId = req.user!.userId;
  const log: string[] = [];

  try {
    // 1. Seed config_options (skip if already seeded)
    const existing = await db.execute(sql`SELECT COUNT(*) as cnt FROM config_options`);
    const cnt = Number((existing.rows[0] as { cnt: string }).cnt);

    if (cnt === 0) {
      for (const opt of CONFIG_OPTIONS) {
        await db.execute(sql`
          INSERT INTO config_options (category, value, label, label_es, sort_order, meta)
          VALUES (${opt.category}, ${opt.value}, ${opt.label}, ${opt.labelEs}, ${opt.sortOrder}, ${opt.meta ? sql`${opt.meta}::json` : sql`NULL`})
          ON CONFLICT DO NOTHING
        `);
      }
      log.push(`Seeded ${CONFIG_OPTIONS.length} config options`);
    } else {
      log.push(`Config options already seeded (${cnt} rows)`);
    }

    // 2. Ensure demo companies exist
    const [bimtech] = await db
      .insert(companiesTable)
      .values({ name: "BIMtech Corp" })
      .onConflictDoNothing()
      .returning();
    const [dds] = await db
      .insert(companiesTable)
      .values({ name: "DDS Mechanical" })
      .onConflictDoNothing()
      .returning();

    const allCompanies = await db.execute(sql`SELECT id, name FROM companies WHERE name IN ('BIMtech Corp', 'DDS Mechanical')`);
    const bimtechId = (allCompanies.rows.find((r: any) => r.name === "BIMtech Corp") as any)?.id;
    const ddsId = (allCompanies.rows.find((r: any) => r.name === "DDS Mechanical") as any)?.id;
    log.push(`Companies ready: BIMtech Corp (${bimtechId}), DDS Mechanical (${ddsId})`);

    // 3. Create demo users
    const hash = await bcrypt.hash("Demo1234!", 10);
    if (bimtechId) {
      await db.execute(sql`
        INSERT INTO users (full_name, email, password_hash, company_id)
        VALUES ('Roberto Rodriguez', 'roberto@bimtechcorp.com', ${hash}, ${bimtechId}),
               ('Maria Sanchez',     'maria@bimtechcorp.com',   ${hash}, ${bimtechId})
        ON CONFLICT (email) DO NOTHING
      `);
    }
    if (ddsId) {
      await db.execute(sql`
        INSERT INTO users (full_name, email, password_hash, company_id)
        VALUES ('Tom Davis', 'tom@ddsmechanical.com', ${hash}, ${ddsId})
        ON CONFLICT (email) DO NOTHING
      `);
    }
    log.push(`Demo users ensured`);

    // 4. Get demo user IDs
    const demoUsers = await db.execute(sql`
      SELECT id, email FROM users WHERE email IN ('roberto@bimtechcorp.com','maria@bimtechcorp.com','tom@ddsmechanical.com')
    `);
    const userMap: Record<string, number> = {};
    for (const u of demoUsers.rows as any[]) {
      userMap[u.email] = u.id;
    }

    // 5. Create demo projects (check before insert — no unique constraint on code)
    const projectDefs = [
      { name: "Downtown Tower",      code: "DT-2026", description: "Mixed-use downtown development", status: "active" },
      { name: "270 Park Avenue",     code: "NYC-270",  description: "Full MEP coordination and BIM management for the new JPMorgan Chase HQ tower, New York", status: "active" },
      { name: "Harbor View Complex", code: "HV-2026",  description: "Waterfront mixed-use development with 3 towers", status: "active" },
      { name: "Metro Line Extension",code: "MLE-05",  description: "Underground civil and MEP for subway extension", status: "on_hold" },
      { name: "BIM Test",            code: "BIM-001", description: "Internal BIM coordination test project", status: "active" },
    ];

    let createdCount = 0;
    for (const p of projectDefs) {
      const existing = await db.execute(sql`SELECT id FROM projects WHERE code = ${p.code} LIMIT 1`);
      if (existing.rows.length === 0) {
        await db.execute(sql`
          INSERT INTO projects (name, code, description, status, created_by_id)
          VALUES (${p.name}, ${p.code}, ${p.description}, ${p.status}, ${callingUserId})
        `);
        createdCount++;
      }
    }
    log.push(`Created ${createdCount} new projects (skipped existing)`);

    // 6. Get ALL projects
    const allProjects = await db.execute(sql`SELECT id, code FROM projects`);
    const projectIds = (allProjects.rows as any[]).map((r: any) => r.id);
    log.push(`Total projects in DB: ${projectIds.length}`);

    // 7. Add calling user as project_admin on every project
    let membershipsAdded = 0;
    for (const pid of projectIds) {
      const r = await db.execute(sql`
        INSERT INTO project_members (project_id, user_id, role)
        VALUES (${pid}, ${callingUserId}, 'project_admin')
        ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'project_admin'
      `);
      membershipsAdded++;
    }
    log.push(`Set calling user (id=${callingUserId}) as project_admin on ${membershipsAdded} projects`);

    // 8. Add demo users to 270 Park Avenue project
    const park270 = (allProjects.rows as any[]).find((r: any) => r.code === "NYC-270");
    if (park270) {
      for (const [email, uid] of Object.entries(userMap)) {
        await db.execute(sql`
          INSERT INTO project_members (project_id, user_id, role)
          VALUES (${park270.id}, ${uid}, 'drafter')
          ON CONFLICT (project_id, user_id) DO NOTHING
        `);
      }
      log.push(`Added demo users to 270 Park Avenue`);
    }

    res.json({ success: true, log });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Seed failed";
    res.status(500).json({ error: message, log });
  }
});

router.post("/system/full-seed", async (req, res) => {
  const key = req.headers["x-seed-key"];
  if (key !== SEED_KEY) {
    res.status(403).json({ error: "Invalid seed key" });
    return;
  }

  const log: string[] = [];
  try {
    // 1. Config options
    for (const opt of CONFIG_OPTIONS) {
      await db.execute(sql`
        INSERT INTO config_options (category, value, label, label_es, sort_order, meta)
        VALUES (${opt.category}, ${opt.value}, ${opt.label}, ${opt.labelEs}, ${opt.sortOrder}, ${opt.meta ? sql`${opt.meta}::json` : sql`NULL`})
        ON CONFLICT DO NOTHING
      `);
    }
    log.push(`Config options: ${CONFIG_OPTIONS.length} processed (ON CONFLICT DO NOTHING)`);

    // 2. Companies
    await db.execute(sql`
      INSERT INTO companies (id, name)
      VALUES (14,'IgniteSmart'),(15,'ABC Contractors'),(16,'BIMtech Corp'),(17,'Test Corp')
      ON CONFLICT (id) DO NOTHING
    `);
    await db.execute(sql`SELECT setval(pg_get_serial_sequence('companies','id'), 17, true)`);
    log.push("Companies: ON CONFLICT DO NOTHING");

    // 3. Users
    const robertoHash = "$2b$10$KQteBKLRHMWh/FHl8scESemZM/tydxjRn1lYaQICF2KVJ51TqzRVa";
    const alejandroHash = "$2b$10$YhQrZhx7UXi0mVZI9ZXBeuikBFzO.cWU8nOGPRbvkeSzVg098pn1i";
    await db.execute(sql`
      INSERT INTO users (id, full_name, email, password_hash, company_id, is_super_admin)
      VALUES
        (16, 'Roberto Rodriguez', 'robertor@rryasociados.com', ${robertoHash}, 14, true),
        (17, 'Alejandro',        'robertor9876@gmail.com',     ${alejandroHash}, 15, false)
      ON CONFLICT (id) DO NOTHING
    `);
    await db.execute(sql`SELECT setval(pg_get_serial_sequence('users','id'), 17, true)`);
    log.push("Users: ON CONFLICT DO NOTHING");

    // 4. Projects
    await db.execute(sql`
      INSERT INTO projects (id, name, code, description, status, created_by_id)
      VALUES
        (8, 'IBQ Lithium Extraction Plant', 'IBQ-LIT',
         'Implementation of Basic Chemical Industry in Bolivia - Lithium Extraction Industrial Plants.', 'active', 16),
        (9, '270 Park Avenue', 'NYC-270',
         'JPMorgan Chase Headquarters redevelopment at 270 Park Avenue, New York City.', 'active', 16)
      ON CONFLICT (id) DO NOTHING
    `);
    await db.execute(sql`SELECT setval(pg_get_serial_sequence('projects','id'), 9, true)`);
    log.push("Projects: ON CONFLICT DO NOTHING");

    // 5. Project members
    await db.execute(sql`
      INSERT INTO project_members (project_id, user_id, role)
      VALUES (8,16,'project_admin'),(8,17,'viewer'),(9,16,'project_admin'),(9,17,'viewer')
      ON CONFLICT DO NOTHING
    `);
    log.push("Project members: ON CONFLICT DO NOTHING");

    res.json({ success: true, log });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Seed failed";
    res.status(500).json({ error: message, log });
  }
});

router.post("/system/set-super-admin", async (req, res) => {
  const { key, email } = req.body;
  if (key !== SEED_KEY) {
    res.status(403).json({ error: "Invalid key" });
    return;
  }
  if (!email) {
    res.status(400).json({ error: "email required" });
    return;
  }
  try {
    const result = await db.execute(sql`UPDATE users SET is_super_admin = true WHERE email = ${email}`);
    res.json({ success: true, updated: (result as any).rowCount ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    res.status(500).json({ error: message });
  }
});

export default router;
