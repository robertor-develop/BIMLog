import { pgTable, serial, text, integer, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";
import { companiesTable } from "./users";
import { projectsTable } from "./projects";
import { aiRunsTable } from "./ai-control-plane";

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

export const telegramConversationsTable = pgTable("telegram_conversations", {
  id: text("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  companyId: integer("company_id").references(() => companiesTable.id).notNull(),
  notificationChannelId: integer("notification_channel_id").references(() => notificationChannelsTable.id),
  adapterId: text("adapter_id").notNull(),
  language: text("language").notNull().default("en"),
  mode: text("mode").notNull(),
  projectId: integer("project_id").references(() => projectsTable.id),
  status: text("status").notNull().default("open"),
  aiFundingSource: text("ai_funding_source"),
  aiRunId: text("ai_run_id").references(() => aiRunsTable.id),
  supportCaseId: text("support_case_id"),
  privacyNoticeVersion: text("privacy_notice_version").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userActivityIdx: index("telegram_conversations_user_activity_idx").on(t.userId, t.lastActivityAt),
  companyActivityIdx: index("telegram_conversations_company_activity_idx").on(t.companyId, t.lastActivityAt),
}));

export const telegramConversationMessagesTable = pgTable("telegram_conversation_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").references(() => telegramConversationsTable.id).notNull(),
  direction: text("direction").notNull(),
  senderRole: text("sender_role").notNull(),
  telegramUpdateId: text("telegram_update_id"),
  telegramMessageId: text("telegram_message_id"),
  idempotencyKey: text("idempotency_key").notNull(),
  language: text("language").notNull().default("en"),
  sanitizedText: text("sanitized_text").notNull(),
  messageType: text("message_type").notNull().default("text"),
  processingState: text("processing_state").notNull().default("processed"),
  deliveryState: text("delivery_state").notNull().default("not_applicable"),
  requestedAction: text("requested_action"),
  deliveredSummary: text("delivered_summary"),
  aiRunId: text("ai_run_id").references(() => aiRunsTable.id),
  errorCategory: text("error_category"),
  telegramDeliveryMessageId: text("telegram_delivery_message_id"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  deliveryAttempts: integer("delivery_attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idempotencyUnique: uniqueIndex("telegram_conversation_messages_idempotency_uidx").on(t.conversationId, t.idempotencyKey),
  createdIdx: index("telegram_conversation_messages_created_idx").on(t.conversationId, t.createdAt),
}));

export const telegramSupportCasesTable = pgTable("telegram_support_cases", {
  id: text("id").primaryKey(),
  caseNumber: text("case_number").notNull(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  companyId: integer("company_id").references(() => companiesTable.id).notNull(),
  conversationId: text("conversation_id").references(() => telegramConversationsTable.id),
  projectId: integer("project_id").references(() => projectsTable.id),
  category: text("category").notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull().default("normal"),
  status: text("status").notNull().default("new"),
  language: text("language").notNull().default("en"),
  assignedToId: integer("assigned_to_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
}, (t) => ({
  caseNumberUnique: uniqueIndex("telegram_support_cases_case_number_uidx").on(t.caseNumber),
  userIdx: index("telegram_support_cases_user_idx").on(t.userId, t.createdAt),
  companyIdx: index("telegram_support_cases_company_idx").on(t.companyId, t.status, t.createdAt),
}));

export const telegramSupportCaseEventsTable = pgTable("telegram_support_case_events", {
  id: text("id").primaryKey(),
  caseId: text("case_id").references(() => telegramSupportCasesTable.id).notNull(),
  actorUserId: integer("actor_user_id").references(() => usersTable.id),
  action: text("action").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  reason: text("reason").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  caseIdx: index("telegram_support_case_events_case_idx").on(t.caseId, t.createdAt),
}));

export type NotificationChannel = typeof notificationChannelsTable.$inferSelect;
export type ChannelLinkingToken = typeof channelLinkingTokensTable.$inferSelect;
export type NotificationPreference = typeof notificationPreferencesTable.$inferSelect;
export type ConsentRecord = typeof consentRecordsTable.$inferSelect;
export type TelegramInboundUpdate = typeof telegramInboundUpdatesTable.$inferSelect;
export type TelegramConversation = typeof telegramConversationsTable.$inferSelect;
export type TelegramConversationMessage = typeof telegramConversationMessagesTable.$inferSelect;
export type TelegramSupportCase = typeof telegramSupportCasesTable.$inferSelect;
export type TelegramSupportCaseEvent = typeof telegramSupportCaseEventsTable.$inferSelect;
