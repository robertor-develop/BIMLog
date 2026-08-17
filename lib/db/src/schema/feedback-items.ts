import { sql } from "drizzle-orm";
import { pgTable, serial, text, timestamp, integer, jsonb, index, bigint, boolean, uniqueIndex, check } from "drizzle-orm/pg-core";
import { companiesTable, usersTable } from "./users";
import { projectsTable } from "./projects";

export const feedbackItemsTable = pgTable("feedback_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  projectId: integer("project_id").references(() => projectsTable.id),
  feedbackType: text("feedback_type").notNull(),
  priority: text("priority").default("normal").notNull(),
  module: text("module"),
  pageUrl: text("page_url").notNull(),
  message: text("message").notNull(),
  status: text("status").default("open").notNull(),
  stableId: text("stable_id").notNull(),
  companyId: integer("company_id").references(() => companiesTable.id).notNull(),
  ownerUserId: integer("owner_user_id").references(() => usersTable.id),
  targetRelease: text("target_release"),
  dispositionReason: text("disposition_reason"),
  customerVisible: boolean("customer_visible").default(true).notNull(),
  version: integer("version").default(1).notNull(),
  idempotencyKey: text("idempotency_key"),
  requestHash: text("request_hash"),
  transcript: text("transcript"),
  transcriptProvenance: text("transcript_provenance"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => ({
  statusCreatedIdx: index("feedback_items_status_created_idx").on(table.status, table.createdAt.desc()),
  userCreatedIdx: index("feedback_items_user_created_idx").on(table.userId, table.createdAt.desc()),
  projectCreatedIdx: index("feedback_items_project_created_idx").on(table.projectId, table.createdAt.desc()),
  stableIdIdx: uniqueIndex("feedback_items_stable_id_idx").on(table.stableId),
  idempotencyIdx: uniqueIndex("feedback_items_user_idempotency_idx").on(table.userId, table.idempotencyKey),
  statusCheck: check("feedback_items_status_chk", sql`${table.status} IN ('new','triaged','accepted','in_progress','blocked','fixed','verified','rejected','deferred')`),
  versionCheck: check("feedback_items_version_chk", sql`${table.version} > 0`),
}));

export const feedbackAssetsTable = pgTable("feedback_assets", {
  id: serial("id").primaryKey(),
  feedbackId: integer("feedback_id").references(() => feedbackItemsTable.id).notNull(),
  projectId: integer("project_id").references(() => projectsTable.id),
  uploadedById: integer("uploaded_by_id").references(() => usersTable.id).notNull(),
  kind: text("kind").notNull(),
  originalName: text("original_name").notNull(),
  safeName: text("safe_name").notNull(),
  mediaType: text("media_type").notNull(),
  byteSize: bigint("byte_size", { mode: "number" }).notNull(),
  sha256: text("sha256").notNull(),
  storagePath: text("storage_path").notNull(),
  scanState: text("scan_state").default("quarantined").notNull(),
  scannerAdapter: text("scanner_adapter").default("default-deny").notNull(),
  scannedAt: timestamp("scanned_at"),
  retentionHold: boolean("retention_hold").default(true).notNull(),
  expiresAt: timestamp("expires_at"),
  provenance: jsonb("provenance").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  feedbackIdx: index("feedback_assets_feedback_idx").on(table.feedbackId, table.createdAt),
  dedupIdx: uniqueIndex("feedback_assets_feedback_hash_idx").on(table.feedbackId, table.sha256),
  scanStateCheck: check("feedback_assets_scan_state_chk", sql`${table.scanState} IN ('quarantined','clean','rejected')`),
}));

export const feedbackAuditEventsTable = pgTable("feedback_audit_events", {
  id: serial("id").primaryKey(),
  feedbackId: integer("feedback_id").references(() => feedbackItemsTable.id).notNull(),
  actorUserId: integer("actor_user_id").references(() => usersTable.id).notNull(),
  eventType: text("event_type").notNull(),
  beforeState: jsonb("before_state").$type<Record<string, unknown>>(),
  afterState: jsonb("after_state").$type<Record<string, unknown>>(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({ feedbackIdx: index("feedback_audit_feedback_idx").on(table.feedbackId, table.createdAt) }));

export const feedbackTranscriptionJobsTable = pgTable("feedback_transcription_jobs", {
  id: serial("id").primaryKey(),
  feedbackId: integer("feedback_id").references(() => feedbackItemsTable.id).notNull(),
  assetId: integer("asset_id").references(() => feedbackAssetsTable.id).notNull(),
  requestedById: integer("requested_by_id").references(() => usersTable.id).notNull(),
  state: text("state").default("queued").notNull(),
  adapter: text("adapter").notNull(),
  result: text("result"),
  errorCode: text("error_code"),
  attempts: integer("attempts").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({ feedbackIdx: index("feedback_transcription_feedback_idx").on(table.feedbackId, table.createdAt) }));

export type FeedbackItem = typeof feedbackItemsTable.$inferSelect;
