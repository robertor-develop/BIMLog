import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const emailLogTable = pgTable("email_log", {
  id: serial("id").primaryKey(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  triggerType: text("trigger_type"),
  status: text("status").notNull().default("sent"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export type EmailLogEntry = typeof emailLogTable.$inferSelect;
