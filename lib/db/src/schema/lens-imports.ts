import { pgTable, serial, text, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

export const lensImportBatchesTable = pgTable("lens_import_batches", {
  id: serial("id").primaryKey(),
  targetProjectId: integer("target_project_id").notNull(),
  importKey: text("import_key").notNull(),
  modelKey: text("model_key").notNull(),
  requestHash: text("request_hash").notNull(),
  sourceProjectIds: text("source_project_ids").notNull(),
  status: text("status").notNull().default("pending"),
  requestedById: integer("requested_by_id").notNull(),
  createdCount: integer("created_count").notNull().default(0),
  reusedCount: integer("reused_count").notNull().default(0),
  unresolvedCount: integer("unresolved_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => ({
  userTargetImportUnique: uniqueIndex("lens_import_batches_user_target_key_unique").on(t.requestedById, t.targetProjectId, t.importKey),
  targetCreatedIndex: index("lens_import_batches_target_created_idx").on(t.targetProjectId, t.createdAt),
}));

export const lensImportItemsTable = pgTable("lens_import_items", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull(),
  targetProjectId: integer("target_project_id").notNull(),
  sourceIdentityKey: text("source_identity_key").notNull(),
  sourceProjectId: integer("source_project_id").notNull(),
  sourceServerId: integer("source_server_id"),
  sourcePhysicalId: text("source_physical_id"),
  sourceNavisworksGuid: text("source_navisworks_guid"),
  sourceDisplayLabel: text("source_display_label"),
  targetServerId: integer("target_server_id").notNull(),
  targetPhysicalId: text("target_physical_id").notNull(),
  targetViewpointId: text("target_viewpoint_id").notNull(),
  lineageStatus: text("lineage_status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  batchSourceUnique: uniqueIndex("lens_import_items_batch_source_unique").on(t.batchId, t.sourceIdentityKey),
  targetServerIndex: index("lens_import_items_target_server_idx").on(t.targetProjectId, t.targetServerId),
}));
