import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const ROBERTO_HASH = "$2b$10$KQteBKLRHMWh/FHl8scESemZM/tydxjRn1lYaQICF2KVJ51TqzRVa";
const ALEJANDRO_HASH = "$2b$10$YhQrZhx7UXi0mVZI9ZXBeuikBFzO.cWU8nOGPRbvkeSzVg098pn1i";

const CONFIG_OPTIONS = [
  { category: "file_status",      value: "active",         label: "Active",           label_es: "Activo",                    sort_order: 1, meta: null as string | null },
  { category: "file_status",      value: "superseded",     label: "Superseded",       label_es: "Reemplazado",               sort_order: 2, meta: null },
  { category: "file_status",      value: "archived",       label: "Archived",         label_es: "Archivado",                 sort_order: 3, meta: null },
  { category: "member_role",      value: "project_admin",  label: "Project Admin",    label_es: "Administrador de Proyecto", sort_order: 1, meta: JSON.stringify({ permission: "admin" }) },
  { category: "member_role",      value: "company_lead",   label: "Company Lead",     label_es: "Líder de Empresa",          sort_order: 2, meta: JSON.stringify({ permission: "write" }) },
  { category: "member_role",      value: "drafter",        label: "Drafter",          label_es: "Dibujante",                 sort_order: 3, meta: JSON.stringify({ permission: "write" }) },
  { category: "member_role",      value: "project_manager",label: "Project Manager",  label_es: "Gerente de Proyecto",       sort_order: 4, meta: JSON.stringify({ permission: "write" }) },
  { category: "member_role",      value: "read_only",      label: "Read Only",        label_es: "Solo Lectura",              sort_order: 5, meta: JSON.stringify({ permission: "read" }) },
  { category: "project_status",   value: "active",         label: "Active",           label_es: "Activo",                    sort_order: 1, meta: null },
  { category: "project_status",   value: "on_hold",        label: "On Hold",          label_es: "En Pausa",                  sort_order: 2, meta: null },
  { category: "project_status",   value: "completed",      label: "Completed",        label_es: "Completado",                sort_order: 3, meta: null },
  { category: "project_status",   value: "archived",       label: "Archived",         label_es: "Archivado",                 sort_order: 4, meta: null },
  { category: "rfi_priority",     value: "low",            label: "Low",              label_es: "Baja",                      sort_order: 1, meta: null },
  { category: "rfi_priority",     value: "medium",         label: "Medium",           label_es: "Media",                     sort_order: 2, meta: null },
  { category: "rfi_priority",     value: "high",           label: "High",             label_es: "Alta",                      sort_order: 3, meta: null },
  { category: "rfi_status",       value: "open",           label: "Open",             label_es: "Abierto",                   sort_order: 1, meta: null },
  { category: "rfi_status",       value: "in_review",      label: "In Review",        label_es: "En Revisión",               sort_order: 2, meta: null },
  { category: "rfi_status",       value: "responded",      label: "Responded",        label_es: "Respondido",                sort_order: 3, meta: JSON.stringify({ setsRespondedAt: "true" }) },
  { category: "rfi_status",       value: "closed",         label: "Closed",           label_es: "Cerrado",                   sort_order: 4, meta: null },
  { category: "separator",        value: "-",              label: "Hyphen (-)",       label_es: "Guión (-)",                 sort_order: 1, meta: null },
  { category: "separator",        value: "_",              label: "Underscore (_)",   label_es: "Guión bajo (_)",            sort_order: 2, meta: null },
  { category: "separator",        value: ".",              label: "Period (.)",       label_es: "Punto (.)",                 sort_order: 3, meta: null },
  { category: "submittal_status", value: "pending",        label: "Pending",          label_es: "Pendiente",                 sort_order: 1, meta: null },
  { category: "submittal_status", value: "submitted",      label: "Submitted",        label_es: "Enviado",                   sort_order: 2, meta: null },
  { category: "submittal_status", value: "approved",       label: "Approved",         label_es: "Aprobado",                  sort_order: 3, meta: null },
  { category: "submittal_status", value: "rejected",       label: "Rejected",         label_es: "Rechazado",                 sort_order: 4, meta: null },
  { category: "submittal_status", value: "resubmit",       label: "Resubmit",         label_es: "Reenviar",                  sort_order: 5, meta: null },
  { category: "submittal_type",   value: "shop_drawing",   label: "Shop Drawing",     label_es: "Plano de Taller",           sort_order: 1, meta: null },
  { category: "submittal_type",   value: "product_data",   label: "Product Data",     label_es: "Datos de Producto",         sort_order: 2, meta: null },
  { category: "submittal_type",   value: "sample",         label: "Sample",           label_es: "Muestra",                   sort_order: 3, meta: null },
];

