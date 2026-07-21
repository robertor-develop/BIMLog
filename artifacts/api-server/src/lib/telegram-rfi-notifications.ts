import crypto from "crypto";
import { pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { acceptNotificationEvent, type NotificationFrequency } from "./telegram-product-notifications";
import { getTelegramProductConfig, TelegramProductError } from "./telegram-product";

export const RFI_NOTIFICATION_EVENTS = [
  "rfi_created", "rfi_issued", "rfi_assigned", "rfi_response_added", "rfi_response_final",
  "rfi_due_soon", "rfi_overdue", "rfi_date_required_changed", "rfi_closed", "rfi_reopened",
  "rfi_revised", "rfi_complete_package_ready",
] as const;
export type RfiNotificationEvent = typeof RFI_NOTIFICATION_EVENTS[number];

type SourceEventInput = {
  canonicalEventId: string;
  companyId: number;
  projectId: number;
  rfiId: number;
  eventKey: RfiNotificationEvent;
  actorUserId: number;
  requestingUserOnly?: boolean;
  safeDetails?: Record<string, unknown>;
};

function clean(value: unknown, max = 180): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export async function ensureTelegramRfiNotificationSchema(): Promise<void> {
  const statements = [
    `ALTER TABLE telegram_notification_module_preferences ADD COLUMN IF NOT EXISTS delivery_frequency text`,
    `CREATE TABLE IF NOT EXISTS telegram_rfi_notification_source_events (
      id text PRIMARY KEY, canonical_event_id text NOT NULL UNIQUE, company_id integer NOT NULL REFERENCES companies(id),
      project_id integer NOT NULL REFERENCES projects(id), rfi_id integer NOT NULL REFERENCES rfis(id), event_key text NOT NULL,
      actor_user_id integer NOT NULL REFERENCES users(id), requesting_user_only boolean NOT NULL DEFAULT false,
      safe_details jsonb NOT NULL DEFAULT '{}'::jsonb, state text NOT NULL DEFAULT 'pending', attempt_count integer NOT NULL DEFAULT 0,
      failure_category text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz)`,
    `CREATE INDEX IF NOT EXISTS telegram_rfi_source_claim_idx ON telegram_rfi_notification_source_events(state,created_at,id)`,
    `CREATE INDEX IF NOT EXISTS telegram_rfi_source_rfi_idx ON telegram_rfi_notification_source_events(rfi_id,created_at,id)`,
    `CREATE TABLE IF NOT EXISTS telegram_rfi_notification_source_history (
      id text PRIMARY KEY, source_event_id text NOT NULL REFERENCES telegram_rfi_notification_source_events(id),
      from_state text, to_state text NOT NULL, reason text NOT NULL, safe_details jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE INDEX IF NOT EXISTS telegram_rfi_source_history_idx ON telegram_rfi_notification_source_history(source_event_id,created_at,id)`,
    `CREATE TABLE IF NOT EXISTS telegram_rfi_notification_watches (
      id text PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), project_id integer NOT NULL REFERENCES projects(id),
      rfi_id integer NOT NULL REFERENCES rfis(id), enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE UNIQUE INDEX IF NOT EXISTS telegram_rfi_watch_user_rfi_uidx ON telegram_rfi_notification_watches(user_id,rfi_id)`,
    `CREATE INDEX IF NOT EXISTS telegram_rfi_watch_rfi_idx ON telegram_rfi_notification_watches(rfi_id,user_id)`,
  ];
  for (const statement of statements) await pool.query(statement);
}

/** Insert with the RFI mutation transaction. The recovery worker performs fan-out after commit. */
export async function recordRfiNotificationSourceEvent(tx: any, input: SourceEventInput): Promise<string> {
  const canonical = clean(input.canonicalEventId, 200);
  if (!canonical) throw new Error("Stable RFI notification event ID is required.");
  if (!RFI_NOTIFICATION_EVENTS.includes(input.eventKey)) throw new Error("Unsupported RFI notification event.");
  const id = crypto.randomUUID();
  const historyId=crypto.randomUUID();
  await tx.execute(sql`WITH inserted AS (INSERT INTO telegram_rfi_notification_source_events
    (id,canonical_event_id,company_id,project_id,rfi_id,event_key,actor_user_id,requesting_user_only,safe_details)
    VALUES (${id},${canonical},${input.companyId},${input.projectId},${input.rfiId},${input.eventKey},${input.actorUserId},${input.requestingUserOnly === true},${JSON.stringify(input.safeDetails || {})}::jsonb)
    ON CONFLICT(canonical_event_id) DO NOTHING RETURNING id)
    INSERT INTO telegram_rfi_notification_source_history(id,source_event_id,from_state,to_state,reason,safe_details)
    SELECT ${historyId},id,NULL,'pending','rfi_transaction_committed','{}'::jsonb FROM inserted`);
  return id;
}

const LABELS: Record<RfiNotificationEvent, [string, string]> = {
  rfi_created: ["created", "creado"], rfi_issued: ["issued", "enviado"], rfi_assigned: ["responsibility changed", "responsabilidad actualizada"],
  rfi_response_added: ["response added", "respuesta agregada"], rfi_response_final: ["final response added", "respuesta final agregada"],
  rfi_due_soon: ["due soon", "próximo a vencer"], rfi_overdue: ["overdue", "vencido"],
  rfi_date_required_changed: ["required date changed", "fecha requerida actualizada"], rfi_closed: ["closed", "cerrado"],
  rfi_reopened: ["reopened", "reabierto"], rfi_revised: ["revised", "revisado"],
  rfi_complete_package_ready: ["Complete RFI package is ready", "el paquete completo de RFI está listo"],
};

async function recipientsFor(event: any): Promise<Array<{userId:number;companyId:number;watchRequired:boolean}>> {
  if (event.requesting_user_only) {
    const access = await pool.query(`SELECT u.company_id FROM users u JOIN project_members pm ON pm.user_id=u.id AND pm.project_id=$2
      WHERE u.id=$1 AND u.company_id=$3 AND pm.status='active'`, [event.actor_user_id,event.project_id,event.company_id]);
    return access.rowCount ? [{userId:Number(event.actor_user_id),companyId:Number(access.rows[0].company_id),watchRequired:false}] : [];
  }
  const result = await pool.query(`SELECT DISTINCT u.id,u.company_id,
      NOT (u.id=r.created_by_id OR u.id=r.assigned_to_id OR lower(u.email)=lower(coalesce(r.submitted_by_email,'')) OR
        lower(u.email)=lower(coalesce(r.submitted_to_email,'')) OR lower(u.email)=ANY(SELECT lower(x) FROM jsonb_array_elements_text(coalesce(r.distribution_list::jsonb,'[]'::jsonb)) x)) AS watch_required
    FROM users u JOIN project_members pm ON pm.user_id=u.id AND pm.project_id=$2 AND pm.status='active'
    JOIN rfis r ON r.id=$1 AND r.project_id=$2
    LEFT JOIN telegram_rfi_notification_watches w ON w.user_id=u.id AND w.rfi_id=r.id AND w.enabled=true
    WHERE (
      u.id=r.created_by_id OR u.id=r.assigned_to_id OR w.id IS NOT NULL OR
      lower(u.email)=lower(coalesce(r.submitted_by_email,'')) OR lower(u.email)=lower(coalesce(r.submitted_to_email,'')) OR
      lower(u.email)=ANY(SELECT lower(x) FROM jsonb_array_elements_text(coalesce(r.distribution_list::jsonb,'[]'::jsonb)) x)
    ) ORDER BY u.id`, [event.rfi_id,event.project_id]);
  return result.rows.map((row: any) => ({userId:Number(row.id),companyId:Number(row.company_id),watchRequired:row.watch_required===true}));
}

export async function processRfiNotificationSourceEvents(limit = 25): Promise<{claimed:number;processed:number;failed:number}> {
  const claimedRows:any[]=[];const claimClient=await pool.connect();
  try{await claimClient.query("BEGIN");const candidates=await claimClient.query(`SELECT * FROM telegram_rfi_notification_source_events
    WHERE attempt_count<5 AND (state IN ('pending','failed') OR (state='processing' AND updated_at<now()-interval '5 minutes'))
    ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT $1`,[limit]);
    for(const candidate of candidates.rows){const changed=await claimClient.query(`UPDATE telegram_rfi_notification_source_events SET state='processing',attempt_count=attempt_count+1,failure_category=NULL,updated_at=now() WHERE id=$1 RETURNING *`,[candidate.id]);await claimClient.query(`INSERT INTO telegram_rfi_notification_source_history(id,source_event_id,from_state,to_state,reason,safe_details) VALUES($1,$2,$3,'processing',$4,'{}'::jsonb)`,[crypto.randomUUID(),candidate.id,candidate.state,candidate.state==="processing"?"stale_processing_recovery":"worker_claim"]);claimedRows.push(changed.rows[0]);}await claimClient.query("COMMIT");
  }catch(error){await claimClient.query("ROLLBACK");throw error;}finally{claimClient.release();}
  let processed = 0, failed = 0;
  for (const event of claimedRows) {
    try {
      const rfiResult = await pool.query(`SELECT r.number,r.subject,r.project_id,r.due_date,r.date_required,r.ball_in_court,p.name AS project_name,p.code AS project_code FROM rfis r JOIN projects p ON p.id=r.project_id WHERE r.id=$1 AND r.project_id=$2`, [event.rfi_id,event.project_id]);
      const rfi = rfiResult.rows[0];
      if (!rfi) throw new Error("RFI_NO_LONGER_AVAILABLE");
      const recipients = await recipientsFor(event);
      const label = LABELS[event.event_key as RfiNotificationEvent];
      const relevantDetail = ["rfi_due_soon","rfi_overdue","rfi_date_required_changed"].includes(event.event_key)
        ? clean((rfi.date_required || rfi.due_date)?.toISOString?.() || rfi.date_required || rfi.due_date,40)
        : event.event_key === "rfi_assigned" ? clean(rfi.ball_in_court,80) : "";
      const base=getTelegramProductConfig().publicBaseUrl.replace(/\/$/,"");
      const link=base?`${base}/projects/${event.project_id}/rfis`:"";
      const suffix=[relevantDetail,link].filter(Boolean).join(" · ");
      for (const recipient of recipients) await acceptNotificationEvent({
        canonicalEventId: event.canonical_event_id, companyId: recipient.companyId, projectId: event.project_id, userId:recipient.userId,
        moduleKey: "rfi", eventKey: event.event_key, sourceRecordType: "rfi", sourceRecordId: String(event.rfi_id),
        watchRequired: recipient.watchRequired,
        templateData: {
          en: `${clean(rfi.project_code,40)} · RFI ${clean(rfi.number,60)} · ${clean(rfi.subject,180)} · ${label[0]}${suffix?` · ${suffix}`:""}`,
          es: `${clean(rfi.project_code,40)} · RFI ${clean(rfi.number,60)} · ${clean(rfi.subject,180)} · ${label[1]}${suffix?` · ${suffix}`:""}`,
        },
      });
      const c = await pool.connect(); try { await c.query("BEGIN"); await c.query(`UPDATE telegram_rfi_notification_source_events SET state='processed',processed_at=now(),failure_category=null,updated_at=now() WHERE id=$1`,[event.id]); await c.query(`INSERT INTO telegram_rfi_notification_source_history(id,source_event_id,from_state,to_state,reason,safe_details) VALUES($1,$2,'processing','processed','canonical_outbox_fanout',$3::jsonb)`,[crypto.randomUUID(),event.id,JSON.stringify({recipientCount:recipients.length})]); await c.query("COMMIT"); } catch(e){await c.query("ROLLBACK");throw e;} finally{c.release();}
      processed++;
    } catch (error) {
      const category = clean(error instanceof Error ? error.message : "SOURCE_PROCESSING_FAILED", 100) || "SOURCE_PROCESSING_FAILED";
      await pool.query(`WITH changed AS (UPDATE telegram_rfi_notification_source_events SET state='failed',failure_category=$2,updated_at=now() WHERE id=$1 RETURNING id)
        INSERT INTO telegram_rfi_notification_source_history(id,source_event_id,from_state,to_state,reason,safe_details) SELECT $3,id,'processing','failed',$2,'{}'::jsonb FROM changed`,[event.id,category,crypto.randomUUID()]);
      failed++;
    }
  }
  return {claimed:claimedRows.length,processed,failed};
}

export async function scanRfiDueEvents(now = new Date()): Promise<number> {
  const inserted = await pool.query(`WITH inserted AS (INSERT INTO telegram_rfi_notification_source_events(id,canonical_event_id,company_id,project_id,rfi_id,event_key,actor_user_id,safe_details)
    SELECT gen_random_uuid()::text, 'rfi:'||r.id||':'||CASE WHEN coalesce(r.date_required,r.due_date)::date<CURRENT_DATE THEN 'overdue:'||CURRENT_DATE::text ELSE 'due-soon:'||coalesce(r.date_required,r.due_date)::date::text END,
      u.company_id,r.project_id,r.id,CASE WHEN coalesce(r.date_required,r.due_date)::date<CURRENT_DATE THEN 'rfi_overdue' ELSE 'rfi_due_soon' END,r.created_by_id,'{}'::jsonb
    FROM rfis r JOIN users u ON u.id=r.created_by_id WHERE coalesce(r.date_required,r.due_date) IS NOT NULL AND r.status NOT IN ('closed','void')
      AND coalesce(r.date_required,r.due_date)::date<=($1::timestamptz AT TIME ZONE 'UTC')::date+3
    ON CONFLICT(canonical_event_id) DO NOTHING RETURNING id)
    INSERT INTO telegram_rfi_notification_source_history(id,source_event_id,from_state,to_state,reason,safe_details)
    SELECT gen_random_uuid()::text,id,NULL,'pending','due_scanner_committed','{}'::jsonb FROM inserted RETURNING id`,[now]);
  return inserted.rowCount || 0;
}

async function requireRfiAccess(userId:number, projectId:number, rfiId:number) {
  const access=await pool.query(`SELECT r.id FROM rfis r JOIN project_members pm ON pm.project_id=r.project_id AND pm.user_id=$1 AND pm.status='active' WHERE r.id=$3 AND r.project_id=$2`,[userId,projectId,rfiId]);
  if(!access.rowCount) throw new TelegramProductError(404,"RFI_NOT_FOUND","RFI not found or access is no longer available.");
}

export async function getRfiNotificationContext(userId:number,projectId:number,rfiId:number) {
  await requireRfiAccess(userId,projectId,rfiId);
  const [watch,module,pref,channel]=await Promise.all([
    pool.query(`SELECT enabled FROM telegram_rfi_notification_watches WHERE user_id=$1 AND rfi_id=$2`,[userId,rfiId]),
    pool.query(`SELECT enabled,delivery_frequency FROM telegram_notification_module_preferences WHERE user_id=$1 AND module_key='rfi'`,[userId]),
    pool.query(`SELECT delivery_frequency FROM notification_preferences WHERE user_id=$1 AND channel='telegram' ORDER BY updated_at DESC LIMIT 1`,[userId]),
    pool.query(`SELECT 1 FROM notification_channels WHERE user_id=$1 AND adapter_id=$2 AND provider='telegram' AND status='connected'`,[userId,getTelegramProductConfig().adapterId]),
  ]);
  const moduleRow=module.rows[0]; const inherited=!moduleRow || moduleRow.delivery_frequency==null;
  return {watched:watch.rows[0]?.enabled===true,moduleFrequency:inherited?"inherit":moduleRow.delivery_frequency,effectiveFrequency:moduleRow?.enabled===false?"off":moduleRow?.delivery_frequency||pref.rows[0]?.delivery_frequency||"off",inherited,telegramConnected:Boolean(channel.rowCount),settingsPath:"/settings/notifications",setupPath:"/profile"};
}

export async function setRfiWatch(userId:number,projectId:number,rfiId:number,enabled:boolean) {
  await requireRfiAccess(userId,projectId,rfiId); await pool.query(`INSERT INTO telegram_rfi_notification_watches(id,user_id,project_id,rfi_id,enabled) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(user_id,rfi_id) DO UPDATE SET enabled=EXCLUDED.enabled,project_id=EXCLUDED.project_id,updated_at=now()`,[crypto.randomUUID(),userId,projectId,rfiId,enabled]);
  return getRfiNotificationContext(userId,projectId,rfiId);
}

export async function setRfiModuleFrequency(userId:number,value:string) {
  const allowed=new Set(["inherit","immediate","daily_digest","weekly_digest","off"]);if(!allowed.has(value))throw new TelegramProductError(400,"FREQUENCY_INVALID","RFI notification frequency is invalid.");
  await pool.query(`INSERT INTO telegram_notification_module_preferences(user_id,module_key,enabled,delivery_frequency,updated_by_user_id,update_source)
    VALUES($1,'rfi',$2,$3,$1,'browser') ON CONFLICT(user_id,module_key) DO UPDATE SET enabled=EXCLUDED.enabled,delivery_frequency=EXCLUDED.delivery_frequency,updated_by_user_id=$1,update_source='browser',updated_at=now()`,[userId,value!=="off",value==="inherit"?null:value]);
  return {moduleFrequency:value};
}

let started=false;
export function startRfiNotificationWorker(){if(started)return;started=true;const run=async()=>{await scanRfiDueEvents();await processRfiNotificationSourceEvents();};setTimeout(()=>run().catch(e=>console.error("[telegram-rfi] worker failed:",e instanceof Error?e.message:"unknown")),0);setInterval(()=>run().catch(e=>console.error("[telegram-rfi] worker failed:",e instanceof Error?e.message:"unknown")),60_000).unref?.();}
