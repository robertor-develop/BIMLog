import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { companiesTable, usersTable } from "./users";

export const userOnboardingProfilesTable = pgTable("user_onboarding_profiles", {
  userId: integer("user_id").primaryKey().references(() => usersTable.id),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  workProfile: text("work_profile"),
  preferredDisciplines: jsonb("preferred_disciplines").notNull().default([]),
  preferredDocumentTypes: jsonb("preferred_document_types").notNull().default(["Shop Drawings"]),
  completedSteps: jsonb("completed_steps").notNull().default([]),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check(
    "user_onboarding_work_profile_chk",
    sql`${table.workProfile} IS NULL OR ${table.workProfile} IN ('bim_coordinator','project_admin','document_controller','designer','field_team','executive')`,
  ),
]);

export const emailVerificationTokensTable = pgTable("email_verification_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("email_verification_tokens_user_idx").on(table.userId, table.createdAt.desc().nullsFirst()),
]);
