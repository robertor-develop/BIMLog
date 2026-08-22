import { createHash } from "crypto";
type QueryResult = { rows: any[] };
type TransactionClient = { query(text: string, values?: unknown[]): Promise<QueryResult>; release(): void };
type PublishingPool = { query(text: string, values?: unknown[]): Promise<QueryResult>; connect(): Promise<TransactionClient> };

export const LENS_NEXT_PUBLISH_CONTRACT = "lens-next-publish.v1" as const;
export const LENS_NEXT_ACTIONS = ["status", "comment", "assignment"] as const;
export const LENS_NEXT_STATUSES = ["open", "follow_up", "waiting_design", "approved", "resolved"] as const;
type Action = typeof LENS_NEXT_ACTIONS[number];

export class LensNextPublishError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly current?: unknown) {
    super(message);
  }
}

export type LensNextActor = { userId: number; fullName: string; companyName: string; isSuperAdmin: boolean; role: string | null; permission: string | null };
export type LensNextPublishRequest = {
  contractVersion: typeof LENS_NEXT_PUBLISH_CONTRACT;
  requestId: string;
  idempotencyKey: string;
  identity: { projectId: number; serverId: number; viewpointId: string; lifecycleStatus: "active"; revisionNumber: number; mutationVersion: number };
  action: { type: Action; status?: string; comment?: string; responsibleCompany?: string };
  reason: string;
  modelFingerprint?: string | null;
};

const safeToken = /^[A-Za-z0-9._:-]{8,128}$/;
const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const exactText = (value: unknown, label: string, max: number) => {
  if (typeof value !== "string" || value.trim() !== value || !value || Buffer.byteLength(value, "utf8") > max) throw new LensNextPublishError(400, "LENS_NEXT_REQUEST_INVALID", `${label} is invalid.`);
  return value;
};
const positive = (value: unknown, label: string) => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new LensNextPublishError(400, "LENS_NEXT_REQUEST_INVALID", `${label} is invalid.`);
  return value;
};

export function parseLensNextPublishRequest(value: unknown, routeProjectId: number, routeServerId: number): LensNextPublishRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new LensNextPublishError(400, "LENS_NEXT_REQUEST_INVALID", "Request body is invalid.");
  const body = value as Record<string, unknown>;
  const allowed = new Set(["contractVersion", "requestId", "idempotencyKey", "identity", "action", "reason", "modelFingerprint"]);
  if (Object.keys(body).some(k => !allowed.has(k)) || body.contractVersion !== LENS_NEXT_PUBLISH_CONTRACT) throw new LensNextPublishError(400, "LENS_NEXT_REQUEST_INVALID", "Publishing contract is invalid.");
  const requestId = exactText(body.requestId, "requestId", 128);
  const idempotencyKey = exactText(body.idempotencyKey, "idempotencyKey", 128);
  if (!safeToken.test(requestId) || !safeToken.test(idempotencyKey)) throw new LensNextPublishError(400, "LENS_NEXT_REQUEST_INVALID", "Request identifiers are invalid.");
  const identity = body.identity as Record<string, unknown>;
  const action = body.action as Record<string, unknown>;
  if (!identity || typeof identity !== "object" || Array.isArray(identity) || !action || typeof action !== "object" || Array.isArray(action)) throw new LensNextPublishError(400, "LENS_NEXT_REQUEST_INVALID", "Identity and action are required.");
  const projectId = positive(identity.projectId, "identity.projectId");
  const serverId = positive(identity.serverId, "identity.serverId");
  const revisionNumber = positive(identity.revisionNumber, "identity.revisionNumber");
  const mutationVersion = positive(identity.mutationVersion, "identity.mutationVersion");
  if (projectId !== routeProjectId || serverId !== routeServerId || identity.lifecycleStatus !== "active") throw new LensNextPublishError(409, "LENS_NEXT_IDENTITY_CONFLICT", "The route and immutable issue identity do not match.");
  const viewpointId = exactText(identity.viewpointId, "identity.viewpointId", 512);
  const type = action.type as Action;
  if (!(LENS_NEXT_ACTIONS as readonly string[]).includes(type)) throw new LensNextPublishError(400, "LENS_NEXT_ACTION_INVALID", "Action type is invalid.");
  const normalized: LensNextPublishRequest["action"] = { type };
  if (type === "status") {
    const status = exactText(action.status, "action.status", 32);
    if (!(LENS_NEXT_STATUSES as readonly string[]).includes(status)) throw new LensNextPublishError(400, "LENS_NEXT_ACTION_INVALID", "Status is invalid.");
    normalized.status = status;
  } else if (type === "comment") normalized.comment = exactText(action.comment, "action.comment", 4000);
  else normalized.responsibleCompany = exactText(action.responsibleCompany, "action.responsibleCompany", 256);
  return { contractVersion: LENS_NEXT_PUBLISH_CONTRACT, requestId, idempotencyKey, identity: { projectId, serverId, viewpointId, lifecycleStatus: "active", revisionNumber, mutationVersion }, action: normalized, reason: exactText(body.reason, "reason", 1000), modelFingerprint: body.modelFingerprint == null ? null : exactText(body.modelFingerprint, "modelFingerprint", 256) };
}

