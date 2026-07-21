import { pgTable, text, timestamp, bigint, serial, integer } from "drizzle-orm/pg-core";

export const livingBriefGateCredentialsTable = pgTable("living_brief_gate_credentials", {
  credentialKey: text("credential_key").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  version: bigint("version", { mode: "number" }).notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdByUserId: integer("created_by_user_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedByUserId: integer("updated_by_user_id"),
  sessionInvalidatedAt: timestamp("session_invalidated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const livingBriefGateAuditTable = pgTable("living_brief_gate_audit", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  actorUserId: integer("actor_user_id").notNull(),
  actorEmail: text("actor_email").notNull(),
  reason: text("reason").notNull(),
  credentialVersion: bigint("credential_version", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type LivingBriefGateCredential = typeof livingBriefGateCredentialsTable.$inferSelect;
export type LivingBriefGateAuditEntry = typeof livingBriefGateAuditTable.$inferSelect;
