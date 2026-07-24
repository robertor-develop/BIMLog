import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { meetingMinutesTable } from "./meeting-minutes";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const coordinatorBulkMeetingOperationsTable = pgTable(
  "coordinator_bulk_meeting_operations",
  {
    id: text("id").primaryKey(),
    projectId: integer("project_id").notNull(),
    userId: integer("user_id").notNull(),
    meetingId: integer("meeting_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    resultSnapshot: jsonb("result_snapshot")
      .$type<Record<string, unknown>>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idempotencyUnique: uniqueIndex(
      "coordinator_bulk_meeting_operations_idempotency_uidx",
    ).on(table.userId, table.projectId, table.idempotencyKey),
    projectMeetingIndex: index(
      "coordinator_bulk_meeting_operations_project_meeting_idx",
    ).on(table.projectId, table.meetingId, table.createdAt.desc()),
    projectForeignKey: foreignKey({
      columns: [table.projectId],
      foreignColumns: [projectsTable.id],
      name: "coordinator_bulk_meeting_operations_project_id_fkey",
    }),
    userForeignKey: foreignKey({
      columns: [table.userId],
      foreignColumns: [usersTable.id],
      name: "coordinator_bulk_meeting_operations_user_id_fkey",
    }),
    meetingForeignKey: foreignKey({
      columns: [table.meetingId],
      foreignColumns: [meetingMinutesTable.id],
      name: "coordinator_bulk_meeting_operations_meeting_id_fkey",
    }),
    keyLengthCheck: check(
      "coordinator_bulk_meeting_operation_key_length_chk",
      sql`char_length(${table.idempotencyKey}) BETWEEN 8 AND 100`,
    ),
    resultSizeCheck: check(
      "coordinator_bulk_meeting_operation_result_size_chk",
      sql`octet_length(${table.resultSnapshot}::text) <= 65536`,
    ),
  }),
);

export type CoordinatorBulkMeetingOperation =
  typeof coordinatorBulkMeetingOperationsTable.$inferSelect;