async function q(query: string, ...params: unknown[]): Promise<void> {
  if (params.length === 0) {
    await db.execute(sql.raw(query));
  } else {
    await db.execute(sql.raw(
      query.replace(/\$(\d+)/g, (_, i) => {
        const val = params[Number(i) - 1];
        if (val === null) return "NULL";
        if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
        if (typeof val === "number") return String(val);
        return `'${String(val).replace(/'/g, "''")}'`;
      })
    ));
  }
}

export async function runAutoSeed(): Promise<void> {
  try {
    const check = await db.execute(sql`SELECT COUNT(*) as cnt FROM companies`);
    const cnt = Number((check.rows[0] as { cnt: string }).cnt);
    if (cnt > 0) {
      console.log("[auto-seed] Companies already present — skipping seed");
      return;
    }

    console.log("[auto-seed] Empty database detected — seeding now...");

    // config_options
    const cfgCheck = await db.execute(sql`SELECT COUNT(*) as cnt FROM config_options`);
    if (Number((cfgCheck.rows[0] as { cnt: string }).cnt) === 0) {
      for (const opt of CONFIG_OPTIONS) {
        await db.execute(sql`
          INSERT INTO config_options (category, value, label, label_es, sort_order, meta)
          VALUES (${opt.category}, ${opt.value}, ${opt.label}, ${opt.label_es}, ${opt.sort_order}, ${opt.meta ? sql`${opt.meta}::json` : sql`NULL`})
          ON CONFLICT DO NOTHING
        `);
      }
      console.log(`[auto-seed] Seeded ${CONFIG_OPTIONS.length} config options`);
    }

    // companies
    await db.execute(sql`
      INSERT INTO companies (id, name)
      VALUES (14,'IgniteSmart'),(15,'ABC Contractors'),(16,'BIMtech Corp'),(17,'Test Corp')
      ON CONFLICT DO NOTHING
    `);
    await db.execute(sql`SELECT setval(pg_get_serial_sequence('companies','id'), 17, true)`);
    console.log("[auto-seed] Companies inserted");

    // users
    await db.execute(sql`
      INSERT INTO users (id, full_name, email, password_hash, company_id, is_super_admin)
      VALUES
        (16, 'Roberto Rodriguez', 'robertor@rryasociados.com', ${ROBERTO_HASH}, 14, true),
        (17, 'Alejandro',        'robertor9876@gmail.com',     ${ALEJANDRO_HASH}, 15, false)
      ON CONFLICT DO NOTHING
    `);
    await db.execute(sql`SELECT setval(pg_get_serial_sequence('users','id'), 17, true)`);
    console.log("[auto-seed] Users inserted");

    // projects
    await db.execute(sql`
      INSERT INTO projects (id, name, code, description, status, created_by_id)
      VALUES
        (8, 'IBQ Lithium Extraction Plant', 'IBQ-LIT',
         'Implementation of Basic Chemical Industry in Bolivia - Lithium Extraction Industrial Plants. Contract between SEDEM/IBQ and ECEC.',
         'active', 16),
        (9, '270 Park Avenue', 'NYC-270',
         'JPMorgan Chase Headquarters redevelopment at 270 Park Avenue, New York City. BIM coordination and document management.',
         'active', 16)
      ON CONFLICT DO NOTHING
    `);
    await db.execute(sql`SELECT setval(pg_get_serial_sequence('projects','id'), 9, true)`);
    console.log("[auto-seed] Projects inserted");

    // project_members
    await db.execute(sql`
      INSERT INTO project_members (project_id, user_id, role)
      VALUES (8,16,'project_admin'),(8,17,'viewer'),(9,16,'project_admin'),(9,17,'viewer')
      ON CONFLICT DO NOTHING
    `);
    console.log("[auto-seed] Project members inserted");

    console.log("[auto-seed] Seed complete ✓");
  } catch (err) {
    console.error("[auto-seed] Seed failed:", err);
  }
}
