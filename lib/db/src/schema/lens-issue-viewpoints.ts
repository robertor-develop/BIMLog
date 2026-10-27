import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { lensViewpointsTable } from "./lens-viewpoints";
import { usersTable } from "./users";

export const lensIssueViewpointsTable = pgTable("lens_issue_viewpoints", {
  id: text("id").primaryKey(),
  issueId: integer("issue_id").notNull().references(() => lensViewpointsTable.id, { onDelete: "cascade" }),
  projectId: integer("project_id").notNull(),
  modelFingerprint: text("model_fingerprint"),
  name: text("name").notNull(),
  viewpointType: text("viewpoint_type").notNull().default("coordination"),
  displayOrder: integer("display_order").notNull().default(0),
  isPrimary: boolean("is_primary").notNull().default(false),
  lifecycleStatus: text("lifecycle_status").notNull().default("active"),
  navisworksGuid: text("navisworks_guid"),
  screenshotUrl: text("screenshot_url"),
  visualStateJson: text("visual_state_json"),
  visualStateDigest: text("visual_state_digest"),
  capturedByUserId: integer("captured_by_user_id").references(() => usersTable.id),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  renamedAt: timestamp("renamed_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  primaryActiveUnique: uniqueIndex("lens_issue_viewpoints_primary_active_uq").on(table.issueId).where(sql`is_primary AND lifecycle_status='active'`),
  issueGuidActiveUnique: uniqueIndex("lens_issue_viewpoints_issue_guid_active_uq").on(table.issueId, table.navisworksGuid).where(sql`navisworks_guid IS NOT NULL AND lifecycle_status='active'`),
  issueOrderIndex: index("lens_issue_viewpoints_order_idx").on(table.issueId, table.lifecycleStatus, table.displayOrder, table.id),
}));

export const lensIssueViewpointRevisionsTable = pgTable("lens_issue_viewpoint_revisions", {
  id: text("id").primaryKey(),
  issueViewpointId: text("issue_viewpoint_id").notNull().references(() => lensIssueViewpointsTable.id, { onDelete: "cascade" }),
  revisionNumber: integer("revision_number").notNull(),
  action: text("action").notNull(),
  name: text("name").notNull(),
  displayOrder: integer("display_order").notNull(),
  isPrimary: boolean("is_primary").notNull(),
  lifecycleStatus: text("lifecycle_status").notNull(),
  modelFingerprint: text("model_fingerprint"),
  navisworksGuid: text("navisworks_guid"),
  screenshotUrl: text("screenshot_url"),
  visualStateJson: text("visual_state_json"),
  visualStateDigest: text("visual_state_digest"),
  actorUserId: integer("actor_user_id").references(() => usersTable.id),
  reason: text("reason"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  revisionUnique: uniqueIndex("lens_issue_viewpoint_revisions_number_uq").on(table.issueViewpointId, table.revisionNumber),
  historyIndex: index("lens_issue_viewpoint_revisions_history_idx").on(table.issueViewpointId, table.revisionNumber),
}));

export type LensIssueViewpoint = typeof lensIssueViewpointsTable.$inferSelect;
export type LensIssueViewpointRevision = typeof lensIssueViewpointRevisionsTable.$inferSelect;
