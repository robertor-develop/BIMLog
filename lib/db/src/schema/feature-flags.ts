import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const featureFlagsTable = pgTable("feature_flags", {
  id: serial("id").primaryKey(),
  flagName: text("flag_name").notNull().unique(),
  enabled: boolean("enabled").notNull().default(true),
  appliesTo: text("applies_to").notNull().default("global"),
  companyId: integer("company_id"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by"),
});

export type FeatureFlag = typeof featureFlagsTable.$inferSelect;
