import { pgTable, serial, text, integer, timestamp, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const lensViewpointsTable = pgTable("lens_viewpoints", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  viewpointId: text("viewpoint_id").notNull(),
  note: text("note"),
  trade: text("trade"),
  reportType: text("report_type"),
  priority: integer("priority").default(3),
  floor: text("floor"),
  openItems: text("open_items"),
  capturedAt: timestamp("captured_at", { withTimezone: true }),
  status: text("status").notNull().default("open"),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
  displayId: text("display_id"),
  navisworksGuid: text("navisworks_guid"),
  screenshotUrl: text("screenshot_url"),
  // Real server-assigned Trade+Floor sequence (from lens_viewpoint_sequence_counters).
  // Null for legacy rows that predate this system — display falls back to display_id.
  tradeFloorSeq: integer("trade_floor_seq"),
  // The "R" correction number. Null normally; 1/2/3... when the platform had to
  // correct what the plugin submitted. Display shows "-R{n}" only when non-null.
  tradeFloorSeqCorrection: integer("trade_floor_seq_correction"),
  // Shared identifier across viewpoints from one multi-trade save. Only ever set
  // from an incoming payload field; never generated/inferred server-side.
  issueGroupId: text("issue_group_id"),
  // Lifecycle state, distinct from the workflow `status`. active | superseded | voided.
  lifecycleStatus: text("lifecycle_status").notNull().default("active"),
  // Self-reference: a Reassign creates a new row pointing back at the row it supersedes.
  supersedesId: integer("supersedes_id").references((): AnyPgColumn => lensViewpointsTable.id),
  // Single visible revision counter. Starts at 1; every Edit or Reassign creates a
  // new row with revision_number = old.revision_number + 1. Walk supersedes_id
  // backward to recover prior revisions.
  revisionNumber: integer("revision_number").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  // Partial unique indexes: uniqueness only applies to ACTIVE rows, so a superseded
  // row and a new active row can coexist for the same underlying viewpoint/GUID.
  projectViewpointActiveUnique: uniqueIndex("lens_viewpoints_project_viewpoint_active_unique")
    .on(t.projectId, t.viewpointId).where(sql`lifecycle_status = 'active'`),
  projectGuidActiveUnique: uniqueIndex("lens_viewpoints_project_guid_active_unique")
    .on(t.projectId, t.navisworksGuid).where(sql`lifecycle_status = 'active'`),
}));
