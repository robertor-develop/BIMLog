import { pgTable, serial, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";
import { rfisTable } from "./rfis";
import { submittalsTable } from "./submittals";
import { clashesTable, clashReportsTable } from "./clash_reports";

export const meetingMinutesTable = pgTable("meeting_minutes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  title: text("title").notNull(),
  meetingDate: timestamp("meeting_date").notNull(),
  location: text("location"),
  createdById: integer("created_by_id").references(() => usersTable.id).notNull(),
  notes: text("notes"),
  aiSummary: text("ai_summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
  deleteReason: text("delete_reason"),
});

export const meetingAttendeesTable = pgTable("meeting_attendees", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").references(() => meetingMinutesTable.id).notNull(),
  userId: integer("user_id").references(() => usersTable.id),
  externalEmail: text("external_email"),
  fullName: text("full_name").notNull(),
  company: text("company"),
  role: text("role"),
});

// Canonical RFI identity plus immutable meeting-time display snapshots. Later
// RFI edits therefore cannot rewrite saved or exported meeting history.
export const meetingRfiLinksTable = pgTable("meeting_rfi_links", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  meetingId: integer("meeting_id").references(() => meetingMinutesTable.id).notNull(),
  rfiId: integer("rfi_id").references(() => rfisTable.id).notNull(),
  rfiNumberSnapshot: text("rfi_number_snapshot").notNull(),
  titleSnapshot: text("title_snapshot").notNull(),
  descriptionSnapshot: text("description_snapshot"),
  statusSnapshot: text("status_snapshot").notNull(),
  responsibleSnapshot: text("responsible_snapshot"),
  createdById: integer("created_by_id").references(() => usersTable.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  meetingRfiUnique: uniqueIndex("meeting_rfi_links_meeting_rfi_uidx").on(t.meetingId, t.rfiId),
}));

// Canonical Submittal identity plus immutable meeting-time display snapshots.
// Later Submittal edits cannot silently rewrite saved or exported minutes.
export const meetingSubmittalLinksTable = pgTable("meeting_submittal_links", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  meetingId: integer("meeting_id").references(() => meetingMinutesTable.id).notNull(),
  submittalId: integer("submittal_id").references(() => submittalsTable.id).notNull(),
  numberSnapshot: text("number_snapshot").notNull(),
  titleSnapshot: text("title_snapshot").notNull(),
  descriptionSnapshot: text("description_snapshot"),
  floorSnapshot: text("floor_snapshot"),
  disciplineSnapshot: text("discipline_snapshot"),
  disciplineBucketSnapshot: text("discipline_bucket_snapshot"),
  statusSnapshot: text("status_snapshot").notNull(),
  responsibleSnapshot: text("responsible_snapshot"),
  deadlineSnapshot: timestamp("deadline_snapshot"),
  createdById: integer("created_by_id").references(() => usersTable.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  meetingSubmittalUnique: uniqueIndex("meeting_submittal_links_meeting_submittal_uidx").on(t.meetingId, t.submittalId),
}));

// Stable Clash Log identity plus an explicitly refreshed meeting snapshot.
// Removal is a meeting-only state transition; the canonical Clash is untouched.
export const meetingClashLinksTable = pgTable("meeting_clash_links", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  meetingId: integer("meeting_id").references(() => meetingMinutesTable.id).notNull(),
  clashId: integer("clash_id").references(() => clashesTable.id).notNull(),
  clashReportIdSnapshot: integer("clash_report_id_snapshot").references(() => clashReportsTable.id).notNull(),
  clashNumberSnapshot: text("clash_number_snapshot"),
  descriptionSnapshot: text("description_snapshot"),
  floorSnapshot: text("floor_snapshot"),
  disciplineSnapshot: text("discipline_snapshot"),
  responsibleSnapshot: text("responsible_snapshot"),
  groupSnapshot: text("group_snapshot"),
  statusSnapshot: text("status_snapshot").notNull(),
  deadlineSnapshot: timestamp("deadline_snapshot"),
  meetingNotes: text("meeting_notes"),
  linkState: text("link_state").default("active").notNull(),
  firstLoadedAt: timestamp("first_loaded_at").defaultNow().notNull(),
  lastRefreshedAt: timestamp("last_refreshed_at").defaultNow().notNull(),
  createdById: integer("created_by_id").references(() => usersTable.id).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  meetingClashUnique: uniqueIndex("meeting_clash_links_meeting_clash_uidx").on(t.meetingId, t.clashId),
}));

export const meetingClashRefreshEventsTable = pgTable("meeting_clash_refresh_events", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  meetingId: integer("meeting_id").references(() => meetingMinutesTable.id).notNull(),
  actorId: integer("actor_id").references(() => usersTable.id).notNull(),
  eventType: text("event_type").notNull(),
  addedCount: integer("added_count").default(0).notNull(),
  updatedCount: integer("updated_count").default(0).notNull(),
  unchangedCount: integer("unchanged_count").default(0).notNull(),
  excludedCount: integer("excluded_count").default(0).notNull(),
  userExcludedCount: integer("user_excluded_count").default(0).notNull(),
  failureCount: integer("failure_count").default(0).notNull(),
  openCount: integer("open_count").default(0).notNull(),
  followUpCount: integer("follow_up_count").default(0).notNull(),
  changedFields: text("changed_fields"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MeetingMinutes = typeof meetingMinutesTable.$inferSelect;
export type MeetingAttendee = typeof meetingAttendeesTable.$inferSelect;
export type MeetingRfiLink = typeof meetingRfiLinksTable.$inferSelect;
export type MeetingSubmittalLink = typeof meetingSubmittalLinksTable.$inferSelect;
export type MeetingClashLink = typeof meetingClashLinksTable.$inferSelect;
export type MeetingClashRefreshEvent = typeof meetingClashRefreshEventsTable.$inferSelect;
