import { pgTable, serial, text, integer, boolean, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

// History of generated Lens Viewpoint PDF reports. One row per export. The
// `snapshot` column stores the full array of viewpoints at export time, which is
// the basis for revision tracking, trend deltas and the SHA-256 fingerprint.
export const lensViewpointReportsTable = pgTable("lens_viewpoint_reports", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  reportNumber: text("report_number").notNull(),
  generatedById: integer("generated_by_id"),
  generatedByName: text("generated_by_name"),
  generatedByTitle: text("generated_by_title"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
  reportDate: timestamp("report_date", { withTimezone: true }),
  viewpointCount: integer("viewpoint_count"),
  healthScore: integer("health_score"),
  healthBreakdown: jsonb("health_breakdown"),
  filtersApplied: jsonb("filters_applied"),
  watermarkType: text("watermark_type"),
  submittedTo: text("submitted_to"),
  isExecutiveOnePager: boolean("is_executive_one_pager").default(false),
  snapshot: jsonb("snapshot").notNull(),
  contentHash: text("content_hash"),
  supersededByReportId: integer("superseded_by_report_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  projectNumberUnique: uniqueIndex("lens_viewpoint_reports_project_number_unique").on(t.projectId, t.reportNumber),
}));

// Status-change events for Lens viewpoints. Populated from now on whenever a
// viewpoint status is updated, so Round 2/3 (health score, timeline, velocity)
// have real data to work with. Historical changes before this table existed are
// not backfilled.
export const lensViewpointEventsTable = pgTable("lens_viewpoint_events", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  viewpointId: integer("viewpoint_id").notNull(),
  eventType: text("event_type").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  changedById: integer("changed_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
