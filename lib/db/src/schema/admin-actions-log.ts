import { pgTable, serial, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const adminActionsLogTable = pgTable("admin_actions_log", {
  id: serial("id").primaryKey(),
  adminUserId: integer("admin_user_id").notNull(),
  adminEmail: text("admin_email").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AdminActionLogEntry = typeof adminActionsLogTable.$inferSelect;
