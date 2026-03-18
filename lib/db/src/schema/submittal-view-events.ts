import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { submittalsTable } from "./submittals";
import { usersTable } from "./users";

export const submittalViewEventsTable = pgTable("submittal_view_events", {
  id: serial("id").primaryKey(),
  submittalId: integer("submittal_id").references(() => submittalsTable.id).notNull(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  userFullName: text("user_full_name").notNull(),
  userCompanyName: text("user_company_name").notNull(),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
  eventType: text("event_type").notNull().default("viewed"),
});

export type SubmittalViewEvent = typeof submittalViewEventsTable.$inferSelect;
