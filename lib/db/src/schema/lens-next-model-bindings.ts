import { pgTable, bigserial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const lensNextModelBindingsTable = pgTable("lens_next_model_bindings", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  modelBindingKey: text("model_binding_key").notNull(),
  modelDisplayName: text("model_display_name").notNull(),
  evidenceSource: text("evidence_source").notNull(),
  status: text("status").notNull().default("active"),
  boundById: integer("bound_by_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  activeProjectModelKeyUnique: uniqueIndex("lens_next_model_bindings_active_project_key_uidx")
    .on(t.projectId, t.modelBindingKey)
    .where(sql`${t.status} = 'active'`),
  modelKeyIdx: index("lens_next_model_bindings_key_idx").on(t.modelBindingKey),
  projectCreatedIdx: index("lens_next_model_bindings_project_created_idx").on(t.projectId, t.createdAt),
}));
