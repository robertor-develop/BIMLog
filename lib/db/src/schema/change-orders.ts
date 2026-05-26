import { pgTable, serial, text, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";
import { filesTable } from "./files";

export const changeOrdersTable = pgTable("change_orders", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  number: text("number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("draft").notNull(),
  initiatedById: integer("initiated_by_id").references(() => usersTable.id).notNull(),
  initiatedByCompany: text("initiated_by_company"),
  approvedById: integer("approved_by_id").references(() => usersTable.id),
  contractValueImpact: text("contract_value_impact"),
  scheduleImpactDays: integer("schedule_impact_days"),
  linkedRfiIds: jsonb("linked_rfi_ids"),
  linkedSubmittalIds: jsonb("linked_submittal_ids"),
  companyLogoUrl: text("company_logo_url"),
  aiDraftUsed: boolean("ai_draft_used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
});

export const changeOrderDocumentsTable = pgTable("change_order_documents", {
  id: serial("id").primaryKey(),
  changeOrderId: integer("change_order_id").references(() => changeOrdersTable.id).notNull(),
  fileId: integer("file_id").references(() => filesTable.id),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ChangeOrder = typeof changeOrdersTable.$inferSelect;
export type ChangeOrderDocument = typeof changeOrderDocumentsTable.$inferSelect;
