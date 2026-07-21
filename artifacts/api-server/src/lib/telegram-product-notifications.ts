import crypto from "crypto";
import { pool } from "@workspace/db";
import { getTelegramProductConfig, sendVerifiedTelegramNotification, TelegramProductError } from "./telegram-product";

export type NotificationLanguage = "en" | "es";
export type NotificationFrequency = "immediate" | "daily_digest" | "weekly_digest" | "off";

export const MODULE_CATALOG = [
  { key: "rfi", en: "RFI", es: "RFI", available: true },
  { key: "submittals", en: "Submittals / Shop Drawings", es: "Submittals / Planos de Taller", available: false },
  { key: "schedule", en: "Schedule", es: "Cronograma", available: false },
  { key: "change_orders", en: "Change Orders", es: "Órdenes de Cambio", available: false },
  { key: "transmittals", en: "Transmittals", es: "Transmittals", available: false },
  { key: "lens", en: "Lens / Coordination", es: "Lens / Coordinación", available: false },
  { key: "files", en: "Files / Reviews", es: "Archivos / Revisiones", available: false },
  { key: "support", en: "Support", es: "Soporte", available: true },
  { key: "delivery", en: "Delivery Concierge", es: "Conserje de Entrega", available: true },
  { key: "account_security", en: "Account / Security", es: "Cuenta / Seguridad", available: true },
] as const;

export const EVENT_CATALOG = [
  ["rfi_created", "RFI created", "RFI creado"],
  ["rfi_issued", "RFI issued / sent", "RFI emitido / enviado"],
  ["rfi_assigned", "RFI assigned / BIC changed", "RFI asignado / responsabilidad actualizada"],
  ["rfi_response_added", "RFI response added", "Respuesta de RFI agregada"],
  ["rfi_response_final", "RFI final response", "Respuesta final de RFI"],
  ["rfi_due_soon", "RFI due soon", "RFI próximo a vencer"],
  ["rfi_overdue", "RFI overdue", "RFI vencido"],
  ["rfi_date_required_changed", "RFI required date changed", "Fecha requerida de RFI actualizada"],
  ["rfi_closed", "RFI closed", "RFI cerrado"],
  ["rfi_reopened", "RFI reopened", "RFI reabierto"],
  ["rfi_revised", "RFI revised", "RFI revisado"],
  ["rfi_complete_package_ready", "Complete RFI package ready", "Paquete completo de RFI listo"],
  ["assigned_to_me", "Assigned to me", "Asignado a mí"],
  ["responsibility_transferred", "Responsibility transferred to me", "Responsabilidad transferida a mí"],
  ["response_received", "Response received", "Respuesta recibida"],
  ["status_changed", "Status changed", "Estado cambiado"],
  ["due_soon", "Due soon", "Vence pronto"],
  ["overdue", "Overdue", "Vencido"],
  ["closed", "Closed", "Cerrado"],
  ["reopened", "Reopened", "Reabierto"],
  ["revision_created", "Revision created", "Revisión creada"],
  ["approval_required", "Approval required", "Aprobación requerida"],
  ["approval_completed", "Approval completed", "Aprobación completada"],
  ["rejected", "Rejected", "Rechazado"],
  ["support_case_update", "Support-case update", "Actualización de soporte"],
  ["delivery_ready", "Requested delivery ready", "Entrega solicitada lista"],
  ["delivery_delivered", "Requested delivery delivered", "Entrega solicitada completada"],
  ["delivery_failed", "Requested delivery failed", "Entrega solicitada fallida"],
  ["account_security", "Account or Telegram-link security event", "Evento de seguridad de cuenta o Telegram"],
] as const;

const FREQUENCIES = new Set(["immediate", "daily_digest", "weekly_digest", "off"]);
const OVERDUE = new Set(["once", "daily", "weekly", "off"]);
const STATES = new Set(["received", "suppressed_by_preference", "suppressed_by_authorization", "scheduled", "deferred_quiet_hours", "digest_pending", "delivering", "delivered", "failed", "unknown", "cancelled", "expired"]);

function safeText(value: unknown, max = 240): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function timeValue(value: unknown): string | null {
  if (value == null || value === "") return null;
  const text = String(value);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text)) throw new TelegramProductError(400, "QUIET_HOURS_INVALID", "Quiet hours must use HH:MM.");
  return text;
}

function timezoneValue(value: unknown): string {
  const zone = safeText(value, 80) || "UTC";
  try { new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date()); }
  catch { throw new TelegramProductError(400, "TIMEZONE_INVALID", "Timezone must be a valid IANA timezone."); }
  return zone;
}

function frequencyValue(value: unknown): NotificationFrequency {
  const frequency = safeText(value, 30) || "off";
  if (!FREQUENCIES.has(frequency)) throw new TelegramProductError(400, "FREQUENCY_INVALID", "Notification frequency is invalid.");
  return frequency as NotificationFrequency;
}

