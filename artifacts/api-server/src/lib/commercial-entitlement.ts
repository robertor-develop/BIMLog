import crypto from "crypto";
import { pool } from "@workspace/db";

export type CommercialEntitlementState = {
  enabled: boolean;
  eventKey: string | null;
  reason: string | null;
  actorUserId: number | null;
  source: string | null;
  occurredAt: string | null;
};

type Queryable = { query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }> };

const INITIAL_EMAILS = [
  "robertor@rryasociados.com",
  "robertor@bimcorpinc.com",
  "rubenc@bimcorpgroup.com",
  "leidyp@bimcorpgroup.com",
] as const;

let ready: Promise<void> | null = null;

export function startCommercialEntitlementMigration(): Promise<void> {
  return ready ?? (ready = ensureCommercialEntitlementSchema());
}

export async function waitForCommercialEntitlementMigration(): Promise<void> {
  await startCommercialEntitlementMigration();
}

export async function ensureCommercialEntitlementSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`CREATE TABLE IF NOT EXISTS commercial_entitlement_events(
      sequence serial PRIMARY KEY,
      event_key text NOT NULL UNIQUE,
      user_id integer NOT NULL REFERENCES users(id),
      enabled boolean NOT NULL,
      reason text NOT NULL,
      actor_user_id integer REFERENCES users(id),
      source text NOT NULL,
      occurred_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT commercial_entitlement_reason_chk CHECK(length(reason) BETWEEN 3 AND 1000),
      CONSTRAINT commercial_entitlement_source_chk CHECK(source IN('super_admin','initial_bootstrap'))
    );
    CREATE INDEX IF NOT EXISTS commercial_entitlement_user_sequence_idx ON commercial_entitlement_events(user_id,sequence DESC);`);
    await client.query(`CREATE OR REPLACE FUNCTION reject_commercial_entitlement_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'commercial entitlement history is append-only'; END $$;
      DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='commercial_entitlement_events_immutable' AND tgrelid='commercial_entitlement_events'::regclass) THEN CREATE TRIGGER commercial_entitlement_events_immutable BEFORE UPDATE OR DELETE ON commercial_entitlement_events FOR EACH ROW EXECUTE FUNCTION reject_commercial_entitlement_history_mutation(); END IF; END $$;`);
    for (const email of INITIAL_EMAILS) {
      await client.query(`INSERT INTO commercial_entitlement_events(event_key,user_id,enabled,reason,actor_user_id,source)
        SELECT $1,u.id,true,'Initial owner-approved Commercial access',NULL,'initial_bootstrap' FROM users u WHERE lower(u.email)=$2
        ON CONFLICT(event_key) DO NOTHING`, [`initial-commercial:${email}`, email]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    ready = null;
    throw error;
  } finally {
    client.release();
  }
}

export async function commercialEntitlementForUser(userId: number, client: Queryable = pool): Promise<CommercialEntitlementState> {
  await waitForCommercialEntitlementMigration();
  const result = await client.query(`SELECT event_key,enabled,reason,actor_user_id,source,occurred_at FROM commercial_entitlement_events WHERE user_id=$1 ORDER BY sequence DESC LIMIT 1`, [userId]);
  const row = result.rows[0];
  return row ? { enabled: row.enabled === true, eventKey: row.event_key, reason: row.reason, actorUserId: row.actor_user_id == null ? null : Number(row.actor_user_id), source: row.source, occurredAt: new Date(row.occurred_at).toISOString() } : { enabled: false, eventKey: null, reason: null, actorUserId: null, source: null, occurredAt: null };
}

export async function setCommercialEntitlement(input: { actorUserId: number; userId: number; enabled: boolean; reason: unknown }) {
  await waitForCommercialEntitlementMigration();
  const reason = String(input.reason ?? "").trim();
  if (reason.length < 3 || reason.length > 1000 || /[\u0000-\u001f\u007f]/.test(reason)) throw new Error("Reason must be 3 to 1000 characters of plain text.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock($1)`, [input.userId]);
    const target = await client.query(`SELECT id FROM users WHERE id=$1`, [input.userId]);
    if (!target.rows[0]) throw new Error("User not found.");
    const currentResult = await client.query(`SELECT event_key,enabled,reason,actor_user_id,source,occurred_at FROM commercial_entitlement_events WHERE user_id=$1 ORDER BY sequence DESC LIMIT 1`, [input.userId]);
    const currentRow = currentResult.rows[0];
    if ((currentRow?.enabled === true) === input.enabled && currentRow) {
      await client.query("COMMIT");
      return { enabled: currentRow.enabled === true, eventKey: currentRow.event_key, reason: currentRow.reason, actorUserId: currentRow.actor_user_id == null ? null : Number(currentRow.actor_user_id), source: currentRow.source, occurredAt: new Date(currentRow.occurred_at).toISOString(), unchanged: true };
    }
    const eventKey = crypto.randomUUID();
    const result = await client.query(`INSERT INTO commercial_entitlement_events(event_key,user_id,enabled,reason,actor_user_id,source) VALUES($1,$2,$3,$4,$5,'super_admin') RETURNING event_key,enabled,reason,actor_user_id,source,occurred_at`, [eventKey, input.userId, input.enabled, reason, input.actorUserId]);
    await client.query("COMMIT");
    const row = result.rows[0];
    return { enabled: row.enabled === true, eventKey: row.event_key, reason: row.reason, actorUserId: Number(row.actor_user_id), source: row.source, occurredAt: new Date(row.occurred_at).toISOString(), unchanged: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function commercialEntitlementsForUsers(userIds: number[], client: Queryable = pool) {
  await waitForCommercialEntitlementMigration();
  if (!userIds.length) return new Map<number, CommercialEntitlementState>();
  const result = await client.query(`SELECT DISTINCT ON(user_id) user_id,event_key,enabled,reason,actor_user_id,source,occurred_at FROM commercial_entitlement_events WHERE user_id=ANY($1::int[]) ORDER BY user_id,sequence DESC`, [userIds]);
  return new Map(result.rows.map((row: any) => [Number(row.user_id), { enabled: row.enabled === true, eventKey: row.event_key, reason: row.reason, actorUserId: row.actor_user_id == null ? null : Number(row.actor_user_id), source: row.source, occurredAt: new Date(row.occurred_at).toISOString() }]));
}
