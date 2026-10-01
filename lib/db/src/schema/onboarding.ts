import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
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
});

export const emailVerificationTokensTable = pgTable("email_verification_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
