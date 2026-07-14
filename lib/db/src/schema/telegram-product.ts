import { pgTable, serial, text, integer, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

export const notificationChannelsTable = pgTable("notification_channels", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  adapterId: text("adapter_id").notNull(),
  provider: text("provider").notNull().default("telegram"),
  status: text("status").notNull().default("connected"),
  telegramUserHash: text("telegram_user_hash").notNull(),
  telegramChatHash: text("telegram_chat_hash").notNull(),
  encryptedTelegramUserId: text("encrypted_telegram_user_id").notNull(),
  encryptedTelegramChatId: text("encrypted_telegram_chat_id").notNull(),
  accountLabel: text("account_label"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  linkedAt: timestamp("linked_at", { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  activeUserUnique: uniqueIndex("notification_channels_active_user_uidx")
    .on(t.adapterId, t.userId)
    .where(sql`status = 'connected'`),
  activeTelegramUserUnique: uniqueIndex("notification_channels_active_telegram_user_uidx")
    .on(t.adapterId, t.telegramUserHash)
    .where(sql`status = 'connected'`),
}));

export const channelLinkingTokensTable = pgTable("channel_linking_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  adapterId: text("adapter_id").notNull(),
  tokenHmac: text("token_hmac").notNull(),
  status: text("status").notNull().default("pending"),
  consentVersion: text("consent_version").notNull(),
  consentPurpose: text("consent_purpose").notNull().default("channel_linking"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  tokenUnique: uniqueIndex("channel_linking_tokens_hmac_uidx").on(t.adapterId, t.tokenHmac),
  userCreatedIdx: index("channel_linking_tokens_user_created_idx").on(t.userId, t.createdAt),
}));

export const notificationPreferencesTable = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  adapterId: text("adapter_id").notNull(),
  channel: text("channel").notNull().default("telegram"),
  enabled: text("enabled").notNull().default("false"),
  language: text("language").notNull().default("en"),
  topics: jsonb("topics").$type<Record<string, boolean>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userAdapterUnique: uniqueIndex("notification_preferences_user_adapter_uidx").on(t.userId, t.adapterId, t.channel),
}));

export const consentRecordsTable = pgTable("consent_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  adapterId: text("adapter_id").notNull(),
  channel: text("channel").notNull().default("telegram"),
  consentVersion: text("consent_version").notNull(),
  status: text("status").notNull(),
  purpose: text("purpose").notNull().default("channel_linking"),
  source: text("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userCreatedIdx: index("consent_records_user_created_idx").on(t.userId, t.createdAt),
}));

export const telegramInboundUpdatesTable = pgTable("telegram_inbound_updates", {
  id: serial("id").primaryKey(),
  adapterId: text("adapter_id").notNull(),
  updateId: text("update_id").notNull(),
  status: text("status").notNull().default("received"),
  telegramUserHash: text("telegram_user_hash"),
  telegramChatHash: text("telegram_chat_hash"),
  command: text("command"),
  encryptedEvidence: text("encrypted_evidence").notNull(),
  errorCode: text("error_code"),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, (t) => ({
  updateUnique: uniqueIndex("telegram_inbound_updates_adapter_update_uidx").on(t.adapterId, t.updateId),
  receivedIdx: index("telegram_inbound_updates_received_idx").on(t.receivedAt),
}));

export type NotificationChannel = typeof notificationChannelsTable.$inferSelect;
export type ChannelLinkingToken = typeof channelLinkingTokensTable.$inferSelect;
export type NotificationPreference = typeof notificationPreferencesTable.$inferSelect;
export type ConsentRecord = typeof consentRecordsTable.$inferSelect;
export type TelegramInboundUpdate = typeof telegramInboundUpdatesTable.$inferSelect;
