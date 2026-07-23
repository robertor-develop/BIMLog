import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { meetingMinutesTable } from "./meeting-minutes";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const coordinatorBulkMeetingOperationsTable = pgTable(
  "coordinator_bulk_meeting_operations",
  {
    id: text("id").primaryKey(),
    projectId: integer("project_id").references(() => projectsTable.id).notNull(),
    userId: integer("user_id").references(() => usersTable.id).notNull(),
    meetingId: integer("meeting_id").references(() => meetingMinutesTable.id).notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    resultSnapshot: jsonb("result_snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    idempotencyUnique: uniqueIndex("coordinator_bulk_meeting_operations_idempotency_uidx").on(
      table.userId,
      table.projectId,
      table.idempotencyKey,
    ),
    projectMeetingIndex: index("coordinator_bulk_meeting_operations_project_meeting_idx").on(
      table.projectId,
      table.meetingId,
      table.createdAt,
    ),
  }),
);

export type CoordinatorBulkMeetingOperation =
  typeof coordinatorBulkMeetingOperationsTable.$inferSelect;
