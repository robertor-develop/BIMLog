import crypto from "crypto";
import { pool } from "@workspace/db";
import {
  AiControlError,
  cancelRun,
  confirmEstimate,
  createEstimate,
  reserveRun,
  type Actor,
} from "./ai-control-plane";
import { TelegramProviderBrokerError, executeTelegramAssistantBroker } from "./telegram-product-provider-broker";

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 10 * 60 * 1000;
const LINK_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const LINK_RATE_LIMIT_MAX = 5;
const BOT_API_BASE = "https://api.telegram.org";
const CONSENT_PURPOSE = "channel_linking";

export type TelegramLanguage = "en" | "es";
export type TelegramConnectionStatus = "unavailable" | "not_connected" | "pending" | "connected" | "expired" | "blocked" | "revoked";

export interface TelegramProductConfig {
  adapterId: string;
  botUsername: string;
  botToken: string;
  webhookSecret: string;
  consentVersion: string;
  dataKey: string;
  publicBaseUrl: string;
  configured: boolean;
  missing: string[];
}

export interface TelegramStatus {
  configured: boolean;
  connected: boolean;
  status: TelegramConnectionStatus;
  language: TelegramLanguage;
  consentVersion: string;
  consentPurpose: typeof CONSENT_PURPOSE;
  consentAccepted: boolean;
  accountLabel: string | null;
  linkedAt: string | null;
}

export interface TelegramWebhookUpdate {
  update_id?: number | string;
  message?: {
    text?: string;
    chat?: { id?: number | string; type?: string };
    from?: { id?: number | string; username?: string; first_name?: string; last_name?: string };
  };
  my_chat_member?: {
    chat?: { id?: number | string; type?: string };
    from?: { id?: number | string };
    new_chat_member?: { status?: string };
  };
}

interface TelegramReply {
  chatId: string;
  text: string;
  conversationId?: string | null;
  outboundMessageId?: string | null;
}

