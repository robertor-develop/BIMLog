import { pgTable, serial, text, integer, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Per-user credentials for external services (SendGrid, Dropbox, Google Drive,
// BIM 360, Procore, …). One row per (user, provider). `credentials` holds the
// API key or OAuth tokens and is SERVER-SIDE ONLY — it is never serialized back
// to the client. `accountLabel` is a safe-to-display identifier (e.g. the
// verified sender email or connected account name).
export const userConnectionsTable = pgTable("user_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  provider: text("provider").notNull(),       // sendgrid | dropbox | google_drive | bim360 | procore
  kind: text("kind"),                          // email | file_source | pm
  status: text("status").notNull().default("connected"), // connected | error
  credentials: jsonb("credentials").$type<Record<string, unknown>>(),
  accountLabel: text("account_label"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userProviderUnique: uniqueIndex("user_connections_user_provider_uidx").on(t.userId, t.provider),
}));

export type UserConnection = typeof userConnectionsTable.$inferSelect;
