import { pgTable, serial, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { rfisTable } from "./rfis";

export const rfiBallInCourtHistoryTable = pgTable("rfi_ball_in_court_history", {
  id: serial("id").primaryKey(),
  rfiId: integer("rfi_id").references(() => rfisTable.id).notNull(),
  heldBy: text("held_by").notNull(),
  heldByCompany: text("held_by_company").notNull(),
  fromDate: timestamp("from_date").defaultNow().notNull(),
  toDate: timestamp("to_date"),
  daysHeld: integer("days_held"),
}, (t) => ({
  // At most one OPEN custody row per RFI. Exact name/shape of the partial unique
  // index app.ts creates at runtime in production.
  openUnique: uniqueIndex("rfi_ball_in_court_open_unique")
    .on(t.rfiId).where(sql`to_date IS NULL`),
}));
