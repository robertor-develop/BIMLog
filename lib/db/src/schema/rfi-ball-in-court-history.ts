import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { rfisTable } from "./rfis";

export const rfiBallInCourtHistoryTable = pgTable("rfi_ball_in_court_history", {
  id: serial("id").primaryKey(),
  rfiId: integer("rfi_id").references(() => rfisTable.id).notNull(),
  heldBy: text("held_by").notNull(),
  heldByCompany: text("held_by_company").notNull(),
  fromDate: timestamp("from_date").defaultNow().notNull(),
  toDate: timestamp("to_date"),
  daysHeld: integer("days_held"),
});