interface QueryClient {
  query<T = any>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

interface EncryptedWebhookEvidence {
  updateId: string;
  kind: "message" | "my_chat_member" | "unsupported";
  command: string | null;
  argument: string | null;
  chatType: string | null;
  telegramUserId: string | null;
  telegramChatId: string | null;
  memberStatus: string | null;
}

type ConversationMode = "help" | "assistant" | "support";
type FundingSource = "personal" | "company" | "system";

export class TelegramProductError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function getTelegramProductConfig(): TelegramProductConfig {
  const values = {
    adapterId: process.env.TELEGRAM_PRODUCT_ADAPTER_ID || "",
    botUsername: process.env.TELEGRAM_PRODUCT_BOT_USERNAME || "",
    botToken: process.env.TELEGRAM_PRODUCT_BOT_TOKEN || "",
    webhookSecret: process.env.TELEGRAM_PRODUCT_WEBHOOK_SECRET || "",
    consentVersion: process.env.TELEGRAM_PRODUCT_CONSENT_VERSION || "",
    dataKey: process.env.TELEGRAM_PRODUCT_DATA_KEY || "",
    publicBaseUrl: process.env.TELEGRAM_PRODUCT_PUBLIC_BASE_URL || process.env.PUBLIC_BASE_URL || "",
  };
  const missing = Object.entries(values)
    .filter(([, value]) => !String(value).trim())
    .map(([key]) => key === "publicBaseUrl" ? "PUBLIC_BASE_URL" : `TELEGRAM_PRODUCT_${key.replace(/[A-Z]/g, (m) => `_${m}`).toUpperCase()}`);
  return {
    ...values,
    adapterId: values.adapterId.trim(),
    botUsername: values.botUsername.trim().replace(/^@/, ""),
    botToken: values.botToken.trim(),
    webhookSecret: values.webhookSecret.trim(),
    consentVersion: values.consentVersion.trim(),
    dataKey: values.dataKey.trim(),
    publicBaseUrl: values.publicBaseUrl.trim(),
    configured: missing.length === 0,
    missing,
  };
}

export function requireTelegramProductConfig(): TelegramProductConfig {
  const config = getTelegramProductConfig();
  if (!config.configured) {
    throw new TelegramProductError(503, "TELEGRAM_PRODUCT_NOT_CONFIGURED", "Telegram product channel linking is not configured.");
  }
  return config;
}

export function timingSafeEqualText(actual: string | undefined, expected: string): boolean {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function hmacValue(config: Pick<TelegramProductConfig, "dataKey">, value: string): string {
  return crypto.createHmac("sha256", Buffer.from(config.dataKey, "utf8")).update(value).digest("hex");
}

function cipherKey(config: Pick<TelegramProductConfig, "dataKey">): Buffer {
  return crypto.createHash("sha256").update(config.dataKey).digest();
}

export function encryptEvidence(config: Pick<TelegramProductConfig, "dataKey">, value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", cipherKey(config), iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(value), "utf8")), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptEvidence<T = unknown>(config: Pick<TelegramProductConfig, "dataKey">, value: string): T {
  const [version, ivText, tagText, encryptedText] = value.split(":");
  if (version !== "v1" || !ivText || !tagText || !encryptedText) {
    throw new TelegramProductError(500, "INVALID_ENCRYPTED_EVIDENCE", "Encrypted Telegram evidence is invalid.");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", cipherKey(config), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}

export function generateRawLinkToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

function parseLanguage(input: unknown): TelegramLanguage | null {
  if (input === "en" || input === "es") return input;
  return null;
}

function commandParts(text: string): { command: string; argument: string } {
  const [first = "", ...rest] = text.trim().split(/\s+/);
  return {
    command: first.split("@")[0].toLowerCase(),
    argument: rest.join(" ").trim(),
  };
}

function localized(language: TelegramLanguage, key: string): string {
  const messages: Record<TelegramLanguage, Record<string, string>> = {
    en: {
      help: "Your BIMLog Telegram channel is connected. Commands: /settings, /assistant, /support, /language en, /language es, /privacy, /disconnect.",
      settings: "BIMLog Telegram channel connected. Language: English. Use /language es for Spanish or /disconnect to revoke the connection.",
      privacy: "BIMLog stores encrypted Telegram identifiers, hashed identifiers for matching, consent records, and durable update receipts for channel linking. Use /disconnect to revoke.",
      disconnected: "The BIMLog Telegram channel was disconnected and the channel-linking consent was revoked.",
      unknown: "Command not recognized. Use /help for available commands.",
      languageEn: "Language set to English.",
      languageEs: "Idioma cambiado a Español.",
      notConnected: "This Telegram chat is not connected to BIMLog. Open your BIMLog Profile to create a new link.",
      conflict: "This Telegram account is already connected to another BIMLog user. Disconnect it there before linking it here.",
      invalid: "This link is invalid or expired. Open your BIMLog Profile to create a new link.",
    },
    es: {
      help: "Tu canal de Telegram de BIMLog está conectado. Comandos: /settings, /assistant, /support, /language en, /language es, /privacy, /disconnect.",
      settings: "Canal de Telegram de BIMLog conectado. Idioma: Español. Usa /language en para inglés o /disconnect para revocar la conexión.",
      privacy: "Privacidad: BIMLog guarda identificadores de Telegram cifrados, identificadores hash para coincidencia, registros de consentimiento y recibos durables para la conexión del canal. Usa /disconnect para revocar.",
      disconnected: "El canal de Telegram de BIMLog fue desconectado y el consentimiento de conexión del canal fue revocado.",
      unknown: "Comando no reconocido. Usa /help para ver los comandos disponibles.",
      languageEn: "Language set to English.",
      languageEs: "Idioma cambiado a Español.",
      notConnected: "Este chat de Telegram no está conectado a BIMLog. Abre tu perfil de BIMLog para crear un enlace nuevo.",
      conflict: "Esta cuenta de Telegram ya está conectada a otro usuario de BIMLog. Desconéctala allí antes de vincularla aquí.",
      invalid: "Este enlace no es válido o expiró. Abre tu perfil de BIMLog para crear un enlace nuevo.",
    },
  };
  return messages[language][key] || messages.en.unknown;
}

function bilingualStart(): string {
  return [
    "BIMLog channel linking.",
    "Choose language: /language en or /language es.",
    "",
    "Conexión del canal de BIMLog.",
    "Elige idioma: /language en o /language es.",
  ].join("\n");
}

export async function ensureTelegramProductConversationSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS telegram_conversations (
      id text PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id),
      company_id integer NOT NULL REFERENCES companies(id),
      notification_channel_id integer REFERENCES notification_channels(id),
      adapter_id text NOT NULL,
      language text NOT NULL DEFAULT 'en',
      mode text NOT NULL,
      project_id integer REFERENCES projects(id),
      status text NOT NULL DEFAULT 'new',
      ai_funding_source text,
      ai_run_id text REFERENCES ai_runs(id),
      support_case_id text,
      privacy_notice_version text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      closed_at timestamptz,
      last_activity_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT telegram_conversations_language_chk CHECK(language IN ('en','es')),
      CONSTRAINT telegram_conversations_mode_chk CHECK(mode IN ('help','assistant','support')),
      CONSTRAINT telegram_conversations_status_chk CHECK(status IN ('open','pending_confirmation','closed','failed')),
      CONSTRAINT telegram_conversations_funding_chk CHECK(ai_funding_source IS NULL OR ai_funding_source IN ('personal','company','system'))
    );
    CREATE INDEX IF NOT EXISTS telegram_conversations_user_activity_idx ON telegram_conversations(user_id,last_activity_at DESC);
    CREATE INDEX IF NOT EXISTS telegram_conversations_company_activity_idx ON telegram_conversations(company_id,last_activity_at DESC);

    CREATE TABLE IF NOT EXISTS telegram_conversation_messages (
      id text PRIMARY KEY,
      conversation_id text NOT NULL REFERENCES telegram_conversations(id),
      direction text NOT NULL,
      sender_role text NOT NULL,
      telegram_update_id text,
      telegram_message_id text,
      idempotency_key text NOT NULL,
      language text NOT NULL DEFAULT 'en',
      sanitized_text text NOT NULL,
      message_type text NOT NULL DEFAULT 'text',
      processing_state text NOT NULL DEFAULT 'processed',
      delivery_state text NOT NULL DEFAULT 'not_applicable',
      requested_action text,
      delivered_summary text,
      ai_run_id text REFERENCES ai_runs(id),
      error_category text,
      telegram_delivery_message_id text,
      delivered_at timestamptz,
      delivery_attempts integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT telegram_conversation_messages_direction_chk CHECK(direction IN ('inbound','outbound','system')),
      CONSTRAINT telegram_conversation_messages_sender_chk CHECK(sender_role IN ('user','assistant','system','support')),
      CONSTRAINT telegram_conversation_messages_language_chk CHECK(language IN ('en','es')),
      CONSTRAINT telegram_conversation_messages_state_chk CHECK(processing_state IN ('processed','pending_confirmation','cancelled','failed'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS telegram_conversation_messages_idempotency_uidx ON telegram_conversation_messages(conversation_id,idempotency_key);
    CREATE INDEX IF NOT EXISTS telegram_conversation_messages_created_idx ON telegram_conversation_messages(conversation_id,created_at);
    ALTER TABLE telegram_conversation_messages ADD COLUMN IF NOT EXISTS telegram_delivery_message_id text;
    ALTER TABLE telegram_conversation_messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
    ALTER TABLE telegram_conversation_messages ADD COLUMN IF NOT EXISTS delivery_attempts integer NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS telegram_support_cases (
      id text PRIMARY KEY,
      case_number text NOT NULL UNIQUE,
      user_id integer NOT NULL REFERENCES users(id),
      company_id integer NOT NULL REFERENCES companies(id),
      conversation_id text REFERENCES telegram_conversations(id),
      project_id integer REFERENCES projects(id),
      category text NOT NULL,
      subject text NOT NULL,
      description text NOT NULL,
      severity text NOT NULL DEFAULT 'normal',
      status text NOT NULL DEFAULT 'open',
      language text NOT NULL DEFAULT 'en',
      assigned_to_id integer REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      closed_at timestamptz,
      CONSTRAINT telegram_support_cases_status_chk CHECK(status IN ('new','acknowledged','in_progress','waiting_for_user','resolved','closed')),
      CONSTRAINT telegram_support_cases_severity_chk CHECK(severity IN ('low','normal','high','urgent')),
      CONSTRAINT telegram_support_cases_language_chk CHECK(language IN ('en','es'))
    );
    CREATE INDEX IF NOT EXISTS telegram_support_cases_user_idx ON telegram_support_cases(user_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS telegram_support_cases_company_idx ON telegram_support_cases(company_id,status,created_at DESC);
    ALTER TABLE telegram_support_cases DROP CONSTRAINT IF EXISTS telegram_support_cases_status_chk;
    UPDATE telegram_support_cases SET status = CASE status WHEN 'open' THEN 'new' WHEN 'triaged' THEN 'acknowledged' WHEN 'waiting_on_customer' THEN 'waiting_for_user' ELSE status END
    WHERE status IN ('open','triaged','waiting_on_customer');
    ALTER TABLE telegram_support_cases ADD CONSTRAINT telegram_support_cases_status_chk CHECK(status IN ('new','acknowledged','in_progress','waiting_for_user','resolved','closed'));

    CREATE TABLE IF NOT EXISTS telegram_support_case_events (
      id text PRIMARY KEY,
      case_id text NOT NULL REFERENCES telegram_support_cases(id),
      actor_user_id integer REFERENCES users(id),
      action text NOT NULL,
      from_status text,
      to_status text,
      reason text NOT NULL,
      details jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS telegram_support_case_events_case_idx ON telegram_support_case_events(case_id,created_at);
  `);
}

function linkSuccess(): string {
  return [
    "BIMLog Telegram channel connected. Notification delivery is not enabled yet.",
    "Choose language: /language en or /language es.",
    "",
    "Canal de Telegram de BIMLog conectado. La entrega de notificaciones aún no está habilitada.",
    "Elige idioma: /language en o /language es.",
  ].join("\n");
}

async function audit(client: QueryClient, userId: number, email: string, action: string, details: Record<string, unknown>) {
  await client.query(
    `INSERT INTO admin_actions_log (admin_user_id, admin_email, action, target_type, target_id, details)
     VALUES ($1, $2, $3, 'telegram_product', $4, $5::jsonb)`,
    [userId, email, action, String(userId), JSON.stringify(details)],
  );
}

export async function getTelegramStatus(userId: number): Promise<TelegramStatus> {
  const config = getTelegramProductConfig();
  if (!config.configured) {
    return {
      configured: false,
      connected: false,
      status: "unavailable",
      language: "en",
      consentVersion: config.consentVersion || "unconfigured",
      consentPurpose: CONSENT_PURPOSE,
      consentAccepted: false,
      accountLabel: null,
      linkedAt: null,
    };
  }
  const { rows } = await pool.query<{
    channel_status: TelegramConnectionStatus | null;
    account_label: string | null;
    linked_at: Date | null;
    language: TelegramLanguage | null;
    consent_version: string | null;
    consent_status: string | null;
    pending_count: string;
    expired_count: string;
    revoked_count: string;
  }>(
    `SELECT nc.status AS channel_status, nc.account_label, nc.linked_at, np.language,
       cr.consent_version, cr.status AS consent_status,
       (SELECT count(*)::text FROM channel_linking_tokens WHERE user_id = u.id AND adapter_id = $2 AND status = 'pending' AND expires_at > now()) AS pending_count,
       (SELECT count(*)::text FROM channel_linking_tokens WHERE user_id = u.id AND adapter_id = $2 AND status = 'pending' AND expires_at <= now()) AS expired_count,
       (SELECT count(*)::text FROM notification_channels WHERE user_id = u.id AND adapter_id = $2 AND status = 'revoked') AS revoked_count
     FROM users u
     LEFT JOIN notification_channels nc ON nc.id = (
       SELECT id FROM notification_channels
       WHERE user_id = u.id AND adapter_id = $2
       ORDER BY CASE status WHEN 'connected' THEN 0 WHEN 'blocked' THEN 1 WHEN 'unavailable' THEN 2 WHEN 'revoked' THEN 3 ELSE 4 END, updated_at DESC, id DESC
       LIMIT 1
     )
     LEFT JOIN notification_preferences np ON np.user_id = u.id AND np.adapter_id = $2 AND np.channel = 'telegram'
     LEFT JOIN LATERAL (
       SELECT consent_version, status
       FROM consent_records
       WHERE user_id = u.id AND adapter_id = $2 AND channel = 'telegram' AND purpose = $3
       ORDER BY created_at DESC, id DESC
       LIMIT 1
     ) cr ON true
     WHERE u.id = $1`,
    [userId, config.adapterId, CONSENT_PURPOSE],
  );
  const row = rows[0];
  const channelStatus = row?.channel_status;
  const status: TelegramConnectionStatus =
    channelStatus === "connected" ? "connected" :
    channelStatus === "blocked" ? "blocked" :
    channelStatus === "unavailable" ? "unavailable" :
    Number(row?.pending_count || 0) > 0 ? "pending" :
    Number(row?.expired_count || 0) > 0 ? "expired" :
    channelStatus === "revoked" || Number(row?.revoked_count || 0) > 0 ? "revoked" :
    "not_connected";
  return {
    configured: true,
    connected: status === "connected",
    status,
    language: row?.language === "es" ? "es" : "en",
    consentVersion: config.consentVersion,
    consentPurpose: CONSENT_PURPOSE,
    consentAccepted: row?.consent_version === config.consentVersion && row?.consent_status === "granted",
    accountLabel: status === "connected" ? row?.account_label ?? null : null,
    linkedAt: status === "connected" && row?.linked_at ? row.linked_at.toISOString() : null,
  };
}

function assertLinkConsent(config: TelegramProductConfig, body: { consentAccepted?: unknown; consentVersion?: unknown; purpose?: unknown }) {
  if (body.consentAccepted !== true || body.consentVersion !== config.consentVersion || body.purpose !== CONSENT_PURPOSE) {
    throw new TelegramProductError(400, "TELEGRAM_CONSENT_REQUIRED", "Current channel-linking consent must be accepted before creating a Telegram link.");
  }
}

export async function createTelegramLink(
  userId: number,
  email: string,
  consent: { consentAccepted?: unknown; consentVersion?: unknown; purpose?: unknown },
): Promise<{ url: string; expiresAt: string; ttlSeconds: number; consentVersion: string; purpose: typeof CONSENT_PURPOSE }> {
  const config = requireTelegramProductConfig();
  assertLinkConsent(config, consent);
  const rawToken = generateRawLinkToken();
  const tokenHmac = hmacValue(config, rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  const windowStart = new Date(Date.now() - LINK_RATE_LIMIT_WINDOW_MS);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query(
      `SELECT u.id, u.email
       FROM users u
       INNER JOIN companies c ON c.id = u.company_id
       WHERE u.id = $1
       FOR UPDATE`,
      [userId],
    );
    if (user.rowCount !== 1) {
      throw new TelegramProductError(403, "USER_NOT_ACTIVE", "The current user cannot create a Telegram link.");
    }
    const recent = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n
       FROM channel_linking_tokens
       WHERE user_id = $1 AND adapter_id = $2 AND created_at >= $3`,
      [userId, config.adapterId, windowStart],
    );
    if (Number(recent.rows[0]?.n || 0) >= LINK_RATE_LIMIT_MAX) {
      throw new TelegramProductError(429, "TELEGRAM_LINK_RATE_LIMITED", "Too many Telegram link attempts. Try again later.");
    }
    await client.query(
      `INSERT INTO channel_linking_tokens (user_id, adapter_id, token_hmac, status, expires_at, consent_version, consent_purpose)
       VALUES ($1, $2, $3, 'pending', $4, $5, $6)`,
      [userId, config.adapterId, tokenHmac, expiresAt, config.consentVersion, CONSENT_PURPOSE],
    );
    await client.query(
      `INSERT INTO consent_records (user_id, adapter_id, channel, consent_version, status, purpose, source)
       VALUES ($1, $2, 'telegram', $3, 'granted', $4, 'browser_link_request')`,
      [userId, config.adapterId, config.consentVersion, CONSENT_PURPOSE],
    );
    await audit(client, userId, email, "telegram_link_token_created", {
      adapterId: config.adapterId,
      expiresAt: expiresAt.toISOString(),
      consentVersion: config.consentVersion,
      purpose: CONSENT_PURPOSE,
    });
    await client.query("COMMIT");
    return {
      url: `https://t.me/${encodeURIComponent(config.botUsername)}?start=${encodeURIComponent(rawToken)}`,
      expiresAt: expiresAt.toISOString(),
      ttlSeconds: TOKEN_TTL_MS / 1000,
      consentVersion: config.consentVersion,
      purpose: CONSENT_PURPOSE,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function setTelegramLanguage(userId: number, email: string, languageInput: unknown): Promise<TelegramStatus> {
  const config = requireTelegramProductConfig();
  const language = parseLanguage(languageInput);
  if (!language) throw new TelegramProductError(400, "INVALID_LANGUAGE", "Language must be en or es.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO notification_preferences (user_id, adapter_id, channel, enabled, language, topics, updated_at)
       VALUES ($1, $2, 'telegram', 'false', $3, '{}'::jsonb, now())
       ON CONFLICT (user_id, adapter_id, channel)
       DO UPDATE SET language = EXCLUDED.language, updated_at = now()`,
      [userId, config.adapterId, language],
    );
    await audit(client, userId, email, "telegram_language_updated", { adapterId: config.adapterId, language });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return getTelegramStatus(userId);
}

export async function revokeTelegramConnectionTx(client: QueryClient, config: TelegramProductConfig, userId: number, email: string, source: string, language: TelegramLanguage = "en"): Promise<TelegramReply | null> {
  const channels = await client.query<{ encrypted_telegram_chat_id: string | null }>(
    `SELECT encrypted_telegram_chat_id
     FROM notification_channels
     WHERE user_id = $1 AND adapter_id = $2 AND status = 'connected'
     FOR UPDATE`,
    [userId, config.adapterId],
  );
  await client.query(
    `UPDATE notification_channels
     SET status = 'revoked', revoked_at = now(), updated_at = now()
     WHERE user_id = $1 AND adapter_id = $2 AND status IN ('connected', 'blocked', 'unavailable')`,
    [userId, config.adapterId],
  );
  await client.query(
    `UPDATE channel_linking_tokens
     SET status = 'revoked', revoked_at = now()
     WHERE user_id = $1 AND adapter_id = $2 AND status = 'pending'`,
    [userId, config.adapterId],
  );
  await client.query(
    `INSERT INTO notification_preferences (user_id, adapter_id, channel, enabled, language, topics, updated_at)
     VALUES ($1, $2, 'telegram', 'false', $3, '{}'::jsonb, now())
     ON CONFLICT (user_id, adapter_id, channel)
     DO UPDATE SET enabled = 'false', topics = '{}'::jsonb, updated_at = now()`,
    [userId, config.adapterId, language],
  );
  await client.query(
    `INSERT INTO consent_records (user_id, adapter_id, channel, consent_version, status, purpose, source)
     VALUES ($1, $2, 'telegram', $3, 'revoked', $4, $5)`,
    [userId, config.adapterId, config.consentVersion, CONSENT_PURPOSE, source],
  );
  await audit(client, userId, email, "telegram_disconnected", { adapterId: config.adapterId, source, purpose: CONSENT_PURPOSE });
  const encryptedChat = channels.rows[0]?.encrypted_telegram_chat_id;
  if (!encryptedChat) return null;
  const chat = decryptEvidence<{ telegramChatId: string }>(config, encryptedChat);
  return { chatId: chat.telegramChatId, text: localized(language, "disconnected") };
}

export async function disconnectTelegram(userId: number, email: string, source = "browser"): Promise<TelegramStatus> {
  const config = requireTelegramProductConfig();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await revokeTelegramConnectionTx(client, config, userId, email, source);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return getTelegramStatus(userId);
}

async function languageForTelegramUser(client: QueryClient, config: TelegramProductConfig, telegramUserHash: string): Promise<{ language: TelegramLanguage; userId: number | null; email: string | null; status: string | null }> {
  const result = await client.query<{ user_id: number; email: string; language: TelegramLanguage | null; status: string }>(
    `SELECT nc.user_id, u.email, np.language, nc.status
     FROM notification_channels nc
     INNER JOIN users u ON u.id = nc.user_id
     LEFT JOIN notification_preferences np ON np.user_id = nc.user_id AND np.adapter_id = nc.adapter_id AND np.channel = 'telegram'
     WHERE nc.adapter_id = $1 AND nc.telegram_user_hash = $2 AND nc.status = 'connected'
     LIMIT 1`,
    [config.adapterId, telegramUserHash],
  );
  const row = result.rows[0];
  return { language: row?.language === "es" ? "es" : "en", userId: row?.user_id ?? null, email: row?.email ?? null, status: row?.status ?? null };
}

async function connectedTelegramAccount(client: QueryClient, config: TelegramProductConfig, telegramUserHash: string): Promise<{ language: TelegramLanguage; userId: number | null; companyId: number | null; email: string | null; status: string | null; channelId: number | null; isSuperAdmin: boolean; isCompanyAdmin: boolean }> {
  const result = await client.query<{
    user_id: number;
    company_id: number;
    email: string;
    language: TelegramLanguage | null;
    status: string;
    channel_id: number;
    is_super_admin: boolean | null;
    is_company_admin: boolean | null;
  }>(
    `SELECT nc.id AS channel_id, nc.user_id, u.company_id, u.email, u.is_super_admin, np.language, nc.status,
       EXISTS(SELECT 1 FROM company_ai_administrators ca WHERE ca.user_id=u.id AND ca.company_id=u.company_id AND ca.status='active') AS is_company_admin
     FROM notification_channels nc
     INNER JOIN users u ON u.id = nc.user_id
     LEFT JOIN notification_preferences np ON np.user_id = nc.user_id AND np.adapter_id = nc.adapter_id AND np.channel = 'telegram'
     WHERE nc.adapter_id = $1 AND nc.telegram_user_hash = $2 AND nc.status = 'connected'
     LIMIT 1`,
    [config.adapterId, telegramUserHash],
  );
  const row = result.rows[0];
  return {
    language: row?.language === "es" ? "es" : "en",
    userId: row?.user_id ?? null,
    companyId: row?.company_id ?? null,
    email: row?.email ?? null,
    status: row?.status ?? null,
    channelId: row?.channel_id ?? null,
    isSuperAdmin: row?.is_super_admin === true,
    isCompanyAdmin: row?.is_company_admin === true,
  };
}

function sanitizeTelegramText(value: string | null | undefined): string {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 1800);
}

function assistantIntro(language: TelegramLanguage): string {
  return language === "es"
    ? "Modo asistente de BIMLog. No leo archivos ni cambio proyectos desde Telegram. Para usar IA escribe: /assistant personal tu pregunta, /assistant company tu pregunta, o /assistant system tu pregunta. Te mostraré costo y pediré confirmación antes de reservar créditos."
    : "BIMLog assistant mode. I do not read files or change projects from Telegram. To use AI, send: /assistant personal your question, /assistant company your question, or /assistant system your question. I will show cost and ask for confirmation before reserving credits.";
}

function supportIntro(language: TelegramLanguage): string {
  return language === "es"
    ? "Soporte de BIMLog. Para abrir un caso escribe: /support categoría | asunto | descripción | prioridad. Ejemplo: /support Cuenta | No puedo entrar | Mi enlace no funciona | high"
    : "BIMLog support. To open a case, send: /support category | subject | description | severity. Example: /support Account | Cannot sign in | My link does not work | high";
}

const SUPPORT_CATEGORIES = new Set(["account_access", "platform_behavior", "telegram_assistant", "billing_ai_usage", "navisworks_plugin", "report_export", "other"]);
const SUPPORT_SEVERITIES = new Set(["low", "normal", "high", "urgent"]);

function supportCategoryLabels(language: TelegramLanguage): string {
  return language === "es"
    ? "Categorías: account_access (Cuenta), platform_behavior (Plataforma), telegram_assistant (Asistente Telegram), billing_ai_usage (Facturación IA), navisworks_plugin (Navisworks), report_export (Reportes), other (Otro)."
    : "Categories: account_access, platform_behavior, telegram_assistant, billing_ai_usage, navisworks_plugin, report_export, other.";
}

function parseSupportDraft(argument: string): { category: string; subject: string; description: string; severity: string } | null {
  const parts = String(argument || "").split("|").map((p) => sanitizeTelegramText(p));
  if (parts.length < 4) return null;
  const category = parts[0].toLowerCase();
  const severity = parts[3].toLowerCase();
  if (!SUPPORT_CATEGORIES.has(category) || !parts[1] || parts[1].length < 4 || !parts[2] || parts[2].length < 8 || !SUPPORT_SEVERITIES.has(severity)) return null;
  return { category, subject: parts[1], description: parts[2], severity };
}

function productMenu(language: TelegramLanguage, isSuperAdmin: boolean): string {
  const ordinary = language === "es"
    ? [
        "Menu de BIMLog:",
        "/help - Ayuda de BIMLog",
        "/assistant - Asistente BIMLog",
        "/support - Soporte",
        "/conversations - Mis Conversaciones",
        "/support_cases - Mis Casos de Soporte",
        "/ai_usage - Uso de IA",
        "/language en|es - Idioma",
        "/settings - Vinculación de Cuenta",
        "/privacy - Privacidad",
      ]
    : [
        "BIMLog menu:",
        "/help - BIMLog Help",
        "/assistant - BIMLog Assistant",
        "/support - Support",
        "/conversations - My Conversations",
        "/support_cases - My Support Cases",
        "/ai_usage - AI Usage",
        "/language en|es - Language",
        "/settings - Account Link",
        "/privacy - Privacy",
      ];
  const admin = language === "es"
    ? ["/admin_support_queue - Cola de Soporte", "/admin_conversation_audit - Auditoría de Conversaciones", "/admin_ai_usage - Supervisión de Uso de IA", "/admin_failed_deliveries - Entregas Fallidas"]
    : ["/admin_support_queue - Support Queue", "/admin_conversation_audit - Conversation Audit", "/admin_ai_usage - AI Usage Oversight", "/admin_failed_deliveries - Failed Deliveries"];
  return [...ordinary, ...(isSuperAdmin ? ["", ...(language === "es" ? ["Opciones de superadministrador:"] : ["Super-admin options:"]), ...admin] : [])].join("\n");
}

async function handleHelpCommand(client: QueryClient, config: TelegramProductConfig, account: Awaited<ReturnType<typeof connectedTelegramAccount>>, evidence: EncryptedWebhookEvidence): Promise<TelegramReply> {
  const language = account.language;
  if (!account.userId || !account.companyId) return { chatId: evidence.telegramChatId!, text: localized(language, "notConnected") };
  const conversationId = await openConversation(client, { userId: account.userId, companyId: account.companyId, channelId: account.channelId, adapterId: config.adapterId, language, mode: "help", status: "closed", privacyNoticeVersion: config.consentVersion });
  await recordConversationMessage(client, { conversationId, direction: "inbound", role: "user", updateId: evidence.updateId, key: `help-in:${evidence.updateId}`, language, text: evidence.command || "/help", requestedAction: "help_menu" });
  const text = productMenu(language, account.isSuperAdmin);
  const outboundMessageId = await recordConversationMessage(client, { conversationId, direction: "outbound", role: "assistant", key: `help-out:${evidence.updateId}`, language, text, deliveryState: "pending", requestedAction: "help_menu", summary: "BIMLog product menu" });
  return { chatId: evidence.telegramChatId!, text, conversationId, outboundMessageId };
}

function parseFunding(argument: string): { source: FundingSource; prompt: string } | null {
  const trimmed = sanitizeTelegramText(argument);
  const match = /^(personal|company|system)\s+(.+)/i.exec(trimmed);
  if (!match) return null;
  return { source: match[1].toLowerCase() as FundingSource, prompt: match[2].trim() };
}

async function openConversation(client: QueryClient, input: { userId: number; companyId: number; channelId: number | null; adapterId: string; language: TelegramLanguage; mode: ConversationMode; status?: string; funding?: FundingSource | null; aiRunId?: string | null; privacyNoticeVersion?: string }): Promise<string> {
  const id = crypto.randomUUID();
  await client.query(
    `INSERT INTO telegram_conversations(id,user_id,company_id,notification_channel_id,adapter_id,language,mode,status,ai_funding_source,ai_run_id,privacy_notice_version)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, input.userId, input.companyId, input.channelId, input.adapterId, input.language, input.mode, input.status || "open", input.funding || null, input.aiRunId || null, input.privacyNoticeVersion || ""],
  );
  return id;
}

async function recordConversationMessage(client: QueryClient, input: { conversationId: string; direction: "inbound" | "outbound" | "system"; role: "user" | "assistant" | "system" | "support"; updateId?: string | null; key: string; language: TelegramLanguage; text: string; state?: string; deliveryState?: "pending" | "delivered" | "failed" | "not_applicable"; requestedAction?: string | null; summary?: string | null; aiRunId?: string | null; error?: string | null }): Promise<string | null> {
  const id = crypto.randomUUID();
  const result = await client.query<{ id: string }>(
    `INSERT INTO telegram_conversation_messages(id,conversation_id,direction,sender_role,telegram_update_id,idempotency_key,language,sanitized_text,processing_state,delivery_state,requested_action,delivered_summary,ai_run_id,error_category)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (conversation_id,idempotency_key) DO NOTHING
     RETURNING id`,
    [id, input.conversationId, input.direction, input.role, input.updateId || null, input.key, input.language, sanitizeTelegramText(input.text), input.state || "processed", input.deliveryState || (input.direction === "outbound" ? "pending" : "not_applicable"), input.requestedAction || null, input.summary || null, input.aiRunId || null, input.error || null],
  );
  await client.query(`UPDATE telegram_conversations SET updated_at=now(), last_activity_at=now() WHERE id=$1`, [input.conversationId]);
  return result.rows[0]?.id || null;
}

async function latestPendingAssistantConversation(client: QueryClient, userId: number, conversationId: string) {
  const { rows } = await client.query<any>(
    `SELECT c.*, r.estimate_fingerprint, r.context_manifest_hash
     FROM telegram_conversations c
     LEFT JOIN ai_runs r ON r.id=c.ai_run_id
     WHERE c.id=$1 AND c.user_id=$2 AND c.mode='assistant' AND c.status='pending_confirmation'
     LIMIT 1`,
    [conversationId, userId],
  );
  return rows[0] || null;
}

async function latestOpenAssistantConversation(client: QueryClient, account: Awaited<ReturnType<typeof connectedTelegramAccount>>) {
  const { rows } = await client.query<any>(
    `SELECT c.*, r.provider, r.model, r.credit_owner_type, r.connection_id
     FROM telegram_conversations c
     JOIN ai_runs r ON r.id=c.ai_run_id
     WHERE c.user_id=$1 AND c.company_id=$2 AND c.notification_channel_id=$3 AND c.mode='assistant' AND c.status='open'
     ORDER BY c.last_activity_at DESC, c.created_at DESC
     LIMIT 1`,
    [account.userId, account.companyId, account.channelId],
  );
  return rows[0] || null;
}

async function assistantBrokerContext(client: QueryClient, conversationId: string, language: TelegramLanguage): Promise<Array<{ role: "system" | "user" | "assistant"; content: string }>> {
  const rows = await client.query<{ sender_role: string; sanitized_text: string }>(
    `SELECT sender_role,sanitized_text
     FROM telegram_conversation_messages
     WHERE conversation_id=$1 AND sender_role IN ('user','assistant')
     ORDER BY created_at DESC
     LIMIT 8`,
    [conversationId],
  );
  const ordered = rows.rows.reverse().map((row) => ({
    role: row.sender_role === "assistant" ? "assistant" as const : "user" as const,
    content: sanitizeTelegramText(row.sanitized_text).slice(0, 1800),
  })).filter((row) => row.content);
  return [
    {
      role: "system",
      content: language === "es"
        ? "Eres el asistente de BIMLog en Telegram. Responde de forma concisa. No leas archivos, no envies emails, no generes reportes y no modifiques proyectos."
        : "You are the BIMLog Telegram assistant. Answer concisely. Do not read files, send emails, generate reports, or modify projects.",
    },
    ...ordered,
  ];
}

async function selectedConnectionForFunding(client: QueryClient, actor: Actor, funding: FundingSource): Promise<{ id: string; provider: string; model: string; label: string; owner_type: string } | null> {
  const { rows } = await client.query<any>(
    `SELECT id, provider, label, owner_type, allowed_models
     FROM provider_connections
     WHERE status='active'
       AND (
         ($1='personal' AND owner_type='personal' AND user_id=$2)
         OR ($1='company' AND owner_type='company' AND company_id=$3)
         OR ($1='system' AND owner_type='system' AND $4::boolean)
       )
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
    [funding, actor.userId, actor.companyId, actor.isSuperAdmin],
  );
  const row = rows[0];
  if (!row) return null;
  const models = Array.isArray(row.allowed_models) ? row.allowed_models : [];
  return { id: row.id, provider: row.provider, model: String(models[0] || "test-model"), label: row.label, owner_type: row.owner_type };
}

async function handleAssistantCommand(client: QueryClient, config: TelegramProductConfig, account: Awaited<ReturnType<typeof connectedTelegramAccount>>, evidence: EncryptedWebhookEvidence): Promise<TelegramReply> {
  const language = account.language;
  if (!account.userId || !account.companyId) return { chatId: evidence.telegramChatId!, text: localized(language, "notConnected") };
  const parsed = parseFunding(evidence.argument || "");
  if (!parsed) return { chatId: evidence.telegramChatId!, text: assistantIntro(language) };
  const actor: Actor = { userId: account.userId, companyId: account.companyId, isSuperAdmin: account.isSuperAdmin, isCompanyAdmin: account.isCompanyAdmin };
  const connection = await selectedConnectionForFunding(client, actor, parsed.source);
  if (!connection) {
    const text = language === "es"
      ? `No hay una conexión de IA activa para ${parsed.source}. Configura proveedor, precios, derechos y presupuesto en el panel de IA antes de usar Telegram.`
      : `No active AI connection is available for ${parsed.source}. Configure provider, pricing, entitlement, and budget in the AI panel before using Telegram.`;
    const conversationId = await openConversation(client, { userId: account.userId, companyId: account.companyId, channelId: account.channelId, adapterId: config.adapterId, language, mode: "assistant", status: "failed", funding: parsed.source, privacyNoticeVersion: config.consentVersion });
    await recordConversationMessage(client, { conversationId, direction: "inbound", role: "user", updateId: evidence.updateId, key: `update:${evidence.updateId}`, language, text: parsed.prompt, state: "failed", requestedAction: "assistant_estimate", error: "CONNECTION_UNAVAILABLE" });
    return { chatId: evidence.telegramChatId!, text };
  }
  try {
    const estimate = await createEstimate(actor, {
      capability: "assistant",
      purpose: "Telegram bilingual assistant",
      provider: connection.provider,
      model: connection.model,
      connectionId: connection.id,
      creditOwnerType: parsed.source,
      sessionId: `telegram:${config.adapterId}:${account.userId}`,
      contextManifestHash: hmacValue(config, `telegram-assistant:${account.userId}:${sanitizeTelegramText(parsed.prompt)}`),
      contextCategories: ["telegram_conversation", "user_prompt"],
      inputTokenMin: 1,
      inputTokenMax: 800,
      outputTokenMax: 400,
      filesWillBeTransmitted: false,
      idempotencyKey: `telegram-assistant-estimate:${evidence.updateId}`,
    });
    const conversationId = await openConversation(client, { userId: account.userId, companyId: account.companyId, channelId: account.channelId, adapterId: config.adapterId, language, mode: "assistant", status: "pending_confirmation", funding: parsed.source, aiRunId: estimate.id, privacyNoticeVersion: config.consentVersion });
    await recordConversationMessage(client, { conversationId, direction: "inbound", role: "user", updateId: evidence.updateId, key: `update:${evidence.updateId}`, language, text: parsed.prompt, state: "pending_confirmation", requestedAction: "assistant_estimate", aiRunId: estimate.id });
    const warning = parsed.source === "personal"
      ? (language === "es" ? "Se usarán tus créditos personales/BYO." : "This will use your personal/BYO AI credits.")
      : parsed.source === "company"
        ? (language === "es" ? "Se usarán créditos de IA de la compañía si tienes asignación." : "This will use company AI credits if you have allocation.")
        : (language === "es" ? "Se usarán créditos de plataforma/sistema; solo superadministradores pueden confirmar." : "This will use platform/system AI credits; only super admins can confirm.");
    const text = language === "es"
      ? `${warning}\nEstimado: ${estimate.currency} ${estimate.estimated_min_micros}-${estimate.estimated_max_micros} micros.\nPara confirmar: /confirm_ai ${conversationId}\nPara cancelar: /cancel_ai ${conversationId}`
      : `${warning}\nEstimate: ${estimate.currency} ${estimate.estimated_min_micros}-${estimate.estimated_max_micros} micros.\nTo confirm: /confirm_ai ${conversationId}\nTo cancel: /cancel_ai ${conversationId}`;
    const outboundMessageId = await recordConversationMessage(client, { conversationId, direction: "outbound", role: "assistant", key: `estimate-reply:${estimate.id}`, language, text, state: "pending_confirmation", deliveryState: "pending", requestedAction: "assistant_confirmation", aiRunId: estimate.id });
    return { chatId: evidence.telegramChatId!, text, conversationId, outboundMessageId };
  } catch (error) {
    const code = error instanceof AiControlError ? error.code : "AI_ESTIMATE_FAILED";
    const text = language === "es" ? `No se pudo preparar la estimación de IA: ${code}.` : `Could not prepare the AI estimate: ${code}.`;
    return { chatId: evidence.telegramChatId!, text };
  }
}

async function handleContinueAi(client: QueryClient, config: TelegramProductConfig, account: Awaited<ReturnType<typeof connectedTelegramAccount>>, evidence: EncryptedWebhookEvidence): Promise<TelegramReply> {
  const language = account.language;
  if (!account.userId || !account.companyId) return { chatId: evidence.telegramChatId!, text: localized(language, "notConnected") };
  const prompt = sanitizeTelegramText(evidence.argument || "");
  if (!prompt) return { chatId: evidence.telegramChatId!, text: language === "es" ? "Escribe /continue_ai seguido de tu nueva pregunta." : "Send /continue_ai followed by your new question." };
  const open = await latestOpenAssistantConversation(client, account);
  if (!open?.ai_run_id) return { chatId: evidence.telegramChatId!, text: language === "es" ? "No hay una conversación de asistente abierta." : "There is no open assistant conversation." };
  if (open.language !== language) return { chatId: evidence.telegramChatId!, text: language === "es" ? "El idioma cambió. Inicia una nueva conversación para cambiar idioma." : "Language changed. Start a new conversation to change language." };
  const actor: Actor = { userId: account.userId, companyId: account.companyId, isSuperAdmin: account.isSuperAdmin, isCompanyAdmin: account.isCompanyAdmin };
  try {
    const estimate = await createEstimate(actor, {
      capability: "assistant",
      purpose: "Telegram bilingual assistant continuation",
      provider: open.provider,
      model: open.model,
      connectionId: open.connection_id,
      creditOwnerType: open.credit_owner_type,
      sessionId: `telegram:${config.adapterId}:${account.userId}:${open.id}`,
      contextManifestHash: hmacValue(config, `telegram-assistant-continue:${open.id}:${prompt}`),
      contextCategories: ["telegram_conversation", "user_prompt", "prior_messages"],
      inputTokenMin: 1,
      inputTokenMax: 800,
      outputTokenMax: 400,
      filesWillBeTransmitted: false,
      idempotencyKey: `telegram-assistant-continue:${evidence.updateId}`,
    });
    await client.query(`UPDATE telegram_conversations SET status='pending_confirmation', ai_run_id=$2, ai_funding_source=$3, updated_at=now(), last_activity_at=now() WHERE id=$1`, [open.id, estimate.id, open.credit_owner_type]);
    await recordConversationMessage(client, { conversationId: open.id, direction: "inbound", role: "user", updateId: evidence.updateId, key: `continue:${evidence.updateId}`, language, text: prompt, state: "pending_confirmation", requestedAction: "assistant_continue_estimate", aiRunId: estimate.id });
    const warning = open.credit_owner_type === "personal"
      ? (language === "es" ? "Se usarán tus créditos personales/BYO." : "This will use your personal/BYO AI credits.")
      : open.credit_owner_type === "company"
        ? (language === "es" ? "Se usarán créditos de IA de la compañía si tienes asignación." : "This will use company AI credits if you have allocation.")
        : (language === "es" ? "Se usarán créditos de plataforma/sistema; solo superadministradores pueden confirmar." : "This will use platform/system AI credits; only super admins can confirm.");
    const text = language === "es"
      ? `${warning}\nEstimado: ${estimate.currency} ${estimate.estimated_min_micros}-${estimate.estimated_max_micros} micros.\nPara confirmar: /confirm_ai ${open.id}\nPara cancelar: /cancel_ai ${open.id}`
      : `${warning}\nEstimate: ${estimate.currency} ${estimate.estimated_min_micros}-${estimate.estimated_max_micros} micros.\nTo confirm: /confirm_ai ${open.id}\nTo cancel: /cancel_ai ${open.id}`;
    const outboundMessageId = await recordConversationMessage(client, { conversationId: open.id, direction: "outbound", role: "assistant", key: `continue-estimate:${estimate.id}`, language, text, state: "pending_confirmation", deliveryState: "pending", requestedAction: "assistant_continue_confirmation", aiRunId: estimate.id });
    return { chatId: evidence.telegramChatId!, text, conversationId: open.id, outboundMessageId };
  } catch (error) {
    const code = error instanceof AiControlError ? error.code : "AI_ESTIMATE_FAILED";
    return { chatId: evidence.telegramChatId!, text: language === "es" ? `No se pudo continuar la IA: ${code}.` : `Could not continue AI: ${code}.` };
  }
}

async function handleCloseConversation(client: QueryClient, account: Awaited<ReturnType<typeof connectedTelegramAccount>>, evidence: EncryptedWebhookEvidence): Promise<TelegramReply> {
  const language = account.language;
  if (!account.userId || !account.companyId) return { chatId: evidence.telegramChatId!, text: localized(language, "notConnected") };
  const open = await latestOpenAssistantConversation(client, account);
  if (!open?.id) return { chatId: evidence.telegramChatId!, text: language === "es" ? "No hay una conversación abierta." : "There is no open conversation." };
  await client.query(`UPDATE telegram_conversations SET status='closed', closed_at=now(), updated_at=now() WHERE id=$1 AND user_id=$2`, [open.id, account.userId]);
  await recordConversationMessage(client, { conversationId: open.id, direction: "system", role: "system", updateId: evidence.updateId, key: `close:${evidence.updateId}`, language, text: "closed", requestedAction: "assistant_conversation_closed" });
  return { chatId: evidence.telegramChatId!, text: language === "es" ? "Conversación cerrada." : "Conversation closed." };
}

async function handleConfirmAi(client: QueryClient, account: Awaited<ReturnType<typeof connectedTelegramAccount>>, evidence: EncryptedWebhookEvidence, cancelOnly = false): Promise<TelegramReply> {
  const language = account.language;
  if (!account.userId || !account.companyId) return { chatId: evidence.telegramChatId!, text: localized(language, "notConnected") };
  const conversationId = sanitizeTelegramText(evidence.argument || "");
  const pending = await latestPendingAssistantConversation(client, account.userId, conversationId);
  if (!pending?.ai_run_id) {
    return { chatId: evidence.telegramChatId!, text: language === "es" ? "No encontré una conversación de IA pendiente para confirmar o cancelar." : "I could not find a pending AI conversation to confirm or cancel." };
  }
  const actor: Actor = { userId: account.userId, companyId: account.companyId, isSuperAdmin: account.isSuperAdmin, isCompanyAdmin: account.isCompanyAdmin };
  if (cancelOnly) {
    try {
      await cancelRun(actor, pending.ai_run_id);
    } catch (error) {
      if (!(error instanceof AiControlError) || error.code !== "RUN_NOT_RESERVED") throw error;
      await pool.query(
        `UPDATE ai_runs SET status='cancelled', updated_at=now()
         WHERE id=$1 AND user_id=$2 AND status IN ('estimated','confirmed','file_confirmed')`,
        [pending.ai_run_id, actor.userId],
      );
    }
    await client.query(`UPDATE telegram_conversations SET status='closed', closed_at=now(), updated_at=now() WHERE id=$1`, [conversationId]);
    await recordConversationMessage(client, { conversationId, direction: "system", role: "system", updateId: evidence.updateId, key: `cancel:${evidence.updateId}`, language, text: "cancelled", state: "cancelled", aiRunId: pending.ai_run_id });
    return { chatId: evidence.telegramChatId!, text: language === "es" ? "Solicitud de IA cancelada. No se llamó al proveedor y no se cobraron créditos." : "AI request cancelled. No provider was called and no credits were charged." };
  }
  try {
    const confirmationId = `telegram-confirm:${evidence.updateId}`;
    const confirmed = await confirmEstimate(actor, pending.ai_run_id, { confirmationId, estimateFingerprint: pending.estimate_fingerprint, contextManifestHash: pending.context_manifest_hash, fileManifestHash: null });
    const reserved = await reserveRun(actor, pending.ai_run_id, { confirmationId, estimateFingerprint: confirmed.estimate_fingerprint, contextManifestHash: confirmed.context_manifest_hash, fileManifestHash: null });
    const context = await assistantBrokerContext(client, conversationId, language);
    const result = await executeTelegramAssistantBroker(actor, pending.ai_run_id, context);
    await client.query(`UPDATE telegram_conversations SET status='open', updated_at=now() WHERE id=$1`, [conversationId]);
    const outboundMessageId = await recordConversationMessage(client, { conversationId, direction: "outbound", role: "assistant", updateId: evidence.updateId, key: `answer:${reserved.id}`, language, text: result.text, deliveryState: "pending", aiRunId: pending.ai_run_id, summary: "provider assistant response" });
    return { chatId: evidence.telegramChatId!, text: result.text, conversationId, outboundMessageId };
  } catch (error) {
    const code = error instanceof TelegramProviderBrokerError ? error.code : error instanceof AiControlError ? error.code : "AI_CONFIRM_FAILED";
    await recordConversationMessage(client, { conversationId, direction: "system", role: "system", updateId: evidence.updateId, key: `confirm-error:${evidence.updateId}`, language, text: code, state: "failed", aiRunId: pending.ai_run_id, error: code });
    return { chatId: evidence.telegramChatId!, text: language === "es" ? `No se pudo confirmar la IA: ${code}.` : `Could not confirm AI: ${code}.` };
  }
}

async function handleSupportCommand(client: QueryClient, config: TelegramProductConfig, account: Awaited<ReturnType<typeof connectedTelegramAccount>>, evidence: EncryptedWebhookEvidence): Promise<TelegramReply> {
  const language = account.language;
  if (!account.userId || !account.companyId) return { chatId: evidence.telegramChatId!, text: localized(language, "notConnected") };
  const draft = parseSupportDraft(evidence.argument || "");
  if (!draft) return { chatId: evidence.telegramChatId!, text: `${supportIntro(language)}\n${supportCategoryLabels(language)}` };
  const conversationId = await openConversation(client, { userId: account.userId, companyId: account.companyId, channelId: account.channelId, adapterId: config.adapterId, language, mode: "support", status: "pending_confirmation", privacyNoticeVersion: config.consentVersion });
  const draftText = `${draft.category} | ${draft.subject} | ${draft.description} | ${draft.severity}`;
  await recordConversationMessage(client, { conversationId, direction: "inbound", role: "user", updateId: evidence.updateId, key: `support-draft:${evidence.updateId}`, language, text: draftText, state: "pending_confirmation", requestedAction: "support_intake_draft" });
  const text = language === "es"
    ? `Resumen de soporte:\nCategoria: ${draft.category}\nAsunto: ${draft.subject}\nDescripcion: ${draft.description}\nPrioridad: ${draft.severity}\nConfirmar: /confirm_support ${conversationId}\nCancelar: /cancel_support ${conversationId}`
    : `Support summary:\nCategory: ${draft.category}\nSubject: ${draft.subject}\nDescription: ${draft.description}\nSeverity: ${draft.severity}\nConfirm: /confirm_support ${conversationId}\nCancel: /cancel_support ${conversationId}`;
  const outboundMessageId = await recordConversationMessage(client, { conversationId, direction: "outbound", role: "support", key: `support-summary:${conversationId}`, language, text, deliveryState: "pending", requestedAction: "support_confirmation", summary: "support intake summary" });
  return { chatId: evidence.telegramChatId!, text, conversationId, outboundMessageId };
}

async function handleConfirmSupport(client: QueryClient, account: Awaited<ReturnType<typeof connectedTelegramAccount>>, evidence: EncryptedWebhookEvidence, cancelOnly = false): Promise<TelegramReply> {
  const language = account.language;
  if (!account.userId || !account.companyId) return { chatId: evidence.telegramChatId!, text: localized(language, "notConnected") };
  const conversationId = sanitizeTelegramText(evidence.argument || "");
  const row = await client.query<{ sanitized_text: string }>(
    `SELECT m.sanitized_text FROM telegram_conversations c JOIN telegram_conversation_messages m ON m.conversation_id=c.id
     WHERE c.id=$1 AND c.user_id=$2 AND c.mode='support' AND c.status='pending_confirmation' AND m.requested_action='support_intake_draft'
     ORDER BY m.created_at DESC LIMIT 1`,
    [conversationId, account.userId],
  );
  const draft = parseSupportDraft(row.rows[0]?.sanitized_text || "");
  if (!draft) return { chatId: evidence.telegramChatId!, text: language === "es" ? "No hay un caso de soporte pendiente." : "No pending support case was found." };
  if (cancelOnly) {
    await client.query(`UPDATE telegram_conversations SET status='closed', closed_at=now(), updated_at=now() WHERE id=$1`, [conversationId]);
    await recordConversationMessage(client, { conversationId, direction: "system", role: "system", updateId: evidence.updateId, key: `support-cancel:${evidence.updateId}`, language, text: "cancelled", state: "cancelled", requestedAction: "support_cancelled" });
    return { chatId: evidence.telegramChatId!, text: language === "es" ? "Solicitud de soporte cancelada. No se creó ningún caso." : "Support request cancelled. No case was created." };
  }
  const caseNumber = `TG-${Date.now().toString(36).toUpperCase()}-${crypto.randomInt(1000, 9999)}`;
  const caseId = crypto.randomUUID();
  await client.query(
    `INSERT INTO telegram_support_cases(id,case_number,user_id,company_id,conversation_id,category,subject,description,severity,status,language)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'new',$10)`,
    [caseId, caseNumber, account.userId, account.companyId, conversationId, draft.category, draft.subject, draft.description, draft.severity, language],
  );
  await client.query(`UPDATE telegram_conversations SET support_case_id=$2, status='closed', closed_at=now(), updated_at=now() WHERE id=$1`, [conversationId, caseId]);
  await client.query(
    `INSERT INTO telegram_support_case_events(id,case_id,actor_user_id,action,from_status,to_status,reason,details)
     VALUES($1,$2,$3,'created',NULL,'new',$4,$5::jsonb)`,
    [crypto.randomUUID(), caseId, account.userId, "telegram_user_confirmed", JSON.stringify({ updateId: evidence.updateId, category: draft.category, severity: draft.severity })],
  );
  const text = language === "es" ? `Caso de soporte creado: ${caseNumber}. Estado: new.` : `Support case created: ${caseNumber}. Status: new.`;
  const outboundMessageId = await recordConversationMessage(client, { conversationId, direction: "outbound", role: "support", key: `support-created:${caseId}`, language, text, deliveryState: "pending", requestedAction: "support_case_created", summary: "support case created" });
  return { chatId: evidence.telegramChatId!, text, conversationId, outboundMessageId };
}

async function processStartToken(client: QueryClient, config: TelegramProductConfig, token: string, telegramUserId: string, telegramChatId: string, accountLabel: string | null): Promise<TelegramReply> {
  const tokenHmac = hmacValue(config, token);
  const telegramUserHash = hmacValue(config, `telegram-user:${telegramUserId}`);
  const telegramChatHash = hmacValue(config, `telegram-chat:${telegramChatId}`);
  const found = await client.query<{ id: number; user_id: number; email: string; consent_version: string; consent_purpose: string }>(
    `SELECT clt.id, clt.user_id, u.email, clt.consent_version, clt.consent_purpose
     FROM channel_linking_tokens clt
     INNER JOIN users u ON u.id = clt.user_id
     INNER JOIN companies c ON c.id = u.company_id
     WHERE clt.adapter_id = $1
       AND clt.token_hmac = $2
       AND clt.status = 'pending'
       AND clt.expires_at > now()
       AND clt.consent_version = $3
       AND clt.consent_purpose = $4
     FOR UPDATE OF clt`,
    [config.adapterId, tokenHmac, config.consentVersion, CONSENT_PURPOSE],
  );
  const row = found.rows[0];
  if (!row) return { chatId: telegramChatId, text: localized("en", "invalid") };

  const existing = await client.query<{ user_id: number }>(
    `SELECT user_id
     FROM notification_channels
     WHERE adapter_id = $1 AND telegram_user_hash = $2 AND status = 'connected'
     FOR UPDATE`,
    [config.adapterId, telegramUserHash],
  );
  const linkedToOther = existing.rows.find((r) => r.user_id !== row.user_id);
  if (linkedToOther) {
    await audit(client, row.user_id, row.email, "telegram_link_conflict", { adapterId: config.adapterId, telegramUserHash });
    return { chatId: telegramChatId, text: localized("en", "conflict") };
  }

  await client.query(`UPDATE channel_linking_tokens SET status = 'consumed', consumed_at = now() WHERE id = $1`, [row.id]);
  await client.query(
    `UPDATE notification_channels
     SET status = 'revoked', revoked_at = now(), updated_at = now()
     WHERE adapter_id = $1 AND status = 'connected' AND user_id = $2`,
    [config.adapterId, row.user_id],
  );
  await client.query(
    `INSERT INTO notification_channels
      (user_id, adapter_id, provider, status, telegram_user_hash, telegram_chat_hash, encrypted_telegram_user_id, encrypted_telegram_chat_id, account_label, metadata, linked_at, updated_at)
     VALUES ($1, $2, 'telegram', 'connected', $3, $4, $5, $6, $7, '{}'::jsonb, now(), now())`,
    [
      row.user_id,
      config.adapterId,
      telegramUserHash,
      telegramChatHash,
      encryptEvidence(config, { telegramUserId }),
      encryptEvidence(config, { telegramChatId }),
      accountLabel,
    ],
  );
  await client.query(
    `INSERT INTO notification_preferences (user_id, adapter_id, channel, enabled, language, topics, updated_at)
     VALUES ($1, $2, 'telegram', 'false', 'en', '{}'::jsonb, now())
     ON CONFLICT (user_id, adapter_id, channel)
     DO UPDATE SET enabled = 'false', topics = '{}'::jsonb, updated_at = now()`,
    [row.user_id, config.adapterId],
  );
  await audit(client, row.user_id, row.email, "telegram_connected", {
    adapterId: config.adapterId,
    telegramUserHash,
    consentVersion: row.consent_version,
    purpose: row.consent_purpose,
  });
  return { chatId: telegramChatId, text: linkSuccess() };
}

async function processCommand(client: QueryClient, config: TelegramProductConfig, evidence: EncryptedWebhookEvidence): Promise<TelegramReply | null> {
  if (evidence.kind === "my_chat_member") {
    if (!evidence.telegramChatId || !evidence.telegramUserId || !["kicked", "left", "restricted"].includes(evidence.memberStatus || "")) return null;
    const telegramUserHash = hmacValue(config, `telegram-user:${evidence.telegramUserId}`);
    await client.query(
      `UPDATE notification_channels
       SET status = CASE WHEN $3 = 'kicked' THEN 'blocked' ELSE 'unavailable' END, updated_at = now()
       WHERE adapter_id = $1 AND telegram_user_hash = $2 AND status = 'connected'`,
      [config.adapterId, telegramUserHash, evidence.memberStatus],
    );
    return null;
  }
  if (!evidence.telegramChatId || !evidence.telegramUserId || evidence.chatType !== "private") return null;
  const telegramUserHash = hmacValue(config, `telegram-user:${evidence.telegramUserId}`);
  const connected = await connectedTelegramAccount(client, config, telegramUserHash);
  const language = connected.language;
  const accountLabel = null;

  if (evidence.command === "/start") {
    if (evidence.argument) return processStartToken(client, config, evidence.argument, evidence.telegramUserId, evidence.telegramChatId, accountLabel);
    return { chatId: evidence.telegramChatId, text: bilingualStart() };
  }
  if (evidence.command === "/help" || evidence.command === "/menu") return handleHelpCommand(client, config, connected, evidence);
  if (evidence.command === "/ayuda") return handleHelpCommand(client, config, { ...connected, language: "es" }, evidence);
  if (["/admin_support_queue", "/admin_conversation_audit", "/admin_ai_usage", "/admin_failed_deliveries"].includes(evidence.command || "")) {
    if (!connected.userId) return { chatId: evidence.telegramChatId, text: localized(language, "notConnected") };
    if (!connected.isSuperAdmin) return { chatId: evidence.telegramChatId, text: language === "es" ? "Acceso denegado." : "Access denied." };
    return { chatId: evidence.telegramChatId, text: productMenu(language, true) };
  }
  if (evidence.command === "/settings") return { chatId: evidence.telegramChatId, text: connected.userId ? localized(language, "settings") : localized(language, "notConnected") };
  if (evidence.command === "/privacy") return { chatId: evidence.telegramChatId, text: localized(language, "privacy") };
  if (evidence.command === "/assistant" || evidence.command === "/asistente") return handleAssistantCommand(client, config, connected, evidence);
  if (evidence.command === "/continue_ai") return handleContinueAi(client, config, connected, evidence);
  if (evidence.command === "/confirm_ai") return handleConfirmAi(client, connected, evidence, false);
  if (evidence.command === "/cancel_ai") return handleConfirmAi(client, connected, evidence, true);
  if (evidence.command === "/close_conversation") return handleCloseConversation(client, connected, evidence);
  if (evidence.command === "/support" || evidence.command === "/soporte") return handleSupportCommand(client, config, connected, evidence);
  if (evidence.command === "/confirm_support") return handleConfirmSupport(client, connected, evidence, false);
  if (evidence.command === "/cancel_support") return handleConfirmSupport(client, connected, evidence, true);
  if (evidence.command === "/language") {
    const nextLanguage = parseLanguage(evidence.argument);
    if (!connected.userId || !connected.email) return { chatId: evidence.telegramChatId, text: localized(language, "notConnected") };
    if (!nextLanguage) return { chatId: evidence.telegramChatId, text: bilingualStart() };
    await client.query(
      `INSERT INTO notification_preferences (user_id, adapter_id, channel, enabled, language, topics, updated_at)
       VALUES ($1, $2, 'telegram', 'false', $3, '{}'::jsonb, now())
       ON CONFLICT (user_id, adapter_id, channel)
       DO UPDATE SET language = EXCLUDED.language, updated_at = now()`,
      [connected.userId, config.adapterId, nextLanguage],
    );
    await audit(client, connected.userId, connected.email, "telegram_language_updated", { adapterId: config.adapterId, language: nextLanguage, source: "telegram_command" });
    return { chatId: evidence.telegramChatId, text: localized(nextLanguage, nextLanguage === "es" ? "languageEs" : "languageEn") };
  }
  if (evidence.command === "/disconnect") {
    if (!connected.userId || !connected.email) return { chatId: evidence.telegramChatId, text: localized(language, "notConnected") };
    return revokeTelegramConnectionTx(client, config, connected.userId, connected.email, "telegram_command", language);
  }
  return { chatId: evidence.telegramChatId, text: localized(language, "unknown") };
}

function evidenceFromUpdate(config: TelegramProductConfig, update: TelegramWebhookUpdate): { updateId: string; evidence: EncryptedWebhookEvidence; hashes: { userHash: string | null; chatHash: string | null }; command: string | null; nonPrivate: boolean } {
  const updateId = update.update_id === undefined ? "" : String(update.update_id);
  if (!updateId) throw new TelegramProductError(400, "INVALID_UPDATE", "update_id is required.");
  const msg = update.message;
  const member = update.my_chat_member;
  const text = typeof msg?.text === "string" ? msg.text.trim() : "";
  const parts = text ? commandParts(text) : { command: "", argument: "" };
  const telegramUserId = msg?.from?.id !== undefined ? String(msg.from.id) : member?.from?.id !== undefined ? String(member.from.id) : null;
  const telegramChatId = msg?.chat?.id !== undefined ? String(msg.chat.id) : member?.chat?.id !== undefined ? String(member.chat.id) : null;
  const chatType = msg?.chat?.type || member?.chat?.type || null;
  const kind: EncryptedWebhookEvidence["kind"] = msg ? "message" : member ? "my_chat_member" : "unsupported";
  return {
    updateId,
    evidence: {
      updateId,
      kind,
      command: parts.command || null,
      argument: parts.argument || null,
      chatType,
      telegramUserId,
      telegramChatId,
      memberStatus: member?.new_chat_member?.status || null,
    },
    hashes: {
      userHash: telegramUserId ? hmacValue(config, `telegram-user:${telegramUserId}`) : null,
      chatHash: telegramChatId ? hmacValue(config, `telegram-chat:${telegramChatId}`) : null,
    },
    command: parts.command || (member ? "my_chat_member" : null),
    nonPrivate: kind === "message" && chatType !== "private",
  };
}

export async function receiveTelegramWebhook(update: TelegramWebhookUpdate): Promise<{ accepted: boolean; duplicate: boolean; inboundId: number | null; nonPrivate: boolean }> {
  const config = requireTelegramProductConfig();
  const parsed = evidenceFromUpdate(config, update);
  const receipt = await pool.query<{ id: number }>(
    `INSERT INTO telegram_inbound_updates (adapter_id, update_id, status, telegram_user_hash, telegram_chat_hash, command, encrypted_evidence)
     VALUES ($1, $2, 'received', $3, $4, $5, $6)
     ON CONFLICT (adapter_id, update_id) DO NOTHING
     RETURNING id`,
    [config.adapterId, parsed.updateId, parsed.hashes.userHash, parsed.hashes.chatHash, parsed.command, encryptEvidence(config, parsed.evidence)],
  );
  return { accepted: true, duplicate: !receipt.rows[0], inboundId: receipt.rows[0]?.id ?? null, nonPrivate: parsed.nonPrivate };
}

export async function processTelegramInboundQueue(limit = 25): Promise<{ processed: number; sent: number }> {
  const config = requireTelegramProductConfig();
  const claimed = await pool.query<{ id: number; encrypted_evidence: string }>(
    `UPDATE telegram_inbound_updates
     SET status = 'processing'
     WHERE id IN (
       SELECT id FROM telegram_inbound_updates
       WHERE adapter_id = $1 AND status = 'received'
       ORDER BY received_at, id
       LIMIT $2
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, encrypted_evidence`,
    [config.adapterId, limit],
  );
  let processed = 0;
  let sent = 0;
  for (const row of claimed.rows) {
    let reply: TelegramReply | null = null;
    const client = await pool.connect();
    try {
      const evidence = decryptEvidence<EncryptedWebhookEvidence>(config, row.encrypted_evidence);
      await client.query("BEGIN");
      let status = "processed";
      let errorCode: string | null = null;
      if (evidence.kind === "message" && evidence.chatType !== "private") {
        status = "rejected";
        errorCode = "NON_PRIVATE_CHAT";
      } else {
        reply = await processCommand(client, config, evidence);
      }
      await client.query(
        `UPDATE telegram_inbound_updates SET status = $1, error_code = $2, processed_at = now() WHERE id = $3`,
        [status, errorCode, row.id],
      );
      await client.query("COMMIT");
      processed += 1;
    } catch (err) {
      await client.query("ROLLBACK");
      await pool.query(
        `UPDATE telegram_inbound_updates SET status = 'failed', error_code = $1, processed_at = now() WHERE id = $2`,
        [err instanceof TelegramProductError ? err.code : "PROCESSING_FAILED", row.id],
      );
    } finally {
      client.release();
    }
    if (reply) {
      try {
        await sendTelegramReply(reply);
        sent += 1;
      } catch (err) {
        console.error("[telegram-product] reply delivery failed:", err instanceof Error ? err.message : "unknown");
      }
    }
  }
  return { processed, sent };
}

let workerStarted = false;
export function startTelegramProductWorker(): void {
  if (workerStarted) return;
  workerStarted = true;
  const config = getTelegramProductConfig();
  if (!config.configured) return;
  const run = () => {
    processTelegramInboundQueue().catch((err) => {
      console.error("[telegram-product] durable queue processing failed:", err instanceof Error ? err.message : "unknown");
    });
  };
  setTimeout(run, 0);
  setInterval(run, 30_000).unref?.();
}

export async function sendTelegramReply(reply: TelegramReply | null): Promise<void> {
  if (!reply) return;
  const config = requireTelegramProductConfig();
  if (reply.outboundMessageId) {
    const current = await pool.query<{ delivery_state: string }>(`SELECT delivery_state FROM telegram_conversation_messages WHERE id=$1`, [reply.outboundMessageId]);
    if (current.rows[0]?.delivery_state === "delivered") return;
    await pool.query(`UPDATE telegram_conversation_messages SET delivery_state='pending', delivery_attempts=delivery_attempts+1 WHERE id=$1 AND delivery_state<>'delivered'`, [reply.outboundMessageId]);
  }
  const response = await fetch(`${BOT_API_BASE}/bot${config.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: reply.chatId, text: reply.text, disable_web_page_preview: true }),
  });
  if (!response.ok) {
    if (reply.outboundMessageId) {
      await pool.query(`UPDATE telegram_conversation_messages SET delivery_state='failed', error_category=$2 WHERE id=$1`, [reply.outboundMessageId, `TELEGRAM_HTTP_${response.status}`]);
    }
    throw new TelegramProductError(502, "TELEGRAM_SEND_FAILED", `Telegram sendMessage failed with status ${response.status}.`);
  }
  const body = await response.json().catch(() => null) as { ok?: boolean; result?: { message_id?: number | string } } | null;
  const messageId = body?.ok === true && body.result?.message_id != null ? String(body.result.message_id) : "";
  if (!messageId) {
    if (reply.outboundMessageId) {
      await pool.query(`UPDATE telegram_conversation_messages SET delivery_state='failed', error_category='TELEGRAM_INVALID_RESPONSE' WHERE id=$1`, [reply.outboundMessageId]);
    }
    throw new TelegramProductError(502, "TELEGRAM_INVALID_RESPONSE", "Telegram sendMessage did not return a valid message id.");
  }
  if (reply.outboundMessageId) {
    await pool.query(`UPDATE telegram_conversation_messages SET delivery_state='delivered', telegram_delivery_message_id=$2, delivered_at=now(), error_category=NULL WHERE id=$1`, [reply.outboundMessageId, messageId]);
  }
}

export function telegramProductHealth() {
  const config = getTelegramProductConfig();
  return {
    configured: config.configured,
    consentVersion: config.consentVersion || "unconfigured",
    consentPurpose: CONSENT_PURPOSE,
    adapterConfigured: Boolean(config.adapterId),
    botConfigured: Boolean(config.botUsername),
    publicBaseUrlConfigured: Boolean(config.publicBaseUrl),
  };
}

export const telegramProductInternals = {
  TOKEN_BYTES,
  TOKEN_TTL_MS,
  LINK_RATE_LIMIT_MAX,
  CONSENT_PURPOSE,
};