export async function ensureLensNextPublishingSchema(pool: PublishingPool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`ALTER TABLE lens_viewpoints ADD COLUMN IF NOT EXISTS mutation_version integer NOT NULL DEFAULT 1`);
    await client.query(`CREATE TABLE IF NOT EXISTS lens_next_publish_receipts (
      id bigserial PRIMARY KEY, project_id integer NOT NULL REFERENCES projects(id), viewpoint_id integer NOT NULL REFERENCES lens_viewpoints(id),
      actor_user_id integer NOT NULL REFERENCES users(id), idempotency_key text NOT NULL, request_hash text NOT NULL, request_id text NOT NULL,
      action_type text NOT NULL, before_snapshot jsonb NOT NULL, after_snapshot jsonb NOT NULL, reason text NOT NULL, comment text,
      model_fingerprint text, response_payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT lens_next_publish_receipts_action_chk CHECK (action_type IN ('status','comment','assignment')),
      CONSTRAINT lens_next_publish_receipts_hash_chk CHECK (request_hash ~ '^[a-f0-9]{64}$'),
      CONSTRAINT lens_next_publish_receipts_key_chk CHECK (octet_length(idempotency_key) BETWEEN 8 AND 128),
      CONSTRAINT lens_next_publish_receipts_request_chk CHECK (octet_length(request_id) BETWEEN 8 AND 128)
    )`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS lens_next_publish_receipts_actor_key_uidx ON lens_next_publish_receipts(actor_user_id,idempotency_key)`);
    await client.query(`CREATE INDEX IF NOT EXISTS lens_next_publish_receipts_viewpoint_created_idx ON lens_next_publish_receipts(viewpoint_id,created_at)`);
    await client.query(`CREATE OR REPLACE FUNCTION lens_next_publish_receipts_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'lens_next_publish_receipts are immutable'; END $$`);
    await client.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='lens_next_publish_receipts_immutable_trg') THEN CREATE TRIGGER lens_next_publish_receipts_immutable_trg BEFORE UPDATE OR DELETE ON lens_next_publish_receipts FOR EACH ROW EXECUTE FUNCTION lens_next_publish_receipts_immutable(); END IF; END $$`);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

const snapshot = (row: any) => ({ serverId: row.id, viewpointId: row.viewpoint_id, lifecycleStatus: row.lifecycle_status, revisionNumber: row.revision_number, mutationVersion: row.mutation_version, status: row.status, responsibleCompany: row.responsible_company });

