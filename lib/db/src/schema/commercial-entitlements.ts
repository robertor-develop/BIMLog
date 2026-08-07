import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const commercialEntitlementEventsTable = pgTable("commercial_entitlement_events", {
  sequence: serial("sequence").primaryKey(),
  eventKey: text("event_key").notNull().unique("commercial_entitlement_events_event_key_key"),
  userId: integer("user_id").notNull(),
  enabled: boolean("enabled").notNull(),
  reason: text("reason").notNull(),
  actorUserId: integer("actor_user_id"),
  source: text("source").notNull(),
  featureKey: text("feature_key").notNull().default("package"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: "commercial_entitlement_events_user_id_fkey", columns: [table.userId], foreignColumns: [usersTable.id] }),
  foreignKey({ name: "commercial_entitlement_events_actor_user_id_fkey", columns: [table.actorUserId], foreignColumns: [usersTable.id] }),
  check("commercial_entitlement_reason_chk", sql`length(${table.reason}) between 3 and 1000`),
  check("commercial_entitlement_source_chk", sql`${table.source} in ('super_admin','initial_bootstrap')`),
  index("commercial_entitlement_user_sequence_idx").on(table.userId, table.sequence.desc()),
  index("commercial_entitlement_user_feature_sequence_idx").on(table.userId, table.featureKey, table.sequence.desc()),
]);

export type CommercialEntitlementEvent = typeof commercialEntitlementEventsTable.$inferSelect;
