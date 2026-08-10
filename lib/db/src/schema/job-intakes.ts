import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companiesTable, usersTable } from "./users";
import { projectsTable } from "./projects";
import { filesTable } from "./files";
import { financialContractsTable } from "./financial-contracts";

export const jobIntakesTable = pgTable("job_intakes", {
  id: text("id").primaryKey(), companyId: integer("company_id").notNull().references(() => companiesTable.id), projectId: integer("project_id").notNull().references(() => projectsTable.id),
  status: text("status").notNull().default("draft"), revision: integer("revision").notNull().default(1), data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}), completion: jsonb("completion").$type<Record<string, unknown>>().notNull().default({}),
  activatedContractId: text("activated_contract_id").references(() => financialContractsTable.id), createdById: integer("created_by_id").notNull().references(() => usersTable.id), updatedById: integer("updated_by_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(), activatedAt: timestamp("activated_at", { withTimezone: true }),
}, (table) => [uniqueIndex("job_intake_project_uidx").on(table.projectId), index("job_intake_company_status_idx").on(table.companyId, table.status, table.updatedAt), check("job_intake_status_chk", sql`${table.status} IN ('draft','ready','activated')`), check("job_intake_revision_positive_chk", sql`${table.revision} > 0`)]);

export const jobIntakeDocumentsTable = pgTable("job_intake_documents", {
  id: text("id").primaryKey(), intakeId: text("intake_id").notNull().references(() => jobIntakesTable.id), projectId: integer("project_id").notNull().references(() => projectsTable.id), fileId: integer("file_id").notNull().references(() => filesTable.id),
  category: text("category").notNull(), revisionLabel: text("revision_label"), sourceHash: text("source_hash").notNull(), extractionStatus: text("extraction_status").notNull(), extractionSummary: jsonb("extraction_summary").$type<Record<string, unknown>>().notNull().default({}),
  uploadedById: integer("uploaded_by_id").notNull().references(() => usersTable.id), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), removedAt: timestamp("removed_at", { withTimezone: true }), removedById: integer("removed_by_id").references(() => usersTable.id),
}, (table) => [uniqueIndex("job_intake_document_uidx").on(table.intakeId, table.fileId), index("job_intake_document_active_idx").on(table.intakeId, table.createdAt), check("job_intake_document_category_chk", sql`${table.category} IN ('quotation','proposal','takeoff','estimate','contract','supporting')`), check("job_intake_document_extraction_chk", sql`${table.extractionStatus} IN ('structured_preview','text_preview','manual_review_required')`)]);

export const jobIntakeEventsTable = pgTable("job_intake_events", {
  id: text("id").primaryKey(), intakeId: text("intake_id").notNull().references(() => jobIntakesTable.id), projectId: integer("project_id").notNull().references(() => projectsTable.id), actorUserId: integer("actor_user_id").notNull().references(() => usersTable.id), eventType: text("event_type").notNull(), beforeRevision: integer("before_revision"), afterRevision: integer("after_revision"), evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("job_intake_event_idx").on(table.intakeId, table.createdAt, table.id)]);
