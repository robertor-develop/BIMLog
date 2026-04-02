import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

const SEED_KEY = "bimlog-prod-seed-2026-ignite";

const CONFIG_OPTIONS = [
  { category: "file_status",      value: "active",         label: "Active",           labelEs: "Activo",                    sortOrder: 1, meta: null as string | null },
  { category: "file_status",      value: "superseded",     label: "Superseded",       labelEs: "Reemplazado",               sortOrder: 2, meta: null },
  { category: "file_status",      value: "archived",       label: "Archived",         labelEs: "Archivado",                 sortOrder: 3, meta: null },
  { category: "member_role",      value: "project_admin",  label: "Project Admin",    labelEs: "Administrador de Proyecto", sortOrder: 1, meta: JSON.stringify({ permission: "admin" }) },
  { category: "member_role",      value: "company_lead",   label: "Company Lead",     labelEs: "Líder de Empresa",          sortOrder: 2, meta: JSON.stringify({ permission: "write" }) },
  { category: "member_role",      value: "drafter",        label: "Drafter",          labelEs: "Dibujante",                 sortOrder: 3, meta: JSON.stringify({ permission: "write" }) },
  { category: "member_role",      value: "project_manager",label: "Project Manager",  labelEs: "Gerente de Proyecto",       sortOrder: 4, meta: JSON.stringify({ permission: "write" }) },
  { category: "member_role",      value: "read_only",      label: "Read Only",        labelEs: "Solo Lectura",              sortOrder: 5, meta: JSON.stringify({ permission: "read" }) },
  { category: "project_status",   value: "active",         label: "Active",           labelEs: "Activo",                    sortOrder: 1, meta: null },
  { category: "project_status",   value: "on_hold",        label: "On Hold",          labelEs: "En Pausa",                  sortOrder: 2, meta: null },
  { category: "project_status",   value: "completed",      label: "Completed",        labelEs: "Completado",                sortOrder: 3, meta: null },
  { category: "project_status",   value: "archived",       label: "Archived",         labelEs: "Archivado",                 sortOrder: 4, meta: null },
  { category: "rfi_priority",     value: "low",            label: "Low",              labelEs: "Baja",                      sortOrder: 1, meta: null },
  { category: "rfi_priority",     value: "medium",         label: "Medium",           labelEs: "Media",                     sortOrder: 2, meta: null },
  { category: "rfi_priority",     value: "high",           label: "High",             labelEs: "Alta",                      sortOrder: 3, meta: null },
  { category: "rfi_status",       value: "open",           label: "Open",             labelEs: "Abierto",                   sortOrder: 1, meta: null },
  { category: "rfi_status",       value: "in_review",      label: "In Review",        labelEs: "En Revisión",               sortOrder: 2, meta: null },
  { category: "rfi_status",       value: "responded",      label: "Responded",        labelEs: "Respondido",                sortOrder: 3, meta: JSON.stringify({ setsRespondedAt: "true" }) },
  { category: "rfi_status",       value: "closed",         label: "Closed",           labelEs: "Cerrado",                   sortOrder: 4, meta: null },
  { category: "separator",        value: "-",              label: "Hyphen (-)",       labelEs: "Guión (-)",                 sortOrder: 1, meta: null },
  { category: "separator",        value: "_",              label: "Underscore (_)",   labelEs: "Guión bajo (_)",            sortOrder: 2, meta: null },
  { category: "separator",        value: ".",              label: "Period (.)",       labelEs: "Punto (.)",                 sortOrder: 3, meta: null },
  { category: "submittal_status", value: "pending",        label: "Pending",          labelEs: "Pendiente",                 sortOrder: 1, meta: null },
  { category: "submittal_status", value: "submitted",      label: "Submitted",        labelEs: "Enviado",                   sortOrder: 2, meta: null },
  { category: "submittal_status", value: "approved",       label: "Approved",         labelEs: "Aprobado",                  sortOrder: 3, meta: null },
  { category: "submittal_status", value: "rejected",       label: "Rejected",         labelEs: "Rechazado",                 sortOrder: 4, meta: null },
  { category: "submittal_status", value: "resubmit",       label: "Resubmit",         labelEs: "Reenviar",                  sortOrder: 5, meta: null },
  { category: "submittal_type",   value: "shop_drawing",   label: "Shop Drawing",     labelEs: "Plano de Taller",           sortOrder: 1, meta: null },
  { category: "submittal_type",   value: "product_data",   label: "Product Data",     labelEs: "Datos de Producto",         sortOrder: 2, meta: null },
  { category: "submittal_type",   value: "sample",         label: "Sample",           labelEs: "Muestra",                   sortOrder: 3, meta: null },
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

    const [bimtech] = await db
      .execute(sql`INSERT INTO companies (name) VALUES ('BIMtech Corp') ON CONFLICT DO NOTHING RETURNING id`)
      .then(r => r.rows as any[]);
    const [dds] = await db
      .execute(sql`INSERT INTO companies (name) VALUES ('DDS Mechanical') ON CONFLICT DO NOTHING RETURNING id`)
      .then(r => r.rows as any[]);

    const allCompanies = await db.execute(sql`SELECT id, name FROM companies WHERE name IN ('BIMtech Corp', 'DDS Mechanical') ORDER BY id LIMIT 2`);
    const bimtechRow = (allCompanies.rows as any[]).find(r => r.name === "BIMtech Corp");
    const ddsRow = (allCompanies.rows as any[]).find(r => r.name === "DDS Mechanical");
    const bimtechId = bimtechRow?.id;
    const ddsId = ddsRow?.id;
    log.push(`Companies: BIMtech Corp (${bimtechId}), DDS Mechanical (${ddsId})`);

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

    const demoUsers = await db.execute(sql`
      SELECT id, email FROM users WHERE email IN ('roberto@bimtechcorp.com','maria@bimtechcorp.com','tom@ddsmechanical.com')
    `);
    const userMap: Record<string, number> = {};
    for (const u of demoUsers.rows as any[]) {
      userMap[u.email] = u.id;
    }

    const projectDefs = [
      { name: "Downtown Tower",      code: "DT-2026", description: "Mixed-use downtown development", status: "active" },
      { name: "270 Park Avenue",     code: "NYC-270",  description: "Full MEP coordination and BIM management for the new JPMorgan Chase HQ tower, New York", status: "active" },
      { name: "Harbor View Complex", code: "HV-2026",  description: "Waterfront mixed-use development with 3 towers", status: "active" },
      { name: "Metro Line Extension",code: "MLE-05",  description: "Underground civil and MEP for subway extension", status: "on_hold" },
      { name: "BIM Test",            code: "BIM-001", description: "Internal BIM coordination test project", status: "active" },
    ];

    let createdCount = 0;
    for (const p of projectDefs) {
      const ex = await db.execute(sql`SELECT id FROM projects WHERE code = ${p.code} LIMIT 1`);
      if (ex.rows.length === 0) {
        await db.execute(sql`
          INSERT INTO projects (name, code, description, status, created_by_id)
          VALUES (${p.name}, ${p.code}, ${p.description}, ${p.status}, ${callingUserId})
        `);
        createdCount++;
      }
    }
    log.push(`Created ${createdCount} new projects (skipped existing)`);

    const allProjects = await db.execute(sql`SELECT id, code FROM projects`);
    const projectIds = (allProjects.rows as any[]).map((r: any) => r.id);
    log.push(`Total projects in DB: ${projectIds.length}`);

    let membershipsAdded = 0;
    for (const pid of projectIds) {
      await db.execute(sql`DELETE FROM project_members WHERE project_id = ${pid} AND user_id = ${callingUserId}`);
      await db.execute(sql`
        INSERT INTO project_members (project_id, user_id, role)
        VALUES (${pid}, ${callingUserId}, 'project_admin')
      `);
      membershipsAdded++;
    }
    log.push(`Set calling user (id=${callingUserId}) as project_admin on ${membershipsAdded} projects`);

    const park270 = (allProjects.rows as any[]).find((r: any) => r.code === "NYC-270");
    if (park270) {
      for (const [email, uid] of Object.entries(userMap)) {
        await db.execute(sql`DELETE FROM project_members WHERE project_id = ${park270.id} AND user_id = ${uid}`);
        await db.execute(sql`
          INSERT INTO project_members (project_id, user_id, role)
          VALUES (${park270.id}, ${uid}, 'drafter')
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
    log.push(`Config options: ${CONFIG_OPTIONS.length} processed`);

    // 2. Ensure IgniteSmart company exists (for Alejandro)
    await db.execute(sql`
      INSERT INTO companies (name) VALUES ('IgniteSmart')
      ON CONFLICT DO NOTHING
    `);
    const igniteSmart = await db.execute(sql`SELECT id FROM companies WHERE name = 'IgniteSmart' LIMIT 1`);
    const igniteSmartId = (igniteSmart.rows[0] as any)?.id;
    log.push(`IgniteSmart company id=${igniteSmartId}`);

    // 3. Ensure Alejandro exists (lookup by email, create if missing)
    const alejandroHash = "$2b$10$YhQrZhx7UXi0mVZI9ZXBeuikBFzO.cWU8nOGPRbvkeSzVg098pn1i";
    await db.execute(sql`
      INSERT INTO users (full_name, email, password_hash, company_id, is_super_admin)
      VALUES ('Alejandro', 'robertor9876@gmail.com', ${alejandroHash}, ${igniteSmartId}, false)
      ON CONFLICT (email) DO NOTHING
    `);
    log.push("Alejandro user ensured");

    // 4. Get Roberto and Alejandro IDs by email
    const robertoRow = await db.execute(sql`SELECT id FROM users WHERE email = 'robertor@rryasociados.com' LIMIT 1`);
    const alejandroRow = await db.execute(sql`SELECT id FROM users WHERE email = 'robertor9876@gmail.com' LIMIT 1`);
    const robertoId: number | null = (robertoRow.rows[0] as any)?.id ?? null;
    const alejandroId: number | null = (alejandroRow.rows[0] as any)?.id ?? null;
    log.push(`Roberto id=${robertoId}, Alejandro id=${alejandroId}`);

    if (!robertoId) {
      res.status(500).json({ error: "Roberto not found in users table", log });
      return;
    }

    // 5. Ensure IBQ-LIT project exists (lookup by code)
    const ibqExisting = await db.execute(sql`SELECT id FROM projects WHERE code = 'IBQ-LIT' LIMIT 1`);
    let ibqId: number;
    if (ibqExisting.rows.length === 0) {
      const ibqCreated = await db.execute(sql`
        INSERT INTO projects (name, code, description, status, created_by_id)
        VALUES (
          'IBQ Lithium Extraction Plant', 'IBQ-LIT',
          'Implementation of Basic Chemical Industry in Bolivia - Lithium Extraction Industrial Plants. Contract between SEDEM/IBQ and ECEC.',
          'active', ${robertoId}
        )
        RETURNING id
      `);
      ibqId = (ibqCreated.rows[0] as any).id;
      log.push(`IBQ-LIT project created with id=${ibqId}`);
    } else {
      ibqId = (ibqExisting.rows[0] as any).id;
      log.push(`IBQ-LIT project exists with id=${ibqId}`);
    }

    // 6. Get NYC-270 project ID by code
    const nyc270Row = await db.execute(sql`SELECT id FROM projects WHERE code = 'NYC-270' LIMIT 1`);
    const nyc270Id: number | null = (nyc270Row.rows[0] as any)?.id ?? null;
    log.push(`NYC-270 id=${nyc270Id}`);

    if (!nyc270Id) {
      res.status(500).json({ error: "NYC-270 project not found", log });
      return;
    }

    // 7. Clear project_members for IBQ-LIT and NYC-270, then re-insert correctly
    await db.execute(sql`DELETE FROM project_members WHERE project_id IN (${ibqId}, ${nyc270Id})`);

    const memberRows: Array<[number, number, string]> = [
      [ibqId,    robertoId,   "project_admin"],
      [nyc270Id, robertoId,   "project_admin"],
    ];
    if (alejandroId) {
      memberRows.push([ibqId,    alejandroId, "read_only"]);
      memberRows.push([nyc270Id, alejandroId, "read_only"]);
    }

    for (const [pid, uid, role] of memberRows) {
      await db.execute(sql`
        INSERT INTO project_members (project_id, user_id, role) VALUES (${pid}, ${uid}, ${role})
      `);
    }
    log.push(`Project members: inserted ${memberRows.length} rows for IBQ-LIT and NYC-270`);

    res.json({ success: true, log });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Seed failed";
    res.status(500).json({ error: message, log });
  }
});

router.post("/system/rebuild-members", async (req, res) => {
  const key = req.headers["x-seed-key"];
  if (key !== SEED_KEY) { res.status(403).json({ error: "Invalid key" }); return; }
  const log: string[] = [];
  try {
    await db.execute(sql`DELETE FROM project_members`);
    log.push("Deleted all project_members");
    const inserts = [
      [8, 1, "project_admin"],   // IBQ-LIT: Roberto
      [8, 11, "drafter"],        // IBQ-LIT: Miguel Torres
      [2, 8, "project_admin"],   // NYC-270: Alejandro
      [2, 11, "drafter"],        // NYC-270: Miguel Torres
      [9, 8, "project_admin"],   // CI-183: Alejandro
      [9, 9, "drafter"],         // CI-183: Carlos Mendoza
      [9, 10, "viewer"],         // CI-183: Sofia Vargas
      [9, 12, "drafter"],        // CI-183: Ana Reyes
    ];
    for (const [pid, uid, role] of inserts) {
      await db.execute(sql`INSERT INTO project_members (project_id, user_id, role) VALUES (${pid}, ${uid}, ${role})`);
      log.push(`Inserted project=${pid} user=${uid} role=${role}`);
    }
    await db.execute(sql`DELETE FROM files WHERE project_id NOT IN (2, 8, 9)`);
    log.push("Deleted orphaned file rows from DB");
    const members = await db.execute(sql`SELECT pm.project_id, pm.user_id, pm.role, u.full_name FROM project_members pm JOIN users u ON u.id = pm.user_id ORDER BY pm.project_id`);
    log.push("Final: " + JSON.stringify(members.rows));
    res.json({ success: true, log });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed", log });
  }
});

router.post("/system/fix-members", async (req, res) => {
  const key = req.headers["x-seed-key"];
  if (key !== SEED_KEY) { res.status(403).json({ error: "Invalid key" }); return; }
  const log: string[] = [];
  try {
    await db.execute(sql`DELETE FROM project_members WHERE project_id=2 AND user_id=1`);
    log.push("Removed Roberto from NYC-270");
    await db.execute(sql`DELETE FROM project_members WHERE project_id=9 AND user_id=1`);
    log.push("Removed Roberto from CI-183");
    await db.execute(sql`DELETE FROM project_members WHERE project_id=8 AND user_id=8`);
    log.push("Removed Alejandro from IBQ-LIT");
    await db.execute(sql`UPDATE project_members SET role='project_admin' WHERE project_id=2 AND user_id=8`);
    log.push("Made Alejandro project_admin on NYC-270");
    const members = await db.execute(sql`SELECT project_id, user_id, role FROM project_members ORDER BY project_id`);
    log.push("Final: " + JSON.stringify(members.rows));
    res.json({ success: true, log });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed", log });
  }
});

router.post("/system/fix-alejandro-roles", async (req, res) => {
  const key = req.headers["x-seed-key"];
  if (key !== SEED_KEY) { res.status(403).json({ error: "Invalid key" }); return; }
  try {
    await db.execute(sql`UPDATE project_members SET role = 'project_admin' WHERE user_id = 8 AND project_id IN (2, 9)`);
    const rows = await db.execute(sql`SELECT project_id, user_id, role FROM project_members WHERE user_id = 8 ORDER BY project_id`);
    res.json({ success: true, rows: rows.rows });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

router.post("/system/wipe-transactional", async (req, res) => {
  const key = req.headers["x-seed-key"];
  if (key !== SEED_KEY) { res.status(403).json({ error: "Invalid key" }); return; }
  const log: string[] = [];
  try {
    try { const r = await db.execute(sql`DELETE FROM rfi_responses`); log.push(`rfi_responses: ${(r as any).rowCount}`); } catch { log.push("rfi_responses: skipped"); }
    try { const r = await db.execute(sql`DELETE FROM rfi_view_events`); log.push(`rfi_view_events: ${(r as any).rowCount}`); } catch { log.push("rfi_view_events: skipped"); }
    try { const r = await db.execute(sql`DELETE FROM rfi_ball_in_court_history`); log.push(`rfi_ball_in_court_history: ${(r as any).rowCount}`); } catch { log.push("rfi_ball_in_court_history: skipped"); }
    try { const r = await db.execute(sql`DELETE FROM submittal_view_events`); log.push(`submittal_view_events: ${(r as any).rowCount}`); } catch { log.push("submittal_view_events: skipped"); }
    try { const r = await db.execute(sql`DELETE FROM submittal_register`); log.push(`submittal_register: ${(r as any).rowCount}`); } catch { log.push("submittal_register: skipped"); }
    const r1 = await db.execute(sql`DELETE FROM rfis`); log.push(`rfis: ${(r1 as any).rowCount}`);
    const r2 = await db.execute(sql`DELETE FROM submittals`); log.push(`submittals: ${(r2 as any).rowCount}`);
    const r3 = await db.execute(sql`DELETE FROM activity_log`); log.push(`activity_log: ${(r3 as any).rowCount}`);
    const r4 = await db.execute(sql`DELETE FROM files`); log.push(`files: ${(r4 as any).rowCount}`);
    const r5 = await db.execute(sql`DELETE FROM project_invitations`); log.push(`project_invitations: ${(r5 as any).rowCount}`);
    try { const r = await db.execute(sql`DELETE FROM email_log`); log.push(`email_log: ${(r as any).rowCount}`); } catch { log.push("email_log: skipped"); }

    // Part 5: ensure feature flags exist
    const newFlags = [
      { flagName: "meeting_minutes",                   enabled: false, appliesTo: "global" },
      { flagName: "transmittal_manager",               enabled: false, appliesTo: "global" },
      { flagName: "cvr_mismatch_workflow",             enabled: true,  appliesTo: "global" },
      { flagName: "automated_accountability_emails",   enabled: false, appliesTo: "global" },
      { flagName: "weekly_compliance_report",          enabled: false, appliesTo: "global" },
    ];
    for (const f of newFlags) {
      await db.execute(sql`INSERT INTO feature_flags (flag_name, enabled, applies_to) VALUES (${f.flagName}, ${f.enabled}, ${f.appliesTo}) ON CONFLICT (flag_name) DO NOTHING`);
    }
    log.push(`feature_flags: upserted ${newFlags.length}`);

    res.json({ success: true, log });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Wipe failed", log });
  }
});

router.post("/system/cleanup", async (req, res) => {
  const key = req.headers["x-seed-key"];
  if (key !== SEED_KEY) { res.status(403).json({ error: "Invalid key" }); return; }

  const log: string[] = [];
  const keepProjects = [2, 8];
  const keepUsers    = [1, 8];

  try {
    // 1. Delete child rows for projects being removed
    const r1 = await db.execute(sql`DELETE FROM activity_log WHERE project_id NOT IN (2, 8)`);
    log.push(`activity_log deleted: ${(r1 as any).rowCount}`);

    const r2 = await db.execute(sql`DELETE FROM files WHERE project_id NOT IN (2, 8)`);
    log.push(`files deleted: ${(r2 as any).rowCount}`);

    const r3 = await db.execute(sql`DELETE FROM project_invitations WHERE project_id NOT IN (2, 8)`);
    log.push(`project_invitations deleted: ${(r3 as any).rowCount}`);

    const r4 = await db.execute(sql`DELETE FROM project_members WHERE project_id NOT IN (2, 8)`);
    log.push(`project_members (bad projects) deleted: ${(r4 as any).rowCount}`);

    // rfi_responses references rfis — delete responses first if table exists
    try {
      const r5 = await db.execute(sql`DELETE FROM rfi_responses WHERE rfi_id IN (SELECT id FROM rfis WHERE project_id NOT IN (2, 8))`);
      log.push(`rfi_responses deleted: ${(r5 as any).rowCount}`);
    } catch { log.push("rfi_responses: skipped (table may not exist)"); }

    const r6 = await db.execute(sql`DELETE FROM rfis WHERE project_id NOT IN (2, 8)`);
    log.push(`rfis deleted: ${(r6 as any).rowCount}`);

    const r7 = await db.execute(sql`DELETE FROM submittals WHERE project_id NOT IN (2, 8)`);
    log.push(`submittals deleted: ${(r7 as any).rowCount}`);

    try {
      const r8 = await db.execute(sql`DELETE FROM naming_fields WHERE convention_id IN (SELECT id FROM naming_conventions WHERE project_id NOT IN (2, 8))`);
      log.push(`naming_fields deleted: ${(r8 as any).rowCount}`);
    } catch { log.push("naming_fields: skipped"); }

    const r9 = await db.execute(sql`DELETE FROM naming_conventions WHERE project_id NOT IN (2, 8)`);
    log.push(`naming_conventions deleted: ${(r9 as any).rowCount}`);

    // 2. Delete the unwanted projects
    const r10 = await db.execute(sql`DELETE FROM projects WHERE id NOT IN (2, 8)`);
    log.push(`projects deleted: ${(r10 as any).rowCount}`);

    // 3. Delete project_members for removed users (on kept projects)
    const r11 = await db.execute(sql`DELETE FROM project_members WHERE user_id NOT IN (1, 8)`);
    log.push(`project_members (bad users) deleted: ${(r11 as any).rowCount}`);

    // 4. Null out any FK references to users being deleted in rfis/submittals
    try {
      await db.execute(sql`UPDATE rfis SET assigned_to_id = NULL WHERE assigned_to_id NOT IN (1, 8) AND assigned_to_id IS NOT NULL`);
      await db.execute(sql`UPDATE rfis SET created_by_id = 1 WHERE created_by_id NOT IN (1, 8)`);
      log.push("rfis: reassigned foreign keys");
    } catch { log.push("rfis FK update: skipped"); }

    try {
      await db.execute(sql`UPDATE submittals SET created_by_id = 1 WHERE created_by_id NOT IN (1, 8)`);
      log.push("submittals: reassigned foreign keys");
    } catch { log.push("submittals FK update: skipped"); }

    try {
      await db.execute(sql`UPDATE files SET uploaded_by_id = 1 WHERE uploaded_by_id NOT IN (1, 8)`);
      log.push("files: reassigned foreign keys");
    } catch { log.push("files FK update: skipped"); }

    try {
      await db.execute(sql`UPDATE activity_log SET user_id = 1 WHERE user_id NOT IN (1, 8)`);
      log.push("activity_log: reassigned foreign keys");
    } catch { log.push("activity_log FK update: skipped"); }

    // 5. Delete unwanted users
    const r12 = await db.execute(sql`DELETE FROM users WHERE id NOT IN (1, 8)`);
    log.push(`users deleted: ${(r12 as any).rowCount}`);

    // 6. Delete companies with no remaining users
    const r13 = await db.execute(sql`DELETE FROM companies WHERE id NOT IN (SELECT DISTINCT company_id FROM users WHERE company_id IS NOT NULL)`);
    log.push(`companies deleted: ${(r13 as any).rowCount}`);

    // 7. Ensure both users are members of both projects
    for (const pid of [2, 8]) {
      for (const [uid, role] of [[1, "project_admin"], [8, "read_only"]] as [number, string][]) {
        const exists = await db.execute(sql`SELECT 1 FROM project_members WHERE project_id = ${pid} AND user_id = ${uid}`);
        if (exists.rows.length === 0) {
          await db.execute(sql`INSERT INTO project_members (project_id, user_id, role) VALUES (${pid}, ${uid}, ${role})`);
          log.push(`Inserted member: project=${pid} user=${uid} role=${role}`);
        } else {
          log.push(`Member already exists: project=${pid} user=${uid}`);
        }
      }
    }

    // 8. Final counts
    const [pu, pp, pc, pm] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as n FROM users`),
      db.execute(sql`SELECT COUNT(*) as n FROM projects`),
      db.execute(sql`SELECT COUNT(*) as n FROM companies`),
      db.execute(sql`SELECT COUNT(*) as n FROM project_members`),
    ]);
    log.push(`FINAL — users:${(pu.rows[0] as any).n} projects:${(pp.rows[0] as any).n} companies:${(pc.rows[0] as any).n} members:${(pm.rows[0] as any).n}`);

    res.json({ success: true, log });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cleanup failed";
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

router.post("/system/rename-dds-mechanical", async (req, res) => {
  const key = req.headers["x-seed-key"];
  if (key !== SEED_KEY) { res.status(403).json({ error: "Invalid seed key" }); return; }
  try {
    await db.execute(sql`INSERT INTO companies (name) VALUES ('DDS Mechanical') ON CONFLICT DO NOTHING`);
    const result = await db.execute(sql`UPDATE companies SET name = 'ABC Mechanical' WHERE name = 'DDS Mechanical'`);
    res.json({ success: true, updated: (result as any).rowCount ?? 0 });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

export default router;
