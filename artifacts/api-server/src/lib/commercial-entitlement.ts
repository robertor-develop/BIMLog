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

export const COMMERCIAL_FEATURES = ["package", "budget", "contracts", "cost_value_planner"] as const;
export type CommercialFeature = (typeof COMMERCIAL_FEATURES)[number];
export type EffectiveCommercialAccess = Record<CommercialFeature, boolean> & {
  any: boolean;
  fullActivation: boolean;
};

type Queryable = { query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }> };

function feature(value: unknown): CommercialFeature {
  const result = String(value ?? "package") as CommercialFeature;
  if (!COMMERCIAL_FEATURES.includes(result)) throw new Error("Commercial feature is invalid.");
  return result;
}

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
      feature_key text NOT NULL DEFAULT 'package',
      occurred_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT commercial_entitlement_reason_chk CHECK(length(reason) BETWEEN 3 AND 1000),
      CONSTRAINT commercial_entitlement_source_chk CHECK(source IN('super_admin','initial_bootstrap'))
    );
    ALTER TABLE commercial_entitlement_events ADD COLUMN IF NOT EXISTS feature_key text NOT NULL DEFAULT 'package';
    CREATE INDEX IF NOT EXISTS commercial_entitlement_user_sequence_idx ON commercial_entitlement_events(user_id,sequence DESC);
    CREATE INDEX IF NOT EXISTS commercial_entitlement_user_feature_sequence_idx ON commercial_entitlement_events(user_id,feature_key,sequence DESC);`);
    await client.query(`CREATE OR REPLACE FUNCTION reject_commercial_entitlement_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'commercial entitlement history is append-only'; END $$;
      DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='commercial_entitlement_events_immutable' AND tgrelid='commercial_entitlement_events'::regclass) THEN CREATE TRIGGER commercial_entitlement_events_immutable BEFORE UPDATE OR DELETE ON commercial_entitlement_events FOR EACH ROW EXECUTE FUNCTION reject_commercial_entitlement_history_mutation(); END IF; END $$;`);
    for (const featureKey of COMMERCIAL_FEATURES) {
      await client.query(`INSERT INTO commercial_entitlement_events(event_key,user_id,enabled,reason,actor_user_id,source,feature_key)
        SELECT 'initial-commercial:'||$1||':'||u.id,u.id,true,'Initial owner-approved Commercial access for all current users',NULL,'initial_bootstrap',$1
        FROM users u ON CONFLICT(event_key) DO NOTHING`, [featureKey]);
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

export async function commercialEntitlementForUser(userId: number, client: Queryable = pool, featureKey: CommercialFeature = "package"): Promise<CommercialEntitlementState> {
  await waitForCommercialEntitlementMigration();
  const result = await client.query(`SELECT event_key,enabled,reason,actor_user_id,source,occurred_at FROM commercial_entitlement_events WHERE user_id=$1 AND feature_key=$2 ORDER BY sequence DESC LIMIT 1`, [userId, feature(featureKey)]);
  const row = result.rows[0];
  return row ? { enabled: row.enabled === true, eventKey: row.event_key, reason: row.reason, actorUserId: row.actor_user_id == null ? null : Number(row.actor_user_id), source: row.source, occurredAt: new Date(row.occurred_at).toISOString() } : { enabled: false, eventKey: null, reason: null, actorUserId: null, source: null, occurredAt: null };
}

export async function effectiveCommercialAccessForUser(userId: number, client: Queryable = pool): Promise<EffectiveCommercialAccess> {
  const [packageState, budgetState, contractsState, plannerState] = await Promise.all([
    commercialEntitlementForUser(userId, client, "package"),
    commercialEntitlementForUser(userId, client, "budget"),
    commercialEntitlementForUser(userId, client, "contracts"),
    commercialEntitlementForUser(userId, client, "cost_value_planner"),
  ]);
  const packageEnabled = packageState.enabled;
  const budget = packageEnabled || budgetState.enabled;
  const contracts = packageEnabled || contractsState.enabled;
  const costValuePlanner = packageEnabled || plannerState.enabled;
  return {
    package: packageEnabled,
    budget,
    contracts,
    cost_value_planner: costValuePlanner,
    any: budget || contracts || costValuePlanner,
    fullActivation: budget && contracts && costValuePlanner,
  };
}

export async function setCommercialEntitlement(input: { actorUserId: number; userId: number; enabled: boolean; reason: unknown; featureKey?: unknown }) {
  await waitForCommercialEntitlementMigration();
  const reason = String(input.reason ?? "").trim();
  const featureKey = feature(input.featureKey);
  if (reason.length < 3 || reason.length > 1000 || /[\u0000-\u001f\u007f]/.test(reason)) throw new Error("Reason must be 3 to 1000 characters of plain text.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock($1)`, [input.userId]);
    const target = await client.query(`SELECT id FROM users WHERE id=$1`, [input.userId]);
    if (!target.rows[0]) throw new Error("User not found.");
    const currentResult = await client.query(`SELECT event_key,enabled,reason,actor_user_id,source,occurred_at FROM commercial_entitlement_events WHERE user_id=$1 AND feature_key=$2 ORDER BY sequence DESC LIMIT 1`, [input.userId, featureKey]);
    const currentRow = currentResult.rows[0];
    if ((currentRow?.enabled === true) === input.enabled && currentRow) {
      await client.query("COMMIT");
      return { enabled: currentRow.enabled === true, eventKey: currentRow.event_key, reason: currentRow.reason, actorUserId: currentRow.actor_user_id == null ? null : Number(currentRow.actor_user_id), source: currentRow.source, occurredAt: new Date(currentRow.occurred_at).toISOString(), unchanged: true };
    }
    const eventKey = crypto.randomUUID();
    const result = await client.query(`INSERT INTO commercial_entitlement_events(event_key,user_id,enabled,reason,actor_user_id,source,feature_key) VALUES($1,$2,$3,$4,$5,'super_admin',$6) RETURNING event_key,enabled,reason,actor_user_id,source,occurred_at`, [eventKey, input.userId, input.enabled, reason, input.actorUserId, featureKey]);
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

export async function commercialEntitlementsForUsers(userIds: number[], client: Queryable = pool): Promise<Map<number, Record<CommercialFeature, CommercialEntitlementState>>> {
  await waitForCommercialEntitlementMigration();
  if (!userIds.length) return new Map<number, Record<CommercialFeature, CommercialEntitlementState>>();
  const result = await client.query(`SELECT DISTINCT ON(user_id,feature_key) user_id,feature_key,event_key,enabled,reason,actor_user_id,source,occurred_at FROM commercial_entitlement_events WHERE user_id=ANY($1::int[]) ORDER BY user_id,feature_key,sequence DESC`, [userIds]);
  const mapped = new Map<number, Record<CommercialFeature, CommercialEntitlementState>>();
  for (const row of result.rows) {
    const userId = Number(row.user_id), current = mapped.get(userId) ?? {} as Record<CommercialFeature, CommercialEntitlementState>;
    current[feature(row.feature_key)] = { enabled: row.enabled === true, eventKey: row.event_key, reason: row.reason, actorUserId: row.actor_user_id == null ? null : Number(row.actor_user_id), source: row.source, occurredAt: new Date(row.occurred_at).toISOString() };
    mapped.set(userId, current);
  }
  return mapped;
}