export async function ensureTelegramNotificationSchema(): Promise<void> {
  const statements = [
    `ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS paused boolean NOT NULL DEFAULT false`,
    `ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC'`,
    `ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS quiet_hours_start time`,
    `ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS quiet_hours_end time`,
    `ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS delivery_frequency text NOT NULL DEFAULT 'off'`,
    `ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS digest_cadence text NOT NULL DEFAULT 'daily'`,
    `ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS telegram_enabled boolean NOT NULL DEFAULT false`,
    `ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS email_enabled boolean NOT NULL DEFAULT false`,
    `ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS overdue_frequency text NOT NULL DEFAULT 'off'`,
    `ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS project_mode text NOT NULL DEFAULT 'all_authorized'`,
    `ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS updated_by_user_id integer REFERENCES users(id)`,
    `ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS update_source text NOT NULL DEFAULT 'system'`,
    `CREATE TABLE IF NOT EXISTS telegram_notification_project_preferences (
      id bigserial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), project_id integer NOT NULL REFERENCES projects(id), enabled boolean NOT NULL,
      updated_by_user_id integer REFERENCES users(id), update_source text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE UNIQUE INDEX IF NOT EXISTS telegram_notification_project_user_uidx ON telegram_notification_project_preferences(user_id,project_id)`,
    `CREATE INDEX IF NOT EXISTS telegram_notification_project_project_idx ON telegram_notification_project_preferences(project_id,user_id)`,
    `CREATE TABLE IF NOT EXISTS telegram_notification_module_preferences (
      id bigserial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), module_key text NOT NULL, enabled boolean NOT NULL,
      updated_by_user_id integer REFERENCES users(id), update_source text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
    `ALTER TABLE telegram_notification_module_preferences ADD COLUMN IF NOT EXISTS delivery_frequency text`,
    `CREATE UNIQUE INDEX IF NOT EXISTS telegram_notification_module_user_uidx ON telegram_notification_module_preferences(user_id,module_key)`,
    `CREATE TABLE IF NOT EXISTS telegram_notification_event_preferences (
      id bigserial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), event_key text NOT NULL, enabled boolean NOT NULL,
      updated_by_user_id integer REFERENCES users(id), update_source text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE UNIQUE INDEX IF NOT EXISTS telegram_notification_event_user_uidx ON telegram_notification_event_preferences(user_id,event_key)`,
    `CREATE TABLE IF NOT EXISTS telegram_notification_outbox (
      id text PRIMARY KEY, canonical_event_id text NOT NULL, company_id integer NOT NULL REFERENCES companies(id), project_id integer REFERENCES projects(id),
      user_id integer NOT NULL REFERENCES users(id), module_key text NOT NULL, event_key text NOT NULL, source_record_type text NOT NULL,
      source_record_id text NOT NULL, channel text NOT NULL, delivery_frequency text NOT NULL, digest_window_key text NOT NULL DEFAULT '',
      template_data jsonb NOT NULL DEFAULT '{}'::jsonb, authorization_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
      preference_decision jsonb NOT NULL DEFAULT '{}'::jsonb, scheduled_for timestamptz NOT NULL DEFAULT now(), state text NOT NULL,
      attempt_count integer NOT NULL DEFAULT 0, provider_acknowledgement_id text, failure_category text, security_critical boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS telegram_notification_outbox_idempotency_uidx ON telegram_notification_outbox(user_id,canonical_event_id,channel,delivery_frequency,digest_window_key)`,
    `CREATE INDEX IF NOT EXISTS telegram_notification_outbox_claim_idx ON telegram_notification_outbox(state,scheduled_for,created_at)`,
    `CREATE INDEX IF NOT EXISTS telegram_notification_outbox_user_idx ON telegram_notification_outbox(user_id,created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS telegram_notification_outbox_events (
      id text PRIMARY KEY, notification_id text NOT NULL REFERENCES telegram_notification_outbox(id), actor_user_id integer REFERENCES users(id),
      from_state text, to_state text NOT NULL, event_type text NOT NULL, reason text NOT NULL, safe_details jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE INDEX IF NOT EXISTS telegram_notification_outbox_events_idx ON telegram_notification_outbox_events(notification_id,created_at,id)`,
    `CREATE TABLE IF NOT EXISTS telegram_notification_attempts (
      id text PRIMARY KEY, notification_id text NOT NULL REFERENCES telegram_notification_outbox(id), attempt_number integer NOT NULL, channel text NOT NULL,
      state text NOT NULL, provider_acknowledgement_id text, failure_category text, started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS telegram_notification_attempts_number_uidx ON telegram_notification_attempts(notification_id,attempt_number)`,
    `CREATE TABLE IF NOT EXISTS telegram_notification_digest_windows (
      id text PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), frequency text NOT NULL, timezone text NOT NULL, window_key text NOT NULL,
      starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, scheduled_for timestamptz NOT NULL, state text NOT NULL DEFAULT 'pending',
      provider_acknowledgement_id text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS telegram_notification_digest_window_uidx ON telegram_notification_digest_windows(user_id,frequency,window_key)`,
    `CREATE TABLE IF NOT EXISTS telegram_notification_digest_members (
      digest_id text NOT NULL REFERENCES telegram_notification_digest_windows(id), notification_id text NOT NULL REFERENCES telegram_notification_outbox(id),
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(digest_id,notification_id), UNIQUE(notification_id))`,
  ];
  for (const statement of statements) await pool.query(statement);
}

async function ensurePreferenceRow(userId: number) {
  const adapterId = getTelegramProductConfig().adapterId || "telegram-product";
  await pool.query(`INSERT INTO notification_preferences(user_id,adapter_id,channel,enabled,language,topics)
    VALUES($1,$2,'telegram','false','en','{}'::jsonb) ON CONFLICT(user_id,adapter_id,channel) DO NOTHING`, [userId, adapterId]);
}

export async function getNotificationPreferenceCenter(userId: number) {
  await ensurePreferenceRow(userId);
  const adapterId = getTelegramProductConfig().adapterId || "telegram-product";
  const [settings, projects, projectOverrides, modules, events, status] = await Promise.all([
    pool.query(`SELECT enabled='true' AS enabled,paused,language,timezone,to_char(quiet_hours_start,'HH24:MI') AS quiet_hours_start,
      to_char(quiet_hours_end,'HH24:MI') AS quiet_hours_end,delivery_frequency,digest_cadence,telegram_enabled,email_enabled,
      overdue_frequency,project_mode,updated_at,update_source FROM notification_preferences WHERE user_id=$1 AND adapter_id=$2 AND channel='telegram'`, [userId, adapterId]),
    pool.query(`SELECT p.id,p.name,p.code,pm.role FROM projects p JOIN project_members pm ON pm.project_id=p.id WHERE pm.user_id=$1 AND pm.status='active' AND p.status='active' ORDER BY p.name`, [userId]),
    pool.query(`SELECT project_id,enabled FROM telegram_notification_project_preferences WHERE user_id=$1`, [userId]),
    pool.query(`SELECT module_key,enabled,delivery_frequency FROM telegram_notification_module_preferences WHERE user_id=$1`, [userId]),
    pool.query(`SELECT event_key,enabled FROM telegram_notification_event_preferences WHERE user_id=$1`, [userId]),
    pool.query(`SELECT state,provider_acknowledgement_id,failure_category,delivered_at,updated_at FROM telegram_notification_outbox WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, [userId]),
  ]);
  const row = settings.rows[0];
  const projectMap = new Map(projectOverrides.rows.map((r: any) => [Number(r.project_id), r.enabled === true]));
  const moduleMap = new Map(modules.rows.map((r: any) => [r.module_key, { enabled:r.enabled === true, frequency:r.delivery_frequency || "inherit" }]));
  const eventMap = new Map(events.rows.map((r: any) => [r.event_key, r.enabled === true]));
  const nextDigest = await pool.query(`SELECT scheduled_for FROM telegram_notification_digest_windows WHERE user_id=$1 AND state='pending' ORDER BY scheduled_for LIMIT 1`, [userId]);
  return {
    settings: { ...row, enabled: row?.enabled === true, paused: row?.paused === true, telegramEnabled: row?.telegram_enabled === true, emailEnabled: row?.email_enabled === true,
      emailAvailable: false, emailUnavailableReason: "Encrypted notification email provider credentials are not yet available.", nextScheduledDigest: nextDigest.rows[0]?.scheduled_for || null },
    projects: projects.rows.map((p: any) => ({ id: p.id, name: p.name, code: p.code, role: p.role, enabled: projectMap.has(Number(p.id)) ? projectMap.get(Number(p.id)) : true, inherited: !projectMap.has(Number(p.id)) })),
    modules: MODULE_CATALOG.map(m => { const override:any=moduleMap.get(m.key); return ({ ...m, enabled: m.available && (override?.enabled ?? true), frequency: override?.frequency || "inherit", inherited: !override || override.frequency === "inherit" }); }),
    events: EVENT_CATALOG.map(([key,en,es]) => ({ key,en,es,enabled: eventMap.get(key) ?? true,inherited: !eventMap.has(key) })),
    history: status.rows,
  };
}

export async function updateNotificationPreferenceCenter(userId: number, input: any, source = "browser") {
  const language: NotificationLanguage = input.language === "es" ? "es" : "en";
  const timezone = timezoneValue(input.timezone);
  const quietStart = timeValue(input.quietHoursStart);
  const quietEnd = timeValue(input.quietHoursEnd);
  const frequency = frequencyValue(input.frequency);
  const overdue = safeText(input.overdueFrequency, 20) || "off";
  if (!OVERDUE.has(overdue)) throw new TelegramProductError(400, "OVERDUE_FREQUENCY_INVALID", "Overdue reminder frequency is invalid.");
  if (input.emailEnabled === true) throw new TelegramProductError(409, "EMAIL_NOTIFICATION_UNAVAILABLE", "Email notifications require an approved encrypted provider credential path.");
  const projectMode = input.projectMode === "selected" ? "selected" : "all_authorized";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const adapterId = getTelegramProductConfig().adapterId || "telegram-product";
    await client.query(`INSERT INTO notification_preferences(user_id,adapter_id,channel,enabled,language,topics,paused,timezone,quiet_hours_start,quiet_hours_end,
      delivery_frequency,digest_cadence,telegram_enabled,email_enabled,overdue_frequency,project_mode,updated_by_user_id,update_source,updated_at)
      VALUES($1,$2,'telegram',$3,$4,'{}'::jsonb,$5,$6,$7,$8,$9,$10,$11,false,$12,$13,$1,$14,now())
      ON CONFLICT(user_id,adapter_id,channel) DO UPDATE SET enabled=EXCLUDED.enabled,language=EXCLUDED.language,paused=EXCLUDED.paused,timezone=EXCLUDED.timezone,
      quiet_hours_start=EXCLUDED.quiet_hours_start,quiet_hours_end=EXCLUDED.quiet_hours_end,delivery_frequency=EXCLUDED.delivery_frequency,
      digest_cadence=EXCLUDED.digest_cadence,telegram_enabled=EXCLUDED.telegram_enabled,email_enabled=false,overdue_frequency=EXCLUDED.overdue_frequency,
      project_mode=EXCLUDED.project_mode,updated_by_user_id=$1,update_source=$14,updated_at=now()`,
      [userId,adapterId,input.enabled === true ? "true" : "false",language,input.paused === true,timezone,quietStart,quietEnd,frequency,frequency === "weekly_digest" ? "weekly" : "daily",input.telegramEnabled === true,overdue,projectMode,source]);
    for (const item of Array.isArray(input.projects) ? input.projects : []) {
      const projectId = Number(item.id);
      const access = await client.query(`SELECT 1 FROM project_members pm JOIN projects p ON p.id=pm.project_id WHERE pm.user_id=$1 AND pm.project_id=$2 AND pm.status='active' AND p.status='active'`, [userId,projectId]);
      if (!access.rowCount) throw new TelegramProductError(403,"PROJECT_ACCESS_REQUIRED","Current project membership is required.");
      await client.query(`INSERT INTO telegram_notification_project_preferences(user_id,project_id,enabled,updated_by_user_id,update_source) VALUES($1,$2,$3,$1,$4)
        ON CONFLICT(user_id,project_id) DO UPDATE SET enabled=EXCLUDED.enabled,updated_by_user_id=$1,update_source=$4,updated_at=now()`, [userId,projectId,item.enabled === true,source]);
    }
    for (const item of Array.isArray(input.modules) ? input.modules : []) {
      const catalog = MODULE_CATALOG.find(m => m.key === item.key);
      if (!catalog) throw new TelegramProductError(400,"MODULE_INVALID","Notification module is invalid.");
      if (item.enabled === true && !catalog.available) throw new TelegramProductError(409,"MODULE_NOT_CONNECTED","This module adapter is coming later.");
      const moduleFrequency=item.key==="rfi"&&FREQUENCIES.has(item.frequency)?item.frequency:item.frequency==="inherit"?null:null;
      await client.query(`INSERT INTO telegram_notification_module_preferences(user_id,module_key,enabled,delivery_frequency,updated_by_user_id,update_source) VALUES($1,$2,$3,$4,$1,$5)
        ON CONFLICT(user_id,module_key) DO UPDATE SET enabled=EXCLUDED.enabled,delivery_frequency=EXCLUDED.delivery_frequency,updated_by_user_id=$1,update_source=$5,updated_at=now()`, [userId,item.key,item.enabled === true,moduleFrequency,source]);
    }
    for (const item of Array.isArray(input.events) ? input.events : []) {
      if (!EVENT_CATALOG.some(e => e[0] === item.key)) throw new TelegramProductError(400,"EVENT_INVALID","Notification event is invalid.");
      await client.query(`INSERT INTO telegram_notification_event_preferences(user_id,event_key,enabled,updated_by_user_id,update_source) VALUES($1,$2,$3,$1,$4)
        ON CONFLICT(user_id,event_key) DO UPDATE SET enabled=EXCLUDED.enabled,updated_by_user_id=$1,update_source=$4,updated_at=now()`, [userId,item.key,item.enabled === true,source]);
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
  return getNotificationPreferenceCenter(userId);
}

export async function setNotificationsPaused(userId: number, paused: boolean, source: string) {
  await ensurePreferenceRow(userId);
  await pool.query(`UPDATE notification_preferences SET paused=$2,updated_by_user_id=$1,update_source=$3,updated_at=now() WHERE user_id=$1 AND channel='telegram'`, [userId,paused,source]);
  return getNotificationPreferenceCenter(userId);
}

function localParts(date: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23",weekday:"short" }).formatToParts(date);
  return Object.fromEntries(parts.map(p => [p.type,p.value]));
}

export function isQuietNow(now: Date, zone: string, start: string | null, end: string | null): boolean {
  if (!start || !end || start === end) return false;
  const p = localParts(now,zone); const current=`${p.hour}:${p.minute}`;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

export function digestWindowKey(date: Date, zone: string, frequency: NotificationFrequency): string {
  const p=localParts(date,zone); const day=`${p.year}-${p.month}-${p.day}`;
  if (frequency !== "weekly_digest") return day;
  const d=new Date(`${day}T12:00:00Z`); const shift=(d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-shift);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
}

function zonedMidnightUtc(localDate: string, zone: string): Date {
  const [year,month,day]=localDate.split("-").map(Number); let guess=Date.UTC(year,month-1,day,0,0);
  for(let i=0;i<3;i++){const p=localParts(new Date(guess),zone);const represented=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute));guess+=Date.UTC(year,month-1,day,0,0)-represented;}
  return new Date(guess);
}

function digestBounds(now: Date, zone: string, frequency: NotificationFrequency) {
  const key=digestWindowKey(now,zone,frequency); const start=zonedMidnightUtc(key,zone); const endLocal=new Date(`${key}T12:00:00Z`);endLocal.setUTCDate(endLocal.getUTCDate()+(frequency==="weekly_digest"?7:1));
  const endKey=`${endLocal.getUTCFullYear()}-${String(endLocal.getUTCMonth()+1).padStart(2,"0")}-${String(endLocal.getUTCDate()).padStart(2,"0")}`;const end=zonedMidnightUtc(endKey,zone);
  return {key,start,end,scheduledFor:end};
}

async function transition(client: any, id: string, from: string | null, to: string, reason: string, details: Record<string,unknown>={}) {
  if (!STATES.has(to)) throw new Error("invalid outbox state");
  await client.query(`INSERT INTO telegram_notification_outbox_events(id,notification_id,from_state,to_state,event_type,reason,safe_details) VALUES($1,$2,$3,$4,'state_changed',$5,$6::jsonb)`, [crypto.randomUUID(),id,from,to,reason,JSON.stringify(details)]);
}

function effectiveFrequencyFor(prefs:any,moduleKey:string):NotificationFrequency {
  const module=(prefs.modules as any[]).find(item=>item.key===moduleKey);
  return ((module?.frequency&&module.frequency!=="inherit")?module.frequency:prefs.settings.delivery_frequency||"off") as NotificationFrequency;
}

export async function acceptNotificationEvent(input: { canonicalEventId:string; companyId:number; projectId?:number|null; userId:number; moduleKey:string; eventKey:string; sourceRecordType:string; sourceRecordId:string; templateData:{en:string;es:string}; securityCritical?:boolean; watchRequired?:boolean }) {
  const moduleItem=MODULE_CATALOG.find(m=>m.key===input.moduleKey);
  if(!moduleItem?.available) throw new TelegramProductError(409,"MODULE_NOT_CONNECTED","The module adapter is not connected.");
  if(!EVENT_CATALOG.some(e=>e[0]===input.eventKey)) throw new TelegramProductError(400,"EVENT_INVALID","Notification event is invalid.");
  const prefs=await getNotificationPreferenceCenter(input.userId); const s:any=prefs.settings;
  const user=await pool.query(`SELECT company_id FROM users WHERE id=$1`,[input.userId]);
  if(Number(user.rows[0]?.company_id)!==Number(input.companyId)) throw new TelegramProductError(403,"TENANT_ACCESS_REJECTED","Notification tenant does not match the user.");
  let authorized=true;
  if(input.projectId){const a=await pool.query(`SELECT 1 FROM project_members WHERE user_id=$1 AND project_id=$2 AND status='active'`,[input.userId,input.projectId]);authorized=Boolean(a.rowCount);}
  const moduleSetting=(prefs.modules as any[]).find(m=>m.key===input.moduleKey);const modulePref=moduleSetting?.enabled===true;
  const eventPref=(prefs.events as any[]).find(e=>e.key===input.eventKey)?.enabled===true;
  const projectPref=!input.projectId||(prefs.projects as any[]).find(p=>Number(p.id)===Number(input.projectId))?.enabled===true;
  let overdueCadenceAllowed=true;
  if(input.eventKey==="rfi_overdue"){
    const cadence=String(s.overdue_frequency||"off");
    if(cadence==="off")overdueCadenceAllowed=false;
    else if(cadence==="once"||cadence==="weekly"){
      const previous=await pool.query(`SELECT 1 FROM telegram_notification_outbox WHERE user_id=$1 AND module_key='rfi' AND event_key='rfi_overdue' AND source_record_id=$2
        AND state NOT IN ('suppressed_by_preference','suppressed_by_authorization','cancelled','expired') AND ($3='once' OR created_at>=now()-interval '7 days') LIMIT 1`,[input.userId,safeText(input.sourceRecordId,160),cadence]);
      overdueCadenceAllowed=!previous.rowCount;
    }
  }
  let state="scheduled"; let reason="accepted";
  if(!authorized){state="suppressed_by_authorization";reason="project_access_missing";}
  const effectiveFrequency=((moduleSetting?.frequency&&moduleSetting.frequency!=="inherit")?moduleSetting.frequency:s.delivery_frequency) as NotificationFrequency;
  if(state==="scheduled"&&(!s.enabled||s.paused||!s.telegramEnabled||effectiveFrequency==="off"||!modulePref||!eventPref||!projectPref||!overdueCadenceAllowed)){state="suppressed_by_preference";reason=overdueCadenceAllowed?"preference_disabled":"overdue_cadence_suppressed";}
  else if(state==="scheduled"&&effectiveFrequency!=="immediate"){state="digest_pending";reason="digest_selected";}
  else if(state==="scheduled"&&!input.securityCritical&&isQuietNow(new Date(),s.timezone,s.quiet_hours_start,s.quiet_hours_end)){state="deferred_quiet_hours";reason="quiet_hours";}
  const frequency=(effectiveFrequency||"off") as NotificationFrequency;
  const windowKey=frequency.includes("digest")?digestWindowKey(new Date(),s.timezone,frequency):"";
  const id=crypto.randomUUID(); const canonical=safeText(input.canonicalEventId,200); if(!canonical)throw new TelegramProductError(400,"EVENT_ID_REQUIRED","Stable event ID is required.");
  const client=await pool.connect();
  try{await client.query("BEGIN");const inserted=await client.query(`INSERT INTO telegram_notification_outbox(id,canonical_event_id,company_id,project_id,user_id,module_key,event_key,source_record_type,source_record_id,channel,delivery_frequency,digest_window_key,template_data,authorization_snapshot,preference_decision,state,security_critical)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'telegram',$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16)
      ON CONFLICT(user_id,canonical_event_id,channel,delivery_frequency,digest_window_key) DO NOTHING RETURNING *`,[id,canonical,input.companyId,input.projectId||null,input.userId,input.moduleKey,input.eventKey,safeText(input.sourceRecordType,80),safeText(input.sourceRecordId,160),frequency,windowKey,JSON.stringify({en:safeText(input.templateData.en,500),es:safeText(input.templateData.es,500)}),JSON.stringify({authorizedAt:new Date().toISOString(),projectId:input.projectId||null}),JSON.stringify({enabled:s.enabled,paused:s.paused,module:modulePref,event:eventPref,project:projectPref,watchRequired:input.watchRequired===true,overdueCadenceAllowed}),state,input.securityCritical===true]);
    if(!inserted.rowCount){await client.query("ROLLBACK");return (await pool.query(`SELECT * FROM telegram_notification_outbox WHERE user_id=$1 AND canonical_event_id=$2 AND channel='telegram' AND delivery_frequency=$3 AND digest_window_key=$4`,[input.userId,canonical,frequency,windowKey])).rows[0];}
    await transition(client,id,null,state,reason);
    if(state==="digest_pending") { const b=digestBounds(new Date(),s.timezone,frequency);const digestId=crypto.randomUUID();const window=await client.query(`INSERT INTO telegram_notification_digest_windows(id,user_id,frequency,timezone,window_key,starts_at,ends_at,scheduled_for) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(user_id,frequency,window_key) DO UPDATE SET updated_at=now() RETURNING id`,[digestId,input.userId,frequency,s.timezone,b.key,b.start,b.end,b.scheduledFor]);await client.query(`INSERT INTO telegram_notification_digest_members(digest_id,notification_id) VALUES($1,$2) ON CONFLICT(notification_id) DO NOTHING`,[window.rows[0].id,id]);}
    await client.query("COMMIT");return inserted.rows[0];
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}

export async function processNotificationOutbox(limit=25) {
  const claimed:any[]=[]; const client=await pool.connect();
  try{await client.query("BEGIN"); const rows=await client.query(`SELECT * FROM telegram_notification_outbox WHERE state IN ('scheduled','deferred_quiet_hours') AND scheduled_for<=now() ORDER BY scheduled_for,id FOR UPDATE SKIP LOCKED LIMIT $1`,[limit]);
    for(const row of rows.rows){
      if(row.state==="deferred_quiet_hours"){const p=await getNotificationPreferenceCenter(row.user_id);const s:any=p.settings;if(isQuietNow(new Date(),s.timezone,s.quiet_hours_start,s.quiet_hours_end))continue;}
      const access=row.project_id?await client.query(`SELECT 1 FROM project_members WHERE user_id=$1 AND project_id=$2 AND status='active'`,[row.user_id,row.project_id]):{rowCount:1};
      const channel=await client.query(`SELECT 1 FROM notification_channels WHERE user_id=$1 AND adapter_id=$2 AND provider='telegram' AND status='connected'`,[row.user_id,getTelegramProductConfig().adapterId]);
      if(!access.rowCount||!channel.rowCount){const next=!access.rowCount?"suppressed_by_authorization":"cancelled";await client.query(`UPDATE telegram_notification_outbox SET state=$2,updated_at=now(),failure_category=$3 WHERE id=$1`,[row.id,next,!access.rowCount?"AUTHORIZATION_REVOKED":"CHANNEL_REVOKED"]);await transition(client,row.id,row.state,next,"delivery_recheck_failed");continue;}
      const p=await getNotificationPreferenceCenter(row.user_id);const s:any=p.settings;const module=(p.modules as any[]).find(x=>x.key===row.module_key);const event=(p.events as any[]).find(x=>x.key===row.event_key);const project=!row.project_id||(p.projects as any[]).find(x=>Number(x.id)===Number(row.project_id))?.enabled===true;const watchRequired=row.preference_decision?.watchRequired===true;const watch=watchRequired?await client.query(`SELECT 1 FROM telegram_rfi_notification_watches WHERE user_id=$1 AND rfi_id=$2 AND enabled=true`,[row.user_id,Number(row.source_record_id)]):{rowCount:1};
      const frequencyMatches=effectiveFrequencyFor(p,row.module_key)===row.delivery_frequency;
      if(!s.enabled||s.paused||!s.telegramEnabled||module?.enabled!==true||event?.enabled!==true||!project||!watch.rowCount||!frequencyMatches){await client.query(`UPDATE telegram_notification_outbox SET state='suppressed_by_preference',updated_at=now() WHERE id=$1`,[row.id]);await transition(client,row.id,row.state,"suppressed_by_preference","preference_recheck_failed",{module:module?.enabled===true,event:event?.enabled===true,project,watch:Boolean(watch.rowCount),frequencyMatches});continue;}
      await client.query(`UPDATE telegram_notification_outbox SET state='delivering',attempt_count=attempt_count+1,updated_at=now() WHERE id=$1`,[row.id]);await transition(client,row.id,row.state,"delivering","transactional_claim");claimed.push({...row,attempt_number:Number(row.attempt_count)+1,language:s.language});
    } await client.query("COMMIT");
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
  let delivered=0;
  for(const row of claimed){const attemptId=crypto.randomUUID();await pool.query(`INSERT INTO telegram_notification_attempts(id,notification_id,attempt_number,channel,state) VALUES($1,$2,$3,'telegram','persisted')`,[attemptId,row.id,row.attempt_number]);
    try{const text=row.language==="es"?row.template_data.es:row.template_data.en;const acknowledgement=await sendVerifiedTelegramNotification(row.user_id,`BIMLog${row.event_key==="test_notification"?" TEST":""}\n${safeText(text,500)}`);
      if(!acknowledgement)throw new TelegramProductError(502,"TELEGRAM_INVALID_RESPONSE","Provider acknowledgement missing.");
      const c=await pool.connect();try{await c.query("BEGIN");await c.query(`UPDATE telegram_notification_attempts SET state='acknowledged',provider_acknowledgement_id=$2,completed_at=now() WHERE id=$1`,[attemptId,acknowledgement]);await c.query(`UPDATE telegram_notification_outbox SET state='delivered',provider_acknowledgement_id=$2,delivered_at=now(),updated_at=now() WHERE id=$1`,[row.id,acknowledgement]);await transition(c,row.id,"delivering","delivered","provider_acknowledged");await c.query("COMMIT");delivered++;}catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
    }catch(error:any){const unknown=error?.name==="AbortError"||error?.name==="TimeoutError"||error?.code==="ETIMEDOUT";const next=unknown?"unknown":"failed";const category=unknown?"PROVIDER_OUTCOME_UNKNOWN":error instanceof TelegramProductError?error.code:"PROVIDER_REJECTED";const c=await pool.connect();try{await c.query("BEGIN");await c.query(`UPDATE telegram_notification_attempts SET state=$2,failure_category=$3,completed_at=now() WHERE id=$1`,[attemptId,next,category]);await c.query(`UPDATE telegram_notification_outbox SET state=$2,failure_category=$3,updated_at=now() WHERE id=$1`,[row.id,next,category]);await transition(c,row.id,"delivering",next,"provider_result",{category});await c.query("COMMIT");}catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}}
  }
  return {claimed:claimed.length,delivered};
}

export async function processNotificationDigests(limit=10) {
  const windows=await pool.query(`SELECT * FROM telegram_notification_digest_windows WHERE state='pending' AND scheduled_for<=now() ORDER BY scheduled_for,id LIMIT $1`,[limit]);let delivered=0;
  for(const window of windows.rows as any[]){const client=await pool.connect();let members:any[]=[];try{await client.query("BEGIN");const claimed=await client.query(`UPDATE telegram_notification_digest_windows SET state='delivering',updated_at=now() WHERE id=$1 AND state='pending' RETURNING *`,[window.id]);if(!claimed.rowCount){await client.query("ROLLBACK");continue;}
      const rows=await client.query(`SELECT o.* FROM telegram_notification_digest_members m JOIN telegram_notification_outbox o ON o.id=m.notification_id WHERE m.digest_id=$1 AND o.state='digest_pending' ORDER BY o.project_id,o.module_key,o.created_at,o.id FOR UPDATE`,[window.id]);
      for(const row of rows.rows as any[]){const access=row.project_id?await client.query(`SELECT 1 FROM project_members WHERE user_id=$1 AND project_id=$2 AND status='active'`,[row.user_id,row.project_id]):{rowCount:1};if(!access.rowCount){await client.query(`UPDATE telegram_notification_outbox SET state='suppressed_by_authorization',failure_category='AUTHORIZATION_REVOKED',updated_at=now() WHERE id=$1`,[row.id]);await transition(client,row.id,"digest_pending","suppressed_by_authorization","digest_authorization_recheck");continue;}const channel=await client.query(`SELECT 1 FROM notification_channels WHERE user_id=$1 AND adapter_id=$2 AND provider='telegram' AND status='connected'`,[row.user_id,getTelegramProductConfig().adapterId]);if(!channel.rowCount){await client.query(`UPDATE telegram_notification_outbox SET state='cancelled',failure_category='CHANNEL_REVOKED',updated_at=now() WHERE id=$1`,[row.id]);await transition(client,row.id,"digest_pending","cancelled","digest_channel_recheck");continue;}const p=await getNotificationPreferenceCenter(row.user_id);const s:any=p.settings;const module=(p.modules as any[]).find(x=>x.key===row.module_key);const event=(p.events as any[]).find(x=>x.key===row.event_key);const project=!row.project_id||(p.projects as any[]).find(x=>Number(x.id)===Number(row.project_id))?.enabled===true;const watchRequired=row.preference_decision?.watchRequired===true;const watch=watchRequired?await client.query(`SELECT 1 FROM telegram_rfi_notification_watches WHERE user_id=$1 AND rfi_id=$2 AND enabled=true`,[row.user_id,Number(row.source_record_id)]):{rowCount:1};const frequencyMatches=effectiveFrequencyFor(p,row.module_key)===row.delivery_frequency;if(!s.enabled||!s.telegramEnabled||module?.enabled!==true||event?.enabled!==true||!project||!watch.rowCount||!frequencyMatches){await client.query(`UPDATE telegram_notification_outbox SET state='suppressed_by_preference',updated_at=now() WHERE id=$1`,[row.id]);await transition(client,row.id,"digest_pending","suppressed_by_preference","digest_preference_recheck",{frequencyMatches});continue;}members.push(row);}
      await client.query("COMMIT");
    }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
    if(!members.length){await pool.query(`UPDATE telegram_notification_digest_windows SET state='cancelled',updated_at=now() WHERE id=$1`,[window.id]);continue;}
    const pref=await getNotificationPreferenceCenter(window.user_id);const s:any=pref.settings;if(!s.enabled||s.paused||!s.telegramEnabled){await pool.query(`UPDATE telegram_notification_digest_windows SET state='pending',updated_at=now() WHERE id=$1`,[window.id]);continue;}
    const groups=new Map<string,string[]>();for(const row of members){const key=`${row.project_id||"Account"} · ${row.module_key}`;const data=row.template_data as {en:string;es:string};const list=groups.get(key)||[];list.push(s.language==="es"?data.es:data.en);groups.set(key,list);}
    const heading=s.language==="es"?"Resumen de notificaciones BIMLog":"BIMLog notification digest";const lines=[heading,...[...groups].flatMap(([key,items])=>[`${key} (${items.length})`,...items.slice(0,5).map(item=>`- ${safeText(item,180)}`)])];
    try{const ack=await sendVerifiedTelegramNotification(window.user_id,lines.join("\n"));const c=await pool.connect();try{await c.query("BEGIN");await c.query(`UPDATE telegram_notification_digest_windows SET state='delivered',provider_acknowledgement_id=$2,delivered_at=now(),updated_at=now() WHERE id=$1`,[window.id,ack]);for(const row of members){await c.query(`UPDATE telegram_notification_outbox SET state='delivered',provider_acknowledgement_id=$2,delivered_at=now(),updated_at=now() WHERE id=$1 AND state='digest_pending'`,[row.id,ack]);await transition(c,row.id,"digest_pending","delivered","digest_provider_acknowledged",{digestId:window.id});}await c.query("COMMIT");delivered++;}catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}}
    catch(error:any){const unknown=error?.name==="AbortError"||error?.name==="TimeoutError"||error?.code==="ETIMEDOUT";await pool.query(`UPDATE telegram_notification_digest_windows SET state=$2,updated_at=now() WHERE id=$1`,[window.id,unknown?"unknown":"failed"]);}
  }
  return {processed:windows.rowCount||0,delivered};
}

export async function sendTestNotification(userId:number){
  const user=await pool.query(`SELECT company_id FROM users WHERE id=$1`,[userId]);if(!user.rows[0])throw new TelegramProductError(404,"USER_NOT_FOUND","User not found.");
  const event=await acceptNotificationEvent({canonicalEventId:`test:${crypto.randomUUID()}`,companyId:user.rows[0].company_id,userId,moduleKey:"account_security",eventKey:"account_security",sourceRecordType:"notification_test",sourceRecordId:"self",securityCritical:true,templateData:{en:"TEST — Your BIMLog product notifications are working.",es:"PRUEBA — Tus notificaciones de producto BIMLog funcionan."}});
  if(event.state==="scheduled")await processNotificationOutbox(1);return (await pool.query(`SELECT id,state,provider_acknowledgement_id,failure_category,created_at,delivered_at FROM telegram_notification_outbox WHERE id=$1`,[event.id])).rows[0];
}

export async function recoverNotificationOutbox(){const c=await pool.connect();try{await c.query("BEGIN");const rows=await c.query(`UPDATE telegram_notification_outbox SET state='unknown',failure_category='STALE_DELIVERING_MANUAL_REVIEW',updated_at=now() WHERE state='delivering' AND updated_at<now()-interval '5 minutes' RETURNING id`);for(const r of rows.rows)await transition(c,r.id,"delivering","unknown","restart_recovery_no_resend");await c.query("COMMIT");return rows.rowCount||0;}catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}}

let started=false;
export function startNotificationOutboxWorker(){if(started)return;started=true;const run=()=>Promise.all([processNotificationOutbox(),processNotificationDigests()]).catch(e=>console.error("[telegram-notifications] worker failed:",e instanceof Error?e.message:"unknown"));setTimeout(run,0);setInterval(run,30_000).unref?.();}
