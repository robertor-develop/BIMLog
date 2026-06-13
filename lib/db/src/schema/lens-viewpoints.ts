import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  projectViewpointUnique: unique("lens_viewpoints_project_viewpoint_unique").on(t.projectId, t.viewpointId),
}));
