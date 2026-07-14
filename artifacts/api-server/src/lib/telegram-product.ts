import crypto from "crypto";
import { pool } from "@workspace/db";

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
      help: "Your BIMLog Telegram channel is connected. Commands: /settings, /language en, /language es, /privacy, /disconnect.",
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
      help: "Tu canal de Telegram de BIMLog está conectado. Comandos: /settings, /language en, /language es, /privacy, /disconnect.",
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
  const connected = await languageForTelegramUser(client, config, telegramUserHash);
  const language = connected.language;
  const accountLabel = null;

  if (evidence.command === "/start") {
    if (evidence.argument) return processStartToken(client, config, evidence.argument, evidence.telegramUserId, evidence.telegramChatId, accountLabel);
    return { chatId: evidence.telegramChatId, text: bilingualStart() };
  }
  if (evidence.command === "/help") return { chatId: evidence.telegramChatId, text: localized(language, "help") };
  if (evidence.command === "/settings") return { chatId: evidence.telegramChatId, text: connected.userId ? localized(language, "settings") : localized(language, "notConnected") };
  if (evidence.command === "/privacy") return { chatId: evidence.telegramChatId, text: localized(language, "privacy") };
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
  const response = await fetch(`${BOT_API_BASE}/bot${config.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: reply.chatId, text: reply.text, disable_web_page_preview: true }),
  });
  if (!response.ok) {
    throw new TelegramProductError(502, "TELEGRAM_SEND_FAILED", `Telegram sendMessage failed with status ${response.status}.`);
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
