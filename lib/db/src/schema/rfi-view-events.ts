import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { rfisTable } from "./rfis";
import { usersTable } from "./users";

export const rfiViewEventsTable = pgTable("rfi_view_events", {
  id: serial("id").primaryKey(),
  rfiId: integer("rfi_id").references(() => rfisTable.id).notNull(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  userFullName: text("user_full_name").notNull(),
  userCompanyName: text("user_company_name").notNull(),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
  eventType: text("event_type").notNull().default("viewed"),
});

export type RfiViewEvent = typeof rfiViewEventsTable.$inferSelect;
