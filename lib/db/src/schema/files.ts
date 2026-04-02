import { pgTable, serial, text, timestamp, integer, json, boolean, type AnyPgColumn } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";
import { rfisTable } from "./rfis";

export const filesTable = pgTable("files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: text("file_type").notNull(),
  version: integer("version").notNull().default(1),
  parentFileId: integer("parent_file_id").references((): AnyPgColumn => filesTable.id),
  status: text("status").notNull(),
  uploadedById: integer("uploaded_by_id").references(() => usersTable.id).notNull(),
  extractedText: text("extracted_text"),
  fileMetadata: json("file_metadata").$type<Record<string, unknown>>(),

  // ── Document integrity fields ────────────────────────────────────────────
  fileHash: text("file_hash"),
  fileSizeBytes: integer("file_size_bytes"),
  documentRelationship: text("document_relationship"),
  documentRelationshipDeclaredAt: timestamp("document_relationship_declared_at"),
  versionDiffStatus: text("version_diff_status"),
  hashComparisonNote: text("hash_comparison_note"),
  fileTypeTier: text("file_type_tier"),
  source: text("source").default("user-uploaded"),
  linkedRfiId: integer("linked_rfi_id").references(() => rfisTable.id),
  contentVerificationResult: text("content_verification_result"),
  cvrWorkflowStatus: text("cvr_workflow_status").default("clean"),
  cvrUserReason: text("cvr_user_reason"),
  cvrAdminAction: text("cvr_admin_action"),
  cvrAdminActionAt: timestamp("cvr_admin_action_at"),
  cvrAdminActionBy: integer("cvr_admin_action_by"),
  cvrReminderSentAt: timestamp("cvr_reminder_sent_at"),
  isSuperseded: boolean("is_superseded").default(false).notNull(),
  userConfirmedNonCompliant: boolean("user_confirmed_non_compliant").default(false).notNull(),
  conventionVersion: text("convention_version"),
  rejectionDetails: json("rejection_details").$type<Array<{ field: string; message: string; expected?: string[]; received: string }>>(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ProjectFile = typeof filesTable.$inferSelect;
