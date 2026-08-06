import { boolean, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const commercialEntitlementEventsTable = pgTable("commercial_entitlement_events", {
  sequence: serial("sequence").primaryKey(),
  eventKey: text("event_key").notNull().unique(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  enabled: boolean("enabled").notNull(),
  reason: text("reason").notNull(),
  actorUserId: integer("actor_user_id").references(() => usersTable.id),
  source: text("source").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("commercial_entitlement_user_sequence_idx").on(table.userId, table.sequence)]);

export type CommercialEntitlementEvent = typeof commercialEntitlementEventsTable.$inferSelect;
