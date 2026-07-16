import crypto from "crypto";
import { pool } from "@workspace/db";
import { storage } from "./storage-adapter";
import { signToken } from "../middlewares/auth";
import { decryptEvidence, getTelegramProductConfig, hmacValue, TelegramProductError, type TelegramLanguage } from "./telegram-product";

export type DeliveryChannel = "telegram" | "email";
export type DeliveryArtifactType = "project_file" | "rfi_pdf" | "rfi_complete_pdf" | "rfi_docx" | "rfi_audit_pdf";
export type DeliveryStatus = "draft" | "awaiting_confirmation" | "confirmed" | "preparing" | "ready" | "delivering" | "delivered" | "failed" | "cancelled" | "expired";

type DeliveryRow = {
  id: string; user_id: number; company_id: number; project_id: number; conversation_id: string | null;
  artifact_type: DeliveryArtifactType; artifact_entity_id: string; canonical_route: string | null; artifact_label: string;
  channel: DeliveryChannel; recipient_identities: string[]; external_recipients: string[]; language: TelegramLanguage;
  status: DeliveryStatus; confirmation_key: string; confirmed_at: Date | null; external_warning_acknowledged: boolean; external_warning_acknowledged_at: Date | null; external_confirmed_at: Date | null;
  provider_acknowledgement_state: string | null; provider_reference: string | null; attempt_count: number;
  delivered_at: Date | null; failure_category: string | null; artifact_sha256: string | null; artifact_size: number | null;
  expires_at: Date; created_at: Date; updated_at: Date;
};

