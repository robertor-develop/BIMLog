import { pgTable, uuid, integer, text, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companiesTable, usersTable } from "./users";
import { projectsTable } from "./projects";

export const pageAgentTurnsTable = pgTable("page_agent_turns", {
  requestId: uuid("request_id").primaryKey(),
  conversationId: uuid("conversation_id").notNull(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  projectId: integer("project_id").references(() => projectsTable.id),
  question: text("question").notNull(),
  context: jsonb("context").notNull(),
  answer: text("answer"),
  answerDigest: text("answer_digest"),
  state: text("state").notNull().default("reserved"),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, table => [
  index("page_agent_turns_actor_history_idx").on(table.companyId, table.userId, table.conversationId, table.createdAt, table.requestId),
  uniqueIndex("page_agent_turns_actor_active_idx").on(table.companyId, table.userId, table.conversationId).where(sql`${table.state} IN ('reserved','running')`),
]);

export type PageAgentTurn = typeof pageAgentTurnsTable.$inferSelect;
