import { pgTable, serial, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";
import { rfisTable } from "./rfis";
import { submittalsTable } from "./submittals";

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

export type MeetingMinutes = typeof meetingMinutesTable.$inferSelect;
export type MeetingAttendee = typeof meetingAttendeesTable.$inferSelect;
export type MeetingRfiLink = typeof meetingRfiLinksTable.$inferSelect;
export type MeetingSubmittalLink = typeof meetingSubmittalLinksTable.$inferSelect;
