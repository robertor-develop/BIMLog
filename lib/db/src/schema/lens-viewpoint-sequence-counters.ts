import { pgTable, serial, text, integer, unique } from "drizzle-orm/pg-core";

// Atomic per-(project, trade, floor) sequence counters for Lens viewpoints.
// The real Trade+Floor sequence authority lives here: the lens-sync route does a
// single INSERT ... ON CONFLICT DO UPDATE current_seq = current_seq + 1 RETURNING
// against this table, which both creates the row on first use and atomically
// increments it under concurrent syncs (no read-then-write race).
export const lensViewpointSequenceCountersTable = pgTable("lens_viewpoint_sequence_counters", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  trade: text("trade").notNull(),
  floor: text("floor").notNull(),
  currentSeq: integer("current_seq").notNull().default(0),
}, (t) => ({
  projectTradeFloorUnique: unique("lens_viewpoint_sequence_counters_ptf_unique").on(t.projectId, t.trade, t.floor),
}));
