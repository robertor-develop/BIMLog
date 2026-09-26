import { pgTable, serial, text, timestamp, integer, jsonb, boolean, foreignKey, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companiesTable = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  retiredIntoCompanyId: integer("retired_into_company_id"),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  website: text("website"),
  address: text("address"),
  phone: text("phone"),
  companyLogoUrl: text("company_logo_url"),
  industry: text("industry"),
  companyType: text("company_type"),
  isPublicProfile: boolean("is_public_profile").default(false).notNull(),
  profileDescription: text("profile_description"),
  verifiedProjectsCount: integer("verified_projects_count").default(0).notNull(),
}, (t) => [
  foreignKey({ name: "companies_retired_into_fk", columns: [t.retiredIntoCompanyId], foreignColumns: [t.id] }),
  check("companies_retirement_chk", sql`(${t.retiredIntoCompanyId} IS NULL AND ${t.retiredAt} IS NULL) OR (${t.retiredIntoCompanyId} IS NOT NULL AND ${t.retiredAt} IS NOT NULL AND ${t.retiredIntoCompanyId} <> ${t.id})`),
]);

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
  canAccessLivingBrief: boolean("can_access_living_brief").default(false).notNull(),
  openaiApiKey: text("openai_api_key"),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type Company = typeof companiesTable.$inferSelect;