type Artifact = { buffer: Buffer; fileName: string; contentType: string; sha256: string; size: number };
type ProviderTransport = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const DELIVERY_TTL_MS = 30 * 60 * 1000;
const LINK_TTL_MS = 10 * 60 * 1000;
const DEFAULT_PREPARATION_TIMEOUT_MS = 15_000;
const EMAIL_RE = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
const ARTIFACTS: Record<Exclude<DeliveryArtifactType, "project_file">, { route: string; suffix: string; contentType: string }> = {
  rfi_pdf: { route: "/projects/{projectId}/rfis/{entityId}/export", suffix: "-Request-for-Information.pdf", contentType: "application/pdf" },
  rfi_complete_pdf: { route: "/projects/{projectId}/rfis/{entityId}/export-complete", suffix: "-Complete-RFI-Package.pdf", contentType: "application/pdf" },
  rfi_docx: { route: "/projects/{projectId}/rfis/{entityId}/export-word", suffix: "-Request-for-Information.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  rfi_audit_pdf: { route: "/projects/{projectId}/rfis/{entityId}/audit-certificate", suffix: "-RFI-Audit.pdf", contentType: "application/pdf" },
};

function safeText(value: unknown, max = 240): string {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function positiveId(value: unknown, label: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new TelegramProductError(400, "DELIVERY_IDENTITY_INVALID", `${label} must be a positive BIMLog ID.`);
  return number;
}

function parseArtifactType(value: unknown): DeliveryArtifactType {
  const type = safeText(value, 64) as DeliveryArtifactType;
  if (type === "project_file" || Object.prototype.hasOwnProperty.call(ARTIFACTS, type)) return type;
  throw new TelegramProductError(422, "UNSUPPORTED_ARTIFACT", "This artifact type does not have a supported canonical delivery route.");
}

function parseChannel(value: unknown): DeliveryChannel {
  if (value === "telegram" || value === "email") return value;
  throw new TelegramProductError(400, "DELIVERY_CHANNEL_INVALID", "Delivery channel must be telegram or email.");
}

export function normalizeDeliveryEmails(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[;,]/) : [];
  const normalized = [...new Set(raw.map((item) => safeText(item, 320).toLowerCase()).filter(Boolean))].sort();
  if (!normalized.length || normalized.some((email) => !EMAIL_RE.test(email))) {
    throw new TelegramProductError(400, "RECIPIENT_INVALID", "One or more email recipients are invalid.");
  }
  return normalized;
}

function canonicalRoute(type: DeliveryArtifactType, projectId: number, entityId: number): string | null {
  if (type === "project_file") return `/projects/${projectId}/files/${entityId}/download`;
  return ARTIFACTS[type].route.replace("{projectId}", String(projectId)).replace("{entityId}", String(entityId));
}

function publicDelivery(row: DeliveryRow) {
  return {
    id: row.id, projectId: row.project_id, artifactType: row.artifact_type, artifactEntityId: row.artifact_entity_id,
    artifactLabel: row.artifact_label, channel: row.channel, recipients: row.recipient_identities,
    externalRecipients: row.external_recipients, language: row.language, status: row.status,
    confirmedAt: row.confirmed_at, externalWarningAcknowledged: row.external_warning_acknowledged,
    externalWarningAcknowledgedAt: row.external_warning_acknowledged_at, externalConfirmedAt: row.external_confirmed_at,
    acknowledgementState: row.provider_acknowledgement_state, providerReference: row.provider_reference,
    attemptCount: row.attempt_count, deliveredAt: row.delivered_at, failureCategory: row.failure_category,
    artifactSha256: row.artifact_sha256, artifactSize: row.artifact_size,
    expiresAt: row.expires_at, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function ensureTelegramProductDeliverySchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS telegram_delivery_requests (
      id text PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), company_id integer NOT NULL REFERENCES companies(id),
      project_id integer NOT NULL REFERENCES projects(id), conversation_id text REFERENCES telegram_conversations(id),
      artifact_type text NOT NULL, artifact_entity_id text NOT NULL, canonical_route text, artifact_label text NOT NULL,
      channel text NOT NULL, recipient_identities jsonb NOT NULL DEFAULT '[]'::jsonb, external_recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
      language text NOT NULL DEFAULT 'en', status text NOT NULL DEFAULT 'draft', confirmation_key text NOT NULL,
      confirmed_at timestamptz, external_warning_acknowledged boolean NOT NULL DEFAULT false,
      external_warning_acknowledged_at timestamptz, external_confirmed_at timestamptz, provider_acknowledgement_state text, provider_reference text,
      attempt_count integer NOT NULL DEFAULT 0, delivered_at timestamptz, failure_category text, artifact_sha256 text,
      artifact_size integer, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT telegram_delivery_requests_status_chk CHECK(status IN ('draft','awaiting_confirmation','confirmed','preparing','ready','delivering','delivered','failed','cancelled','expired')),
      CONSTRAINT telegram_delivery_requests_channel_chk CHECK(channel IN ('telegram','email')),
      CONSTRAINT telegram_delivery_requests_language_chk CHECK(language IN ('en','es'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS telegram_delivery_requests_confirmation_uidx ON telegram_delivery_requests(confirmation_key);
    ALTER TABLE telegram_delivery_requests ADD COLUMN IF NOT EXISTS external_warning_acknowledged boolean NOT NULL DEFAULT false;
    ALTER TABLE telegram_delivery_requests ADD COLUMN IF NOT EXISTS external_warning_acknowledged_at timestamptz;
    CREATE UNIQUE INDEX IF NOT EXISTS telegram_delivery_requests_user_confirmation_uidx ON telegram_delivery_requests(user_id,confirmation_key);
    CREATE INDEX IF NOT EXISTS telegram_delivery_requests_user_created_idx ON telegram_delivery_requests(user_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS telegram_delivery_requests_project_created_idx ON telegram_delivery_requests(project_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS telegram_delivery_events (
      id text PRIMARY KEY, delivery_id text NOT NULL REFERENCES telegram_delivery_requests(id), actor_user_id integer REFERENCES users(id),
      from_status text, to_status text NOT NULL, event_type text NOT NULL, reason text NOT NULL,
      safe_details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS telegram_delivery_events_delivery_idx ON telegram_delivery_events(delivery_id,created_at,id);
    CREATE TABLE IF NOT EXISTS telegram_delivery_attempts (
      id text PRIMARY KEY, delivery_id text NOT NULL REFERENCES telegram_delivery_requests(id), attempt_number integer NOT NULL,
      channel text NOT NULL, state text NOT NULL DEFAULT 'persisted', provider_reference text, failure_category text,
      started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
    );
    CREATE UNIQUE INDEX IF NOT EXISTS telegram_delivery_attempts_number_uidx ON telegram_delivery_attempts(delivery_id,attempt_number);
    CREATE TABLE IF NOT EXISTS telegram_delivery_links (
      id text PRIMARY KEY, delivery_id text NOT NULL REFERENCES telegram_delivery_requests(id), audience_user_id integer NOT NULL REFERENCES users(id),
      token_hmac text NOT NULL, status text NOT NULL DEFAULT 'active', expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
    );
    CREATE UNIQUE INDEX IF NOT EXISTS telegram_delivery_links_token_uidx ON telegram_delivery_links(token_hmac);
    CREATE INDEX IF NOT EXISTS telegram_delivery_links_delivery_idx ON telegram_delivery_links(delivery_id);
  `);
}

function injectTransitionFault(point: string): void {
  if (process.env.TELEGRAM_PRODUCT_DELIVERY_FAULT === point) {
    throw new TelegramProductError(500, "DELIVERY_FAULT_INJECTED", `Test fault injected at ${point}.`);
  }
}

type DeliveryDbClient = { query: <Row extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: unknown[]) => Promise<{ rows: Row[] }> };
type TransitionInput = {
  deliveryId: string;
  expected: DeliveryStatus | DeliveryStatus[];
  next: DeliveryStatus;
  actorUserId: number | null;
  eventType: string;
  reason: string;
  faultPrefix: string;
  update: (client: DeliveryDbClient, row: DeliveryRow) => Promise<DeliveryRow>;
  related?: (client: DeliveryDbClient, row: DeliveryRow) => Promise<void>;
  details?: (row: DeliveryRow) => Record<string, unknown>;
};

async function transitionDelivery(input: TransitionInput): Promise<DeliveryRow | null> {
  const expected = Array.isArray(input.expected) ? input.expected : [input.expected];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query<DeliveryRow>(`SELECT * FROM telegram_delivery_requests WHERE id=$1 FOR UPDATE`, [input.deliveryId]);
    const current = selected.rows[0];
    if (!current || !expected.includes(current.status)) { await client.query("ROLLBACK"); return null; }
    const updated = await input.update(client, current);
    injectTransitionFault(`${input.faultPrefix}:after_request_update`);
    if (input.related) {
      await input.related(client, updated);
      injectTransitionFault(`${input.faultPrefix}:after_related_update`);
    }
    await client.query(
      `INSERT INTO telegram_delivery_events(id,delivery_id,actor_user_id,from_status,to_status,event_type,reason,safe_details)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [crypto.randomUUID(), input.deliveryId, input.actorUserId, current.status, input.next, input.eventType, input.reason, JSON.stringify(input.details?.(updated) || {})],
    );
    injectTransitionFault(`${input.faultPrefix}:after_event_insert`);
    await client.query("COMMIT");
    return updated;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function userIdentity(userId: number) {
  const result = await pool.query(`SELECT u.id,u.email,u.full_name,u.company_id,c.name AS company_name,u.is_super_admin FROM users u JOIN companies c ON c.id=u.company_id WHERE u.id=$1`, [userId]);
  const row = result.rows[0];
  if (!row) throw new TelegramProductError(401, "LINKED_IDENTITY_REQUIRED", "A current linked BIMLog identity is required.");
  return row;
}

async function assertProjectAccess(userId: number, projectId: number, failureCode = "PROJECT_ACCESS_DENIED") {
  const result = await pool.query(`SELECT u.id,u.company_id,u.is_super_admin,
    EXISTS(SELECT 1 FROM project_members pm WHERE pm.user_id=u.id AND pm.project_id=$2 AND pm.status='active') AS is_member
    FROM users u WHERE u.id=$1`, [userId, projectId]);
  const row = result.rows[0];
  if (!row || (row.is_super_admin !== true && row.is_member !== true)) {
    throw new TelegramProductError(403, failureCode, failureCode === "ACCESS_REVOKED" ? "Project access was revoked after preview. Delivery stopped." : "Current project access is required.");
  }
  return row;
}

async function assertLinkedPrivateTelegram(userId: number) {
  const config = getTelegramProductConfig();
  if (!config.configured) throw new TelegramProductError(503, "PROVIDER_UNAVAILABLE", "Telegram delivery is not configured.");
  const result = await pool.query(`SELECT id,encrypted_telegram_chat_id,status FROM notification_channels
    WHERE user_id=$1 AND adapter_id=$2 ORDER BY updated_at DESC LIMIT 1`, [userId, config.adapterId]);
  const row = result.rows[0];
  if (!row || row.status !== "connected") throw new TelegramProductError(403, "LINKED_IDENTITY_REQUIRED", "A connected verified private Telegram chat is required.");
  const decrypted = decryptEvidence<{ telegramChatId: string }>(config, row.encrypted_telegram_chat_id);
  if (!decrypted.telegramChatId) throw new TelegramProductError(403, "LINKED_IDENTITY_REQUIRED", "The verified private Telegram chat is unavailable.");
  return { chatId: decrypted.telegramChatId, channelId: row.id };
}

async function artifactLabel(type: DeliveryArtifactType, projectId: number, entityId: number): Promise<string> {
  if (type === "project_file") {
    const result = await pool.query(`SELECT file_name FROM files WHERE id=$1 AND project_id=$2`, [entityId, projectId]);
    if (!result.rows[0]) throw new TelegramProductError(404, "ARTIFACT_NOT_FOUND", "Project file not found.");
    return safeText(result.rows[0].file_name, 300);
  }
  const result = await pool.query(`SELECT number FROM rfis WHERE id=$1 AND project_id=$2`, [entityId, projectId]);
  if (!result.rows[0]) throw new TelegramProductError(404, "ARTIFACT_NOT_FOUND", "RFI not found.");
  return `${safeText(result.rows[0].number, 120)}${ARTIFACTS[type].suffix}`;
}

async function classifyExternalRecipients(userId: number, companyId: number, projectId: number, emails: string[]): Promise<string[]> {
  if (!emails.length) return [];
  const result = await pool.query(`SELECT lower(u.email) AS email FROM users u
    WHERE lower(u.email)=ANY($1::text[]) AND (u.company_id=$2 OR EXISTS(
      SELECT 1 FROM project_members pm WHERE pm.user_id=u.id AND pm.project_id=$3 AND pm.status='active'))`, [emails, companyId, projectId]);
  const internal = new Set(result.rows.map((row) => row.email));
  const requester = await userIdentity(userId);
  internal.add(String(requester.email).toLowerCase());
  return emails.filter((email) => !internal.has(email));
}

function immutableDeliveryMatches(row: DeliveryRow, input: { userId: number; companyId: number; projectId: number; type: DeliveryArtifactType; entityId: number; channel: DeliveryChannel; recipients: string[]; conversationId: string | null }): boolean {
  return row.user_id === input.userId
    && row.company_id === input.companyId
    && row.project_id === input.projectId
    && row.artifact_type === input.type
    && row.artifact_entity_id === String(input.entityId)
    && row.channel === input.channel
    && JSON.stringify(row.recipient_identities) === JSON.stringify(input.recipients)
    && (row.conversation_id || null) === input.conversationId;
}

export async function createDeliveryRequest(input: {
  userId: number; projectId: unknown; artifactType: unknown; entityId: unknown; channel: unknown;
  recipients?: unknown; language: TelegramLanguage; confirmationKey: string; conversationId?: string | null;
}) {
  const projectId = positiveId(input.projectId, "projectId");
  const entityId = positiveId(input.entityId, "entityId");
  const type = parseArtifactType(input.artifactType);
  const channel = parseChannel(input.channel);
  const identity = await userIdentity(input.userId);
  await assertProjectAccess(input.userId, projectId);
  let recipients: string[];
  if (channel === "telegram") {
    if (input.recipients != null && safeText(input.recipients) && safeText(input.recipients).toLowerCase() !== "me") {
      throw new TelegramProductError(400, "ARBITRARY_TELEGRAM_RECIPIENT_REJECTED", "Build 4 Telegram delivery is limited to your verified private chat.");
    }
    await assertLinkedPrivateTelegram(input.userId);
    recipients = ["verified_private_telegram_chat"];
  } else {
    recipients = normalizeDeliveryEmails(input.recipients);
  }
  const rawKey = safeText(input.confirmationKey, 300);
  if (!rawKey) throw new TelegramProductError(400, "IDEMPOTENCY_REQUIRED", "A delivery confirmation key is required.");
  const key = `v2:${input.userId}:${hmacValue(getTelegramProductConfig(), `delivery-idempotency:${rawKey}`)}`;
  const immutable = { userId:input.userId,companyId:identity.company_id,projectId,type,entityId,channel,recipients,conversationId:input.conversationId||null };
  const existing = await pool.query<DeliveryRow>(`SELECT * FROM telegram_delivery_requests WHERE user_id=$1 AND confirmation_key=ANY($2::text[]) ORDER BY created_at DESC LIMIT 1`,[input.userId,[key,rawKey]]);
  if(existing.rows[0]){
    if(!immutableDeliveryMatches(existing.rows[0],immutable))throw new TelegramProductError(409,"IDEMPOTENCY_CONFLICT","This idempotency key is already bound to a different immutable delivery request.");
    return publicDelivery(existing.rows[0]);
  }
  const label = await artifactLabel(type, projectId, entityId);
  const external = channel === "email" ? await classifyExternalRecipients(input.userId, identity.company_id, projectId, recipients) : [];
  const id = crypto.randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query<DeliveryRow>(`INSERT INTO telegram_delivery_requests(
      id,user_id,company_id,project_id,conversation_id,artifact_type,artifact_entity_id,canonical_route,artifact_label,channel,
      recipient_identities,external_recipients,language,status,confirmation_key,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,'awaiting_confirmation',$14,$15) RETURNING *`,
      [id,input.userId,identity.company_id,projectId,input.conversationId||null,type,String(entityId),canonicalRoute(type,projectId,entityId),label,channel,
        JSON.stringify(recipients),JSON.stringify(external),input.language,key,new Date(Date.now()+DELIVERY_TTL_MS)]);
    if (!inserted.rows[0]) throw new TelegramProductError(409,"IDEMPOTENCY_CONFLICT","The idempotency key could not be resolved safely.");
    await client.query(`INSERT INTO telegram_delivery_events(id,delivery_id,actor_user_id,from_status,to_status,event_type,reason,safe_details)
      VALUES($1,$2,$3,'draft','awaiting_confirmation','preview_created','user_requested_preview',$4::jsonb)`,
      [crypto.randomUUID(),id,input.userId,JSON.stringify({ artifactType:type,artifactEntityId:String(entityId),channel,recipientCount:recipients.length,externalRecipientCount:external.length })]);
    await client.query("COMMIT");
    return publicDelivery(inserted.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (error?.code !== "23505") throw error;
    const existing = await pool.query<DeliveryRow>(`SELECT * FROM telegram_delivery_requests WHERE user_id=$1 AND confirmation_key=ANY($2::text[]) ORDER BY created_at DESC LIMIT 1`, [input.userId,[key,rawKey]]);
    const row = existing.rows[0];
    if (!row || !immutableDeliveryMatches(row,immutable)) throw new TelegramProductError(409,"IDEMPOTENCY_CONFLICT","This idempotency key is already bound to a different immutable delivery request.");
    return publicDelivery(row);
  } finally { client.release(); }
}

export async function confirmDeliveryRequest(userId: number, deliveryId: string, externalConfirmation = false) {
  const currentResult = await pool.query<DeliveryRow>(`SELECT * FROM telegram_delivery_requests WHERE id=$1 AND user_id=$2`, [deliveryId, userId]);
  const current = currentResult.rows[0];
  if (!current) throw new TelegramProductError(404, "DELIVERY_NOT_FOUND", "Delivery request not found.");
  if (["delivered", "confirmed", "preparing", "ready", "delivering"].includes(current.status)) return publicDelivery(current);
  if (current.status !== "awaiting_confirmation") throw new TelegramProductError(409, "DELIVERY_NOT_CONFIRMABLE", `Delivery is ${current.status}.`);
  if (current.expires_at.getTime() <= Date.now()) {
    const expired = await transitionDelivery({
      deliveryId, expected: "awaiting_confirmation", next: "expired", actorUserId: userId,
      eventType: "expired", reason: "confirmation_window_expired", faultPrefix: "expired",
      update: async (client) => (await client.query<DeliveryRow>(`UPDATE telegram_delivery_requests SET status='expired',failure_category='expired',updated_at=now() WHERE id=$1 RETURNING *`, [deliveryId])).rows[0],
    });
    return publicDelivery(expired || current);
  }
  if (externalConfirmation) {
    if (!current.external_recipients.length) throw new TelegramProductError(409, "EXTERNAL_CONFIRMATION_NOT_REQUIRED", "This delivery has no external recipients.");
    if (!current.external_warning_acknowledged || !current.external_warning_acknowledged_at) throw new TelegramProductError(409, "EXTERNAL_WARNING_NOT_ACKNOWLEDGED", "A separate first confirmation must acknowledge the external-recipient warning.");
    const updated = await transitionDelivery({
      deliveryId, expected: "awaiting_confirmation", next: "confirmed", actorUserId: userId,
      eventType: "external_recipient_confirmed", reason: "explicit_second_external_confirmation", faultPrefix: "external_confirmed",
      update: async (client) => (await client.query<DeliveryRow>(`UPDATE telegram_delivery_requests SET status='confirmed',external_confirmed_at=COALESCE(external_confirmed_at,now()),updated_at=now() WHERE id=$1 RETURNING *`, [deliveryId])).rows[0],
      details: () => ({ externalRecipientCount: current.external_recipients.length }),
    });
    return publicDelivery(updated || current);
  }
  if (current.external_recipients.length) {
    if (current.external_warning_acknowledged) return { ...publicDelivery(current), externalConfirmationRequired: true };
    const first = await transitionDelivery({
      deliveryId, expected: "awaiting_confirmation", next: "awaiting_confirmation", actorUserId: userId,
      eventType: "external_warning_acknowledged", reason: "explicit_artifact_channel_recipient_and_external_warning_acknowledgement", faultPrefix: "primary_confirmed",
      update: async (client) => (await client.query<DeliveryRow>(`UPDATE telegram_delivery_requests SET confirmed_at=COALESCE(confirmed_at,now()),external_warning_acknowledged=true,external_warning_acknowledged_at=COALESCE(external_warning_acknowledged_at,now()),updated_at=now() WHERE id=$1 RETURNING *`, [deliveryId])).rows[0],
      details: () => ({ externalRecipientCount: current.external_recipients.length }),
    });
    return { ...publicDelivery(first || current), externalConfirmationRequired: true };
  }
  const updated = await transitionDelivery({
    deliveryId, expected: "awaiting_confirmation", next: "confirmed", actorUserId: userId,
    eventType: "confirmed", reason: "explicit_user_confirmation", faultPrefix: "confirmed",
    update: async (client) => (await client.query<DeliveryRow>(`UPDATE telegram_delivery_requests SET status='confirmed',confirmed_at=COALESCE(confirmed_at,now()),updated_at=now() WHERE id=$1 RETURNING *`, [deliveryId])).rows[0],
  });
  return publicDelivery(updated || current);
}

export async function cancelDeliveryRequest(userId: number, deliveryId: string) {
  const owner = await pool.query<DeliveryRow>(`SELECT * FROM telegram_delivery_requests WHERE id=$1 AND user_id=$2`, [deliveryId, userId]);
  if (!owner.rows[0]) throw new TelegramProductError(404, "DELIVERY_NOT_FOUND", "Delivery request not found.");
  const updated = await transitionDelivery({
    deliveryId, expected: ["draft", "awaiting_confirmation", "confirmed"], next: "cancelled", actorUserId: userId,
    eventType: "cancelled", reason: "explicit_user_cancel", faultPrefix: "cancelled",
    update: async (client) => (await client.query<DeliveryRow>(`UPDATE telegram_delivery_requests SET status='cancelled',failure_category='cancelled',updated_at=now() WHERE id=$1 RETURNING *`, [deliveryId])).rows[0],
  });
  return publicDelivery(updated || owner.rows[0]);
}

function internalApiBase(): string {
  const raw = process.env.TELEGRAM_PRODUCT_INTERNAL_API_BASE_URL || `http://127.0.0.1:${process.env.PORT || "3000"}/api/v1`;
  const url = new URL(raw);
  if (url.protocol !== "http:" || !["127.0.0.1","localhost","::1"].includes(url.hostname)) throw new TelegramProductError(500,"INTERNAL_ARTIFACT_ROUTE_INVALID","Canonical artifact routing must use the local BIMLog API.");
  return url.toString().replace(/\/$/,"");
}

function fileNameFromDisposition(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(value)?.[1];
  if (utf) { try { return safeText(decodeURIComponent(utf),300)||fallback; } catch { return fallback; } }
  return safeText(/filename="?([^";]+)"?/i.exec(value)?.[1],300)||fallback;
}

async function generateArtifact(row: DeliveryRow, transport: ProviderTransport): Promise<Artifact> {
  await assertProjectAccess(row.user_id,row.project_id,"ACCESS_REVOKED");
  let buffer: Buffer; let fileName=row.artifact_label; let contentType="application/octet-stream";
  if(row.artifact_type==="project_file"){
    const result=await pool.query(`SELECT file_name,file_type,file_size,storage_path FROM files WHERE id=$1 AND project_id=$2`,[Number(row.artifact_entity_id),row.project_id]);
    const file=result.rows[0];
    if(!file) throw new TelegramProductError(404,"ARTIFACT_NOT_FOUND","Project file not found.");
    if(!file.storage_path) throw new TelegramProductError(422,"STORAGE_READ_FAILED","The project file has no stored binary.");
    try{buffer=await withPreparationTimeout("storage",()=>storage.download(file.storage_path));}catch(error){if(error instanceof TelegramProductError)throw error;throw new TelegramProductError(502,"STORAGE_READ_FAILED","Stored artifact could not be read.");}
    fileName=safeText(file.file_name,300); contentType=String(file.file_type||"application/octet-stream");
  }else{
    const identity=await userIdentity(row.user_id);
    const token=signToken({userId:identity.id,email:identity.email,companyId:identity.company_id,fullName:identity.full_name,companyName:identity.company_name,isSuperAdmin:identity.is_super_admin===true});
    let response:Response;
    try{response=await withPreparationTimeout("export",()=>transport(`${internalApiBase()}${row.canonical_route}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(preparationTimeoutMs())}));}catch(error){if(error instanceof TelegramProductError)throw error;throw new TelegramProductError(502,"EXPORT_FAILED","Canonical export route could not be reached.");}
    if(response.status===403) throw new TelegramProductError(403,"ACCESS_REVOKED","Project access was revoked after preview. Delivery stopped.");
    if(response.status===404) throw new TelegramProductError(404,"ARTIFACT_NOT_FOUND","Canonical artifact not found.");
    if(!response.ok) throw new TelegramProductError(502,"EXPORT_FAILED",`Canonical export failed with status ${response.status}.`);
    buffer=Buffer.from(await response.arrayBuffer()); contentType=response.headers.get("content-type")||ARTIFACTS[row.artifact_type].contentType;
    fileName=fileNameFromDisposition(response.headers.get("content-disposition"),row.artifact_label);
  }
  if(!buffer.length) throw new TelegramProductError(502,"EXPORT_FAILED","Canonical artifact was empty.");
  return {buffer,fileName,contentType,sha256:crypto.createHash("sha256").update(buffer).digest("hex"),size:buffer.length};
}

function preparationTimeoutMs(): number {
  const raw = Number(process.env.TELEGRAM_PRODUCT_PREPARATION_TIMEOUT_MS || DEFAULT_PREPARATION_TIMEOUT_MS);
  return Number.isSafeInteger(raw) && raw >= 50 ? raw : DEFAULT_PREPARATION_TIMEOUT_MS;
}

async function withPreparationTimeout<T>(kind: "export" | "storage", operation: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new TelegramProductError(504, kind === "export" ? "EXPORT_TIMEOUT" : "STORAGE_TIMEOUT", `${kind} preparation exceeded its configured deadline.`)), preparationTimeoutMs());
      }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

function capability(channel:DeliveryChannel):number{
  const env=channel==="telegram"?process.env.TELEGRAM_PRODUCT_TELEGRAM_MAX_BYTES:process.env.TELEGRAM_PRODUCT_EMAIL_MAX_BYTES;
  const fallback=channel==="telegram"?50*1024*1024:20*1024*1024;
  const n=Number(env||fallback); return Number.isSafeInteger(n)&&n>0?n:fallback;
}

async function createSecureLink(row:DeliveryRow):Promise<{url:string;token:string}>{
  const config=getTelegramProductConfig();
  const token=crypto.randomBytes(32).toString("base64url");
  const tokenHmac=hmacValue(config,`delivery-link:${token}`);
  await pool.query(`INSERT INTO telegram_delivery_links(id,delivery_id,audience_user_id,token_hmac,expires_at) VALUES($1,$2,$3,$4,$5)`,[crypto.randomUUID(),row.id,row.user_id,tokenHmac,new Date(Date.now()+LINK_TTL_MS)]);
  const base=(process.env.TELEGRAM_PRODUCT_PUBLIC_BASE_URL||config.publicBaseUrl||"").replace(/\/$/,"");
  if(!base) throw new TelegramProductError(422,"UNSUPPORTED_FILE_SIZE","No secure delivery-link base URL is configured.");
  return {url:`${base}/api/v1/integrations/telegram/deliveries/links/${token}`,token};
}

async function persistFailure(row:DeliveryRow,attemptId:string|null,category:string,fromStatus:DeliveryStatus){
  await transitionDelivery({
    deliveryId: row.id, expected: fromStatus, next: "failed", actorUserId: row.user_id,
    eventType: category === "delivery_unknown" ? "delivery_unknown" : "delivery_failed", reason: category, faultPrefix: "failed",
    update: async (client) => (await client.query<DeliveryRow>(`UPDATE telegram_delivery_requests SET status='failed',failure_category=$2,provider_acknowledgement_state=CASE WHEN $2='delivery_unknown' THEN 'unknown' ELSE 'rejected' END,updated_at=now() WHERE id=$1 RETURNING *`,[row.id,category])).rows[0],
    related: attemptId ? async (client) => { await client.query(`UPDATE telegram_delivery_attempts SET state=$2,failure_category=$3,completed_at=now() WHERE id=$1`,[attemptId,category === "delivery_unknown" ? "unknown" : "failed",category]); } : undefined,
  });
}

async function sendProvider(row:DeliveryRow,artifact:Artifact,transport:ProviderTransport,linkUrl?:string):Promise<string>{
  const timeoutMsRaw=Number(process.env.TELEGRAM_PRODUCT_DELIVERY_TIMEOUT_MS||15000);
  const timeoutMs=Number.isSafeInteger(timeoutMsRaw)&&timeoutMsRaw>=1000?timeoutMsRaw:15000;
  const signal=AbortSignal.timeout(timeoutMs);
  if(row.channel==="telegram"){
    const config=getTelegramProductConfig(); const chat=await assertLinkedPrivateTelegram(row.user_id);
    const endpoint=(process.env.TELEGRAM_PRODUCT_TELEGRAM_API_BASE_URL||"https://api.telegram.org").replace(/\/$/,"");
    let body: any;
    if(linkUrl){const form=new URLSearchParams({chat_id:chat.chatId,text:row.language==="es"?`Tu archivo supera el limite directo. Enlace BIMLog seguro y temporal: ${linkUrl}`:`Your file exceeds the direct limit. Secure temporary BIMLog link: ${linkUrl}`});body=form;}
    else{const form=new FormData();const bytes=new Uint8Array(artifact.buffer.length);bytes.set(artifact.buffer);form.set("chat_id",chat.chatId);form.set("caption",row.language==="es"?`Entrega BIMLog ${row.id}`:`BIMLog delivery ${row.id}`);form.set("document",new Blob([bytes],{type:artifact.contentType}),artifact.fileName);body=form;}
    const response=await transport(`${endpoint}/bot${config.botToken}/${linkUrl?"sendMessage":"sendDocument"}`,{method:"POST",body,signal});
    const json=await response.json().catch(()=>null) as any;
    if(!response.ok||json?.ok!==true) throw new TelegramProductError(502,"PROVIDER_REJECTED","Telegram rejected the delivery.");
    const id=json?.result?.message_id; if(id==null) throw new TelegramProductError(502,"PROVIDER_REJECTED","Telegram returned no acknowledgement ID.");
    return `telegram:${String(id)}`;
  }
  const connection=await pool.query(`SELECT credentials,account_label,status FROM user_connections WHERE user_id=$1 AND provider='sendgrid' LIMIT 1`,[row.user_id]);
  const conn=connection.rows[0]; const apiKey=conn?.credentials?.apiKey;
  if(conn?.status!=="connected"||typeof apiKey!=="string"||!conn.account_label) throw new TelegramProductError(503,"PROVIDER_UNAVAILABLE","A connected email provider is required.");
  if(linkUrl) throw new TelegramProductError(422,"UNSUPPORTED_FILE_SIZE","Oversized email delivery is unsupported because a recipient-specific authenticated link is not available.");
  const endpoint=(process.env.TELEGRAM_PRODUCT_SENDGRID_API_BASE_URL||"https://api.sendgrid.com").replace(/\/$/,"");
  const payload:any={personalizations:[{to:row.recipient_identities.map(email=>({email}))}],from:{email:conn.account_label},subject:`BIMLog delivery: ${row.artifact_label}`,content:[{type:"text/plain",value:linkUrl?`Secure temporary BIMLog link: ${linkUrl}`:"The requested BIMLog artifact is attached."}]};
  if(!linkUrl)payload.attachments=[{content:artifact.buffer.toString("base64"),type:artifact.contentType,filename:artifact.fileName,disposition:"attachment"}];
  const response=await transport(`${endpoint}/v3/mail/send`,{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify(payload),signal});
  if(!response.ok) throw new TelegramProductError(502,"PROVIDER_REJECTED","Email provider rejected the delivery.");
  const id=response.headers.get("x-message-id")||response.headers.get("x-request-id");
  if(!id) throw new TelegramProductError(502,"PROVIDER_REJECTED","Email provider returned no acknowledgement ID.");
  return `email:${safeText(id,240)}`;
}

function isUnknownProviderOutcome(error: unknown): boolean {
  const value = error as { name?: unknown; code?: unknown; cause?: unknown } | null;
  const name = safeText(value?.name,80).toLowerCase();
  const code = safeText(value?.code,120).toLowerCase();
  if (["aborterror","timeouterror"].includes(name)) return true;
  if (["etimedout","err_request_timeout","und_err_connect_timeout","und_err_headers_timeout","und_err_body_timeout","provider_timeout"].includes(code)) return true;
  return value?.cause ? isUnknownProviderOutcome(value.cause) : false;
}

export async function executeDeliveryRequest(deliveryId:string,transport:ProviderTransport=fetch){
  const owner = await pool.query<DeliveryRow>(`SELECT * FROM telegram_delivery_requests WHERE id=$1`, [deliveryId]);
  if(!owner.rows[0])throw new TelegramProductError(404,"DELIVERY_NOT_FOUND","Delivery request not found.");
  const row=await transitionDelivery({
    deliveryId, expected:"confirmed", next:"preparing", actorUserId:owner.rows[0].user_id,
    eventType:"preparation_started", reason:"confirmed_delivery", faultPrefix:"preparing",
    update:async(client)=>(await client.query<DeliveryRow>(`UPDATE telegram_delivery_requests SET status='preparing',updated_at=now() WHERE id=$1 RETURNING *`,[deliveryId])).rows[0],
  });
  if(!row)return publicDelivery(owner.rows[0]);
  let artifact:Artifact;
  try{artifact=await generateArtifact(row,transport);}catch(error){const category=error instanceof TelegramProductError?error.code.toLowerCase():"export_failed";await persistFailure(row,null,category,"preparing");throw error;}
  const ready=await transitionDelivery({
    deliveryId:row.id, expected:"preparing", next:"ready", actorUserId:row.user_id,
    eventType:"artifact_prepared", reason:"canonical_artifact_ready", faultPrefix:"ready",
    update:async(client)=>(await client.query<DeliveryRow>(`UPDATE telegram_delivery_requests SET status='ready',artifact_sha256=$2,artifact_size=$3,updated_at=now() WHERE id=$1 RETURNING *`,[row.id,artifact.sha256,artifact.size])).rows[0],
    details:()=>({sha256:artifact.sha256,size:artifact.size,fileName:artifact.fileName}),
  });
  if(!ready)return publicDelivery(row);
  try{await assertProjectAccess(row.user_id,row.project_id,"ACCESS_REVOKED");}catch(error){await persistFailure(ready,null,"access_revoked","ready");throw error;}
  let linkUrl:string|undefined;
  if(artifact.size>capability(row.channel)){
    if(row.channel==="email"){
      const error=new TelegramProductError(422,"UNSUPPORTED_FILE_SIZE","Oversized email delivery requires recipient-specific authenticated links and is not supported in Build 4.");
      await persistFailure(ready,null,"unsupported_file_size","ready"); throw error;
    }
    try{linkUrl=(await createSecureLink(ready)).url;}catch(error){await persistFailure(ready,null,"unsupported_file_size","ready");throw error;}
  }
  const attemptId=crypto.randomUUID();
  const delivering=await transitionDelivery({
    deliveryId:row.id, expected:"ready", next:"delivering", actorUserId:row.user_id,
    eventType:"provider_attempt_persisted", reason:"attempt_recorded_before_provider", faultPrefix:"delivering",
    update:async(client)=>(await client.query<DeliveryRow>(`UPDATE telegram_delivery_requests SET status='delivering',attempt_count=attempt_count+1,provider_acknowledgement_state='pending',updated_at=now() WHERE id=$1 RETURNING *`,[row.id])).rows[0],
    related:async(client,updated)=>{await client.query(`INSERT INTO telegram_delivery_attempts(id,delivery_id,attempt_number,channel,state) VALUES($1,$2,$3,$4,'persisted')`,[attemptId,row.id,updated.attempt_count,row.channel]);},
    details:(updated)=>({attemptNumber:updated.attempt_count,channel:row.channel}),
  });
  if(!delivering)return (await listDeliveryRequests(row.user_id,row.id))[0];
  let providerAcknowledged=false;
  try{
    const reference=await sendProvider(row,artifact,transport,linkUrl);
    providerAcknowledged=true;
    if(process.env.TELEGRAM_PRODUCT_CRASH_AFTER_PROVIDER_ACK==="1")throw new Error("SIMULATED_CRASH_AFTER_PROVIDER_ACK");
    const delivered=await transitionDelivery({
      deliveryId:row.id, expected:"delivering", next:"delivered", actorUserId:row.user_id,
      eventType:"provider_acknowledged", reason:"provider_returned_acknowledgement", faultPrefix:"delivered",
      update:async(client)=>(await client.query<DeliveryRow>(`UPDATE telegram_delivery_requests SET status='delivered',provider_acknowledgement_state='acknowledged',provider_reference=$2,delivered_at=now(),failure_category=NULL,updated_at=now() WHERE id=$1 RETURNING *`,[row.id,reference])).rows[0],
      related:async(client)=>{await client.query(`UPDATE telegram_delivery_attempts SET state='acknowledged',provider_reference=$2,completed_at=now() WHERE id=$1`,[attemptId,reference]);},
      details:()=>({providerReference:reference}),
    });
    return publicDelivery(delivered || delivering);
  }catch(error){
    if(providerAcknowledged)throw error;
    const category=isUnknownProviderOutcome(error)?"delivery_unknown":error instanceof TelegramProductError?error.code.toLowerCase():"provider_unavailable";
    await persistFailure(delivering,attemptId,category,"delivering");throw error;
  }
}

export async function recoverAbandonedDeliveryAttempts():Promise<number>{
  const rawStaleMs=Number(process.env.TELEGRAM_PRODUCT_RECOVERY_STALE_MS||60_000);
  const staleMs=Number.isSafeInteger(rawStaleMs)&&rawStaleMs>=0?rawStaleMs:60_000;
  const rows=await pool.query<{id:string;status:DeliveryStatus}>(`SELECT d.id,d.status FROM telegram_delivery_requests d WHERE d.status IN ('preparing','ready','delivering') AND d.updated_at<=now()-($1::text||' milliseconds')::interval ORDER BY d.created_at`,[staleMs]);
  let recovered=0;
  for(const item of rows.rows){
    const current=(await pool.query<DeliveryRow>(`SELECT * FROM telegram_delivery_requests WHERE id=$1`,[item.id])).rows[0];
    if(!current)continue;
    const unknown=current.status==="delivering";
    const category=unknown?"delivery_unknown":current.status==="preparing"?"preparation_abandoned":"ready_abandoned";
    const updated=await transitionDelivery({
      deliveryId:item.id,expected:current.status,next:"failed",actorUserId:current.user_id,
      eventType:unknown?"delivery_unknown_recovered":current.status==="preparing"?"stale_preparing_recovered":"stale_ready_recovered",
      reason:unknown?"abandoned_in_flight_attempt_after_restart":"stale_pre_provider_state_failed_safely",faultPrefix:"recovery",
      update:async(client)=>(await client.query<DeliveryRow>(`UPDATE telegram_delivery_requests SET status='failed',failure_category=$2,provider_acknowledgement_state=$3,updated_at=now() WHERE id=$1 RETURNING *`,[item.id,category,unknown?"unknown":"not_contacted"])).rows[0],
      related:unknown?async(client)=>{await client.query(`UPDATE telegram_delivery_attempts SET state='unknown',failure_category='delivery_unknown',completed_at=now() WHERE delivery_id=$1 AND state='persisted'`,[item.id]);}:undefined,
      details:()=>({automaticRetry:false,humanReviewRequired:unknown,providerContactPossible:unknown}),
    });
    if(updated)recovered+=1;
  }
  return recovered;
}

export async function listDeliveryRequests(userId:number,deliveryId?:string){
  const result=await pool.query<DeliveryRow>(`SELECT * FROM telegram_delivery_requests WHERE user_id=$1 ${deliveryId?"AND id=$2":""} ORDER BY created_at DESC LIMIT 100`,deliveryId?[userId,deliveryId]:[userId]);
  return result.rows.map(publicDelivery);
}

export async function readSecureDeliveryLink(token:string,userId:number,transport:ProviderTransport=fetch):Promise<Artifact>{
  const config=getTelegramProductConfig(); const tokenHmac=hmacValue(config,`delivery-link:${safeText(token,200)}`);
  const result=await pool.query<DeliveryRow & {link_id:string;link_expires_at:Date;audience_user_id:number}>(`SELECT d.*,l.id AS link_id,l.expires_at AS link_expires_at,l.audience_user_id FROM telegram_delivery_links l JOIN telegram_delivery_requests d ON d.id=l.delivery_id WHERE l.token_hmac=$1 AND l.status='active'`,[tokenHmac]);
  const row=result.rows[0]; if(!row)throw new TelegramProductError(404,"DELIVERY_LINK_NOT_FOUND","Secure delivery link not found.");
  const auditLink=async(eventType:string,success:boolean,hash:string|null)=>{await pool.query(`INSERT INTO telegram_delivery_events(id,delivery_id,actor_user_id,from_status,to_status,event_type,reason,safe_details) VALUES($1,$2,$3,$4,$4,$5,$6,$7::jsonb)`,[crypto.randomUUID(),row.id,userId,row.status,eventType,success?"secure_link_access_authorized":"secure_link_access_rejected",JSON.stringify({authenticatedUserId:userId,artifactSha256:hash,success})]);};
  if(row.audience_user_id!==userId){await auditLink("secure_link_access_wrong_user",false,row.artifact_sha256);throw new TelegramProductError(404,"DELIVERY_LINK_NOT_FOUND","Secure delivery link not found.");}
  if(row.link_expires_at.getTime()<=Date.now()){await pool.query(`UPDATE telegram_delivery_links SET status='expired' WHERE id=$1`,[row.link_id]);await auditLink("secure_link_access_expired",false,row.artifact_sha256);throw new TelegramProductError(410,"DELIVERY_LINK_EXPIRED","Secure delivery link expired.");}
  await assertProjectAccess(userId,row.project_id,"ACCESS_REVOKED"); const artifact=await generateArtifact(row,transport);
  if(row.artifact_sha256&&row.artifact_sha256!==artifact.sha256){await auditLink("secure_link_access_artifact_changed",false,artifact.sha256);throw new TelegramProductError(409,"ARTIFACT_CHANGED","The artifact changed after delivery preparation.");}
  await auditLink("secure_link_access_succeeded",true,artifact.sha256);
  return artifact;
}

export const telegramDeliveryInternals={ARTIFACTS,DELIVERY_TTL_MS,LINK_TTL_MS,capability,parseArtifactType,preparationTimeoutMs,publicDelivery};