export async function publishLensNextAction(pool: PublishingPool, actor: LensNextActor, request: LensNextPublishRequest, hooks?: { beforeAudit?: () => Promise<void> }): Promise<any> {
  if (!actor.isSuperAdmin && (!actor.role || !["admin", "write"].includes(actor.permission ?? ""))) throw new LensNextPublishError(403, "LENS_NEXT_PUBLISH_FORBIDDEN", "Current active project write authority is required.");
  const canonical = JSON.stringify(request);
  const requestHash = sha256(canonical);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`lens-next-publish:${actor.userId}:${request.idempotencyKey}`]);
    const existing = await client.query(`SELECT request_hash,response_payload FROM lens_next_publish_receipts WHERE actor_user_id=$1 AND idempotency_key=$2`, [actor.userId, request.idempotencyKey]);
    if (existing.rows[0]) {
      if (existing.rows[0].request_hash !== requestHash) throw new LensNextPublishError(409, "LENS_NEXT_IDEMPOTENCY_CONFLICT", "This idempotency key is bound to a different request.");
      await client.query("COMMIT");
      return { ...existing.rows[0].response_payload, replayed: true };
    }
    if (!actor.isSuperAdmin) {
      const membership = await client.query(`SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2 AND status='active' FOR SHARE`, [request.identity.projectId, actor.userId]);
      if (!membership.rows[0] || membership.rows[0].role !== actor.role) throw new LensNextPublishError(403, "LENS_NEXT_PUBLISH_FORBIDDEN", "Current active project write authority is required.");
    }
    const found = await client.query(`SELECT id,viewpoint_id,lifecycle_status,revision_number,mutation_version,status,responsible_company FROM lens_viewpoints WHERE id=$1 AND project_id=$2 FOR UPDATE`, [request.identity.serverId, request.identity.projectId]);
    const row = found.rows[0];
    if (!row) throw new LensNextPublishError(404, "LENS_NEXT_ISSUE_NOT_FOUND", "Lens issue not found.");
    const before = snapshot(row);
    if (row.viewpoint_id !== request.identity.viewpointId || row.lifecycle_status !== "active" || row.revision_number !== request.identity.revisionNumber || row.mutation_version !== request.identity.mutationVersion) throw new LensNextPublishError(409, "LENS_NEXT_VERSION_CONFLICT", "The issue changed after this draft was opened.", before);
    let afterRow = row;
    if (request.action.type === "status") afterRow = (await client.query(`UPDATE lens_viewpoints SET status=$1,mutation_version=mutation_version+1,updated_at=now() WHERE id=$2 RETURNING id,viewpoint_id,lifecycle_status,revision_number,mutation_version,status,responsible_company`, [request.action.status, row.id])).rows[0];
    else if (request.action.type === "assignment") afterRow = (await client.query(`UPDATE lens_viewpoints SET responsible_company=$1,mutation_version=mutation_version+1,updated_at=now() WHERE id=$2 RETURNING id,viewpoint_id,lifecycle_status,revision_number,mutation_version,status,responsible_company`, [request.action.responsibleCompany, row.id])).rows[0];
    else afterRow = (await client.query(`UPDATE lens_viewpoints SET mutation_version=mutation_version+1,updated_at=now() WHERE id=$1 RETURNING id,viewpoint_id,lifecycle_status,revision_number,mutation_version,status,responsible_company`, [row.id])).rows[0];
    const after = snapshot(afterRow);
    const response = { success: true, contractVersion: LENS_NEXT_PUBLISH_CONTRACT, receipt: { requestId: request.requestId, idempotencyKey: request.idempotencyKey, requestHash, actionType: request.action.type, recordedAt: new Date().toISOString() }, issue: after, replayed: false };
    await hooks?.beforeAudit?.();
    await client.query(`INSERT INTO lens_next_publish_receipts(project_id,viewpoint_id,actor_user_id,idempotency_key,request_hash,request_id,action_type,before_snapshot,after_snapshot,reason,comment,model_fingerprint,response_payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13::jsonb)`, [request.identity.projectId, row.id, actor.userId, request.idempotencyKey, requestHash, request.requestId, request.action.type, JSON.stringify(before), JSON.stringify(after), request.reason, request.action.comment ?? null, request.modelFingerprint ?? null, JSON.stringify(response)]);
    await client.query("COMMIT");
    return response;
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
