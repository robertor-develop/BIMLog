import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

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

export type MeetingMinutes = typeof meetingMinutesTable.$inferSelect;
export type MeetingAttendee = typeof meetingAttendeesTable.$inferSelect;
