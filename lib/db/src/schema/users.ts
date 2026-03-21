import { pgTable, serial, text, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companiesTable = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  website: text("website"),
  address: text("address"),
  phone: text("phone"),
  companyLogoUrl: text("company_logo_url"),
});

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  companyId: integer("company_id").references(() => companiesTable.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  jobTitle: text("job_title"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  signatureUrl: text("signature_url"),
  apiToken: text("api_token"),
  notificationPreferences: jsonb("notification_preferences"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type Company = typeof companiesTable.$inferSelect;
