import { pgTable, serial, bigserial, text, integer, timestamp, jsonb, boolean, time, uniqueIndex, index, unique, primaryKey, check } from "drizzle-orm/pg-core";
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
  paused: boolean("paused").notNull().default(false),
  timezone: text("timezone").notNull().default("UTC"),
  quietHoursStart: time("quiet_hours_start"),
  quietHoursEnd: time("quiet_hours_end"),
  deliveryFrequency: text("delivery_frequency").notNull().default("off"),
  digestCadence: text("digest_cadence").notNull().default("daily"),
  telegramEnabled: boolean("telegram_enabled").notNull().default(false),
  emailEnabled: boolean("email_enabled").notNull().default(false),
  overdueFrequency: text("overdue_frequency").notNull().default("off"),
  projectMode: text("project_mode").notNull().default("all_authorized"),
  updatedByUserId: integer("updated_by_user_id").references(() => usersTable.id),
  updateSource: text("update_source").notNull().default("system"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userAdapterUnique: uniqueIndex("notification_preferences_user_adapter_uidx").on(t.userId, t.adapterId, t.channel),
}));

export const telegramNotificationProjectPreferencesTable = pgTable("telegram_notification_project_preferences", {
  id: bigserial("id", { mode: "number" }).primaryKey(), userId: integer("user_id").references(() => usersTable.id).notNull(), projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  enabled: boolean("enabled").notNull(), updatedByUserId: integer("updated_by_user_id").references(() => usersTable.id), updateSource: text("update_source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ userProjectUnique: uniqueIndex("telegram_notification_project_user_uidx").on(t.userId,t.projectId), projectIdx: index("telegram_notification_project_project_idx").on(t.projectId,t.userId) }));

export const telegramNotificationModulePreferencesTable = pgTable("telegram_notification_module_preferences", {
  id: bigserial("id", { mode: "number" }).primaryKey(), userId: integer("user_id").references(() => usersTable.id).notNull(), moduleKey: text("module_key").notNull(), enabled: boolean("enabled").notNull(),
  updatedByUserId: integer("updated_by_user_id").references(() => usersTable.id), updateSource: text("update_source").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ userModuleUnique: uniqueIndex("telegram_notification_module_user_uidx").on(t.userId,t.moduleKey) }));

export const telegramNotificationEventPreferencesTable = pgTable("telegram_notification_event_preferences", {
  id: bigserial("id", { mode: "number" }).primaryKey(), userId: integer("user_id").references(() => usersTable.id).notNull(), eventKey: text("event_key").notNull(), enabled: boolean("enabled").notNull(),
  updatedByUserId: integer("updated_by_user_id").references(() => usersTable.id), updateSource: text("update_source").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ userEventUnique: uniqueIndex("telegram_notification_event_user_uidx").on(t.userId,t.eventKey) }));

export const telegramNotificationOutboxTable = pgTable("telegram_notification_outbox", {
  id: text("id").primaryKey(), canonicalEventId: text("canonical_event_id").notNull(), companyId: integer("company_id").references(() => companiesTable.id).notNull(), projectId: integer("project_id").references(() => projectsTable.id), userId: integer("user_id").references(() => usersTable.id).notNull(),
  moduleKey: text("module_key").notNull(), eventKey: text("event_key").notNull(), sourceRecordType: text("source_record_type").notNull(), sourceRecordId: text("source_record_id").notNull(), channel: text("channel").notNull(), deliveryFrequency: text("delivery_frequency").notNull(), digestWindowKey: text("digest_window_key").notNull().default(""),
  templateData: jsonb("template_data").$type<{en:string;es:string}>().notNull().default({en:"",es:""}), authorizationSnapshot: jsonb("authorization_snapshot").$type<Record<string,unknown>>().notNull().default({}), preferenceDecision: jsonb("preference_decision").$type<Record<string,unknown>>().notNull().default({}),
  scheduledFor: timestamp("scheduled_for",{withTimezone:true}).defaultNow().notNull(), state: text("state").notNull(), attemptCount: integer("attempt_count").notNull().default(0), providerAcknowledgementId: text("provider_acknowledgement_id"), failureCategory: text("failure_category"), securityCritical: boolean("security_critical").notNull().default(false),
  createdAt: timestamp("created_at",{withTimezone:true}).defaultNow().notNull(), updatedAt: timestamp("updated_at",{withTimezone:true}).defaultNow().notNull(), deliveredAt: timestamp("delivered_at",{withTimezone:true}),
}, (t) => ({ idempotencyUnique: uniqueIndex("telegram_notification_outbox_idempotency_uidx").on(t.userId,t.canonicalEventId,t.channel,t.deliveryFrequency,t.digestWindowKey), claimIdx: index("telegram_notification_outbox_claim_idx").on(t.state,t.scheduledFor,t.createdAt), userIdx: index("telegram_notification_outbox_user_idx").on(t.userId,t.createdAt.desc().nullsFirst()) }));

export const telegramNotificationOutboxEventsTable = pgTable("telegram_notification_outbox_events", {
  id:text("id").primaryKey(), notificationId:text("notification_id").references(()=>telegramNotificationOutboxTable.id).notNull(), actorUserId:integer("actor_user_id").references(()=>usersTable.id), fromState:text("from_state"), toState:text("to_state").notNull(), eventType:text("event_type").notNull(), reason:text("reason").notNull(), safeDetails:jsonb("safe_details").$type<Record<string,unknown>>().notNull().default({}), createdAt:timestamp("created_at",{withTimezone:true}).defaultNow().notNull(),
}, (t)=>({notificationIdx:index("telegram_notification_outbox_events_idx").on(t.notificationId,t.createdAt,t.id)}));

export const telegramNotificationAttemptsTable = pgTable("telegram_notification_attempts", {
  id:text("id").primaryKey(), notificationId:text("notification_id").references(()=>telegramNotificationOutboxTable.id).notNull(), attemptNumber:integer("attempt_number").notNull(), channel:text("channel").notNull(), state:text("state").notNull(), providerAcknowledgementId:text("provider_acknowledgement_id"), failureCategory:text("failure_category"), startedAt:timestamp("started_at",{withTimezone:true}).defaultNow().notNull(), completedAt:timestamp("completed_at",{withTimezone:true}),
}, (t)=>({attemptUnique:uniqueIndex("telegram_notification_attempts_number_uidx").on(t.notificationId,t.attemptNumber)}));

export const telegramNotificationDigestWindowsTable = pgTable("telegram_notification_digest_windows", {
  id:text("id").primaryKey(), userId:integer("user_id").references(()=>usersTable.id).notNull(), frequency:text("frequency").notNull(), timezone:text("timezone").notNull(), windowKey:text("window_key").notNull(), startsAt:timestamp("starts_at",{withTimezone:true}).notNull(), endsAt:timestamp("ends_at",{withTimezone:true}).notNull(), scheduledFor:timestamp("scheduled_for",{withTimezone:true}).notNull(), state:text("state").notNull().default("pending"), providerAcknowledgementId:text("provider_acknowledgement_id"), createdAt:timestamp("created_at",{withTimezone:true}).defaultNow().notNull(), updatedAt:timestamp("updated_at",{withTimezone:true}).defaultNow().notNull(), deliveredAt:timestamp("delivered_at",{withTimezone:true}),
}, (t)=>({windowUnique:uniqueIndex("telegram_notification_digest_window_uidx").on(t.userId,t.frequency,t.windowKey)}));

export const telegramNotificationDigestMembersTable = pgTable("telegram_notification_digest_members", {
  digestId:text("digest_id").references(()=>telegramNotificationDigestWindowsTable.id).notNull(), notificationId:text("notification_id").references(()=>telegramNotificationOutboxTable.id).notNull(), createdAt:timestamp("created_at",{withTimezone:true}).defaultNow().notNull(),
}, (t)=>({pk:primaryKey({name:"telegram_notification_digest_members_pkey", columns:[t.digestId,t.notificationId]}), notificationUnique:unique("telegram_notification_digest_members_notification_id_key").on(t.notificationId)}));

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
  statusChk: check("telegram_support_cases_status_chk", sql`${t.status} = ANY (ARRAY['new'::text, 'acknowledged'::text, 'in_progress'::text, 'waiting_for_user'::text, 'resolved'::text, 'closed'::text])`),
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

export const telegramDeliveryRequestsTable = pgTable("telegram_delivery_requests", {
  id: text("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  companyId: integer("company_id").references(() => companiesTable.id).notNull(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  conversationId: text("conversation_id").references(() => telegramConversationsTable.id),
  artifactType: text("artifact_type").notNull(),
  artifactEntityId: text("artifact_entity_id").notNull(),
  canonicalRoute: text("canonical_route"),
  artifactLabel: text("artifact_label").notNull(),
  channel: text("channel").notNull(),
  recipientIdentities: jsonb("recipient_identities").$type<string[]>().notNull().default([]),
  externalRecipients: jsonb("external_recipients").$type<string[]>().notNull().default([]),
  language: text("language").notNull().default("en"),
  status: text("status").notNull().default("draft"),
  confirmationKey: text("confirmation_key").notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  externalWarningAcknowledged: boolean("external_warning_acknowledged").notNull().default(false),
  externalWarningAcknowledgedAt: timestamp("external_warning_acknowledged_at", { withTimezone: true }),
  externalConfirmedAt: timestamp("external_confirmed_at", { withTimezone: true }),
  providerAcknowledgementState: text("provider_acknowledgement_state"),
  providerReference: text("provider_reference"),
  attemptCount: integer("attempt_count").notNull().default(0),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  failureCategory: text("failure_category"),
  artifactSha256: text("artifact_sha256"),
  artifactSize: integer("artifact_size"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userCreatedIdx: index("telegram_delivery_requests_user_created_idx").on(t.userId, t.createdAt),
  projectCreatedIdx: index("telegram_delivery_requests_project_created_idx").on(t.projectId, t.createdAt),
  confirmationUnique: uniqueIndex("telegram_delivery_requests_confirmation_uidx").on(t.confirmationKey),
  userConfirmationUnique: uniqueIndex("telegram_delivery_requests_user_confirmation_uidx").on(t.userId, t.confirmationKey),
}));

export const telegramDeliveryEventsTable = pgTable("telegram_delivery_events", {
  id: text("id").primaryKey(),
  deliveryId: text("delivery_id").references(() => telegramDeliveryRequestsTable.id).notNull(),
  actorUserId: integer("actor_user_id").references(() => usersTable.id),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  eventType: text("event_type").notNull(),
  reason: text("reason").notNull(),
  safeDetails: jsonb("safe_details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  deliveryIdx: index("telegram_delivery_events_delivery_idx").on(t.deliveryId, t.createdAt),
}));

export const telegramDeliveryAttemptsTable = pgTable("telegram_delivery_attempts", {
  id: text("id").primaryKey(),
  deliveryId: text("delivery_id").references(() => telegramDeliveryRequestsTable.id).notNull(),
  attemptNumber: integer("attempt_number").notNull(),
  channel: text("channel").notNull(),
  state: text("state").notNull().default("persisted"),
  providerReference: text("provider_reference"),
  failureCategory: text("failure_category"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => ({
  deliveryAttemptUnique: uniqueIndex("telegram_delivery_attempts_number_uidx").on(t.deliveryId, t.attemptNumber),
}));

export const telegramDeliveryLinksTable = pgTable("telegram_delivery_links", {
  id: text("id").primaryKey(),
  deliveryId: text("delivery_id").references(() => telegramDeliveryRequestsTable.id).notNull(),
  audienceUserId: integer("audience_user_id").references(() => usersTable.id).notNull(),
  tokenHmac: text("token_hmac").notNull(),
  status: text("status").notNull().default("active"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => ({
  tokenUnique: uniqueIndex("telegram_delivery_links_token_uidx").on(t.tokenHmac),
  deliveryIdx: index("telegram_delivery_links_delivery_idx").on(t.deliveryId),
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
export type TelegramDeliveryRequest = typeof telegramDeliveryRequestsTable.$inferSelect;
export type TelegramDeliveryEvent = typeof telegramDeliveryEventsTable.$inferSelect;
export type TelegramDeliveryAttempt = typeof telegramDeliveryAttemptsTable.$inferSelect;
export type TelegramDeliveryLink = typeof telegramDeliveryLinksTable.$inferSelect;
