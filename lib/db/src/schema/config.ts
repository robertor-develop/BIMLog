import { pgTable, serial, text, integer, json } from "drizzle-orm/pg-core";

export const configOptionsTable = pgTable("config_options", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  value: text("value").notNull(),
  label: text("label").notNull(),
  labelEs: text("label_es").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  meta: json("meta").$type<Record<string, string>>(),
});

export type ConfigOption = typeof configOptionsTable.$inferSelect;
