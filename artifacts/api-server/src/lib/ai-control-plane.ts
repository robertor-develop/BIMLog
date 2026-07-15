import crypto from "crypto";
import { pool } from "@workspace/db";

export type ProviderName = "openai" | "anthropic";
export type OwnerType = "personal" | "company" | "system";

export class AiControlError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) { super(message); }
}

const PROVIDERS = new Set<ProviderName>(["openai", "anthropic"]);
const b64 = (value: Buffer) => value.toString("base64url");
const fromB64 = (value: string) => Buffer.from(value, "base64url");
const digest = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const uuid = () => crypto.randomUUID();

async function recordAudit(actorUserId: number, action: string, targetType: string, targetId: string, details: Record<string, unknown>): Promise<void> {
  await pool.query(`INSERT INTO admin_actions_log(admin_user_id,admin_email,action,target_type,target_id,details)
    SELECT id,email,$2,$3,$4,$5::jsonb FROM users WHERE id=$1`, [actorUserId, action, targetType, targetId, JSON.stringify(details)]);
}

function activeKek(): { key: Buffer; version: string } {
  const version = (process.env.AI_PROVIDER_ACTIVE_KEK_VERSION || "v1").trim().toLowerCase();
  if (!/^[a-z0-9_]+$/.test(version)) throw new AiControlError("AI_KEK_VERSION_INVALID", "Provider key encryption is not configured.", 503);
  const encoded = process.env[`AI_PROVIDER_KEK_${version.toUpperCase()}`];
  if (!encoded) throw new AiControlError("AI_KEK_MISSING", `Provider key encryption key ${version} is missing.`, 503);
  const key = fromB64(encoded);
  if (key.length !== 32) throw new AiControlError("AI_KEK_INVALID", `Provider key encryption key ${version} must decode to 32 bytes.`, 503);
  return { key, version };
}

function kekFor(version: string): Buffer {
  const encoded = process.env[`AI_PROVIDER_KEK_${version.toUpperCase()}`];
  if (!encoded) throw new AiControlError("AI_KEK_MISSING", `Provider key encryption key ${version} is unavailable.`, 503);
  const key = fromB64(encoded);
  if (key.length !== 32) throw new AiControlError("AI_KEK_INVALID", "Provider key encryption is misconfigured.", 503);
  return key;
}

type Envelope = { secretCiphertext: string; secretIv: string; secretTag: string; wrappedDataKey: string; wrapIv: string; wrapTag: string; keyVersion: string };

function encryptSecret(connectionId: string, secret: string): Envelope {
  const { key: kek, version } = activeKek();
  const dek = crypto.randomBytes(32);
  const secretIv = crypto.randomBytes(12);
  const secretCipher = crypto.createCipheriv("aes-256-gcm", dek, secretIv);
  secretCipher.setAAD(Buffer.from(`provider-secret:${connectionId}`));
  const ciphertext = Buffer.concat([secretCipher.update(secret, "utf8"), secretCipher.final()]);
  const wrapIv = crypto.randomBytes(12);
  const wrapCipher = crypto.createCipheriv("aes-256-gcm", kek, wrapIv);
  wrapCipher.setAAD(Buffer.from(`provider-dek:${connectionId}:${version}`));
  const wrapped = Buffer.concat([wrapCipher.update(dek), wrapCipher.final()]);
  const result = { secretCiphertext: b64(ciphertext), secretIv: b64(secretIv), secretTag: b64(secretCipher.getAuthTag()), wrappedDataKey: b64(wrapped), wrapIv: b64(wrapIv), wrapTag: b64(wrapCipher.getAuthTag()), keyVersion: version };
  dek.fill(0); kek.fill(0);
  return result;
}

function decryptSecret(connectionId: string, row: Record<string, unknown>): Buffer {
  const required = ["secret_ciphertext", "secret_iv", "secret_tag", "wrapped_data_key", "wrap_iv", "wrap_tag", "key_version"];
  if (required.some((key) => typeof row[key] !== "string" || !row[key])) throw new AiControlError("CONNECTION_REVOKED", "Provider connection has no usable secret.", 409);
  const version = String(row.key_version);
  const kek = kekFor(version);
  const unwrap = crypto.createDecipheriv("aes-256-gcm", kek, fromB64(String(row.wrap_iv)));
  unwrap.setAAD(Buffer.from(`provider-dek:${connectionId}:${version}`));
  unwrap.setAuthTag(fromB64(String(row.wrap_tag)));
  const dek = Buffer.concat([unwrap.update(fromB64(String(row.wrapped_data_key))), unwrap.final()]);
  kek.fill(0);
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", dek, fromB64(String(row.secret_iv)));
    decipher.setAAD(Buffer.from(`provider-secret:${connectionId}`));
    decipher.setAuthTag(fromB64(String(row.secret_tag)));
    return Buffer.concat([decipher.update(fromB64(String(row.secret_ciphertext))), decipher.final()]);
  } finally { dek.fill(0); }
}

export function assertProvider(value: unknown): ProviderName {
  if (typeof value !== "string" || !PROVIDERS.has(value as ProviderName)) throw new AiControlError("PROVIDER_UNSUPPORTED", "Provider must be openai or anthropic.");
  return value as ProviderName;
}

export function maskProviderKey(secret: string): string {
  const clean = secret.trim();
  return clean.length > 8 ? `${clean.slice(0, 3)}...${clean.slice(-4)}` : "configured";
}

type ConnectionAction = "use" | "validate" | "rotate" | "disable" | "enable" | "update_models" | "revoke";

export const connectionAuthorizationMatrix: Record<OwnerType, Record<ConnectionAction, string>> = {
  personal: { use: "owner", validate: "owner", rotate: "owner", disable: "owner", enable: "owner", update_models: "owner", revoke: "owner" },
  company: { use: "same_company_user", validate: "company_ai_admin_or_super", rotate: "company_ai_admin_or_super", disable: "company_ai_admin_or_super", enable: "company_ai_admin_or_super", update_models: "company_ai_admin_or_super", revoke: "company_ai_admin_or_super" },
  system: { use: "super_admin", validate: "super_admin", rotate: "super_admin", disable: "super_admin", enable: "super_admin", update_models: "super_admin", revoke: "super_admin" },
};

export async function createProviderConnection(input: { actorUserId: number; actorCompanyId: number; actorIsSuperAdmin: boolean; actorIsCompanyAdmin: boolean; ownerType: OwnerType; provider: ProviderName; secret: string; label?: string; allowedModels?: string[] }) {
  if (!input.secret.trim()) throw new AiControlError("SECRET_REQUIRED", "API key is required.");
  if (input.ownerType === "company" && !input.actorIsCompanyAdmin && !input.actorIsSuperAdmin) throw new AiControlError("COMPANY_ADMIN_REQUIRED", "Company admin access required.", 403);
  if (input.ownerType === "system" && !input.actorIsSuperAdmin) throw new AiControlError("SUPER_ADMIN_REQUIRED", "Super admin access required.", 403);
  const id = uuid();
  const envelope = encryptSecret(id, input.secret.trim());
  const userId = input.ownerType === "personal" ? input.actorUserId : null;
  const companyId = input.ownerType === "system" ? null : input.actorCompanyId;
  const result = await pool.query(`INSERT INTO provider_connections
    (id, owner_type, user_id, company_id, provider, status, label, allowed_models, secret_ciphertext, secret_iv, secret_tag, wrapped_data_key, wrap_iv, wrap_tag, key_version, created_by_id)
    VALUES ($1,$2,$3,$4,$5,'pending_validation',$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15)
    RETURNING id, owner_type, user_id, company_id, provider, status, label, allowed_models, key_version, validated_at, rotated_at, revoked_at, created_at, updated_at`,
    [id, input.ownerType, userId, companyId, input.provider, input.label?.trim() || `${input.provider} ${maskProviderKey(input.secret)}`, JSON.stringify(input.allowedModels || []), envelope.secretCiphertext, envelope.secretIv, envelope.secretTag, envelope.wrappedDataKey, envelope.wrapIv, envelope.wrapTag, envelope.keyVersion, input.actorUserId]);
  await recordAudit(input.actorUserId, "ai_provider_connection_created", "provider_connection", id, { ownerType: input.ownerType, provider: input.provider, allowedModels: input.allowedModels || [], keyVersion: envelope.keyVersion });
  return result.rows[0];
}

async function authorizedConnection(userId: number, companyId: number, isSuperAdmin: boolean, isCompanyAdmin: boolean, connectionId: string, action: ConnectionAction) {
  const result = await pool.query(`SELECT * FROM provider_connections WHERE id=$1`, [connectionId]);
  const row = result.rows[0];
  if (!row) throw new AiControlError("CONNECTION_NOT_FOUND", "Provider connection not found.", 404);
  const ownerType = row.owner_type as OwnerType;
  const rule = connectionAuthorizationMatrix[ownerType]?.[action];
  const allowed =
    rule === "owner" ? row.user_id === userId :
    rule === "same_company_user" ? row.company_id === companyId :
    rule === "company_ai_admin_or_super" ? row.company_id === companyId && (isCompanyAdmin || isSuperAdmin) :
    rule === "super_admin" ? isSuperAdmin :
    false;
  if (!allowed) throw new AiControlError("CONNECTION_FORBIDDEN", `Not authorized to ${action} this provider connection.`, 403);
  return row;
}

export async function listProviderConnections(auth: { userId: number; companyId: number; isSuperAdmin: boolean; isCompanyAdmin: boolean }) {
  const result = await pool.query(`SELECT id, owner_type, user_id, company_id, provider, status, label, allowed_models, key_version, validated_at, rotated_at, revoked_at, created_at, updated_at FROM provider_connections
    WHERE (owner_type='personal' AND user_id=$1) OR (owner_type='company' AND company_id=$2) OR (owner_type='system' AND $3::boolean)
    ORDER BY owner_type, created_at DESC`, [auth.userId, auth.companyId, auth.isSuperAdmin]);
  return result.rows;
}

type FetchLike = typeof fetch;
export async function validateProviderSecret(provider: ProviderName, secret: string, transport: FetchLike = fetch): Promise<string[]> {
  const response = provider === "openai"
    ? await transport("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${secret}` } })
    : await transport("https://api.anthropic.com/v1/models?limit=1000", { headers: { "x-api-key": secret, "anthropic-version": "2023-06-01" } });
  if (!response.ok) throw new AiControlError(response.status === 401 ? "PROVIDER_AUTH_REJECTED" : "PROVIDER_VALIDATION_FAILED", response.status === 401 ? "Provider rejected the API key." : `Provider validation failed with status ${response.status}.`, 400);
  const payload = await response.json() as { data?: Array<{ id?: unknown }> };
  return (payload.data || []).map((m) => m.id).filter((id): id is string => typeof id === "string").sort();
}

export async function withProviderSecret<T>(auth: { userId: number; companyId: number; isSuperAdmin: boolean; isCompanyAdmin: boolean }, connectionId: string, operation: (provider: ProviderName, secret: string) => Promise<T>): Promise<T> {
  const row = await authorizedConnection(auth.userId, auth.companyId, auth.isSuperAdmin, auth.isCompanyAdmin, connectionId, "use");
  if (row.status !== "active") throw new AiControlError("CONNECTION_UNAVAILABLE", "Provider connection is not enabled.", 409);
  const secretBytes = decryptSecret(connectionId, row);
  try { return await operation(assertProvider(row.provider), secretBytes.toString("utf8")); }
  finally { secretBytes.fill(0); }
}

export async function validateConnection(auth: { userId: number; companyId: number; isSuperAdmin: boolean; isCompanyAdmin: boolean }, id: string, transport: FetchLike = fetch) {
  const row = await authorizedConnection(auth.userId, auth.companyId, auth.isSuperAdmin, auth.isCompanyAdmin, id, "validate");
  if (row.status === "revoked") throw new AiControlError("CONNECTION_REVOKED", "Revoked provider connections cannot be validated.", 409);
  const secretBytes = decryptSecret(id, row);
  let models: string[];
  try { models = await validateProviderSecret(assertProvider(row.provider), secretBytes.toString("utf8"), transport); }
  finally { secretBytes.fill(0); }
  await pool.query(`UPDATE provider_connections SET status='active', validated_at=now(), updated_at=now() WHERE id=$1 AND status<>'revoked'`, [id]);
  await recordAudit(auth.userId, "ai_provider_connection_validated", "provider_connection", id, { availableModelCount: models.length });
  return { id, status: "active", availableModels: models };
}

export async function rotateConnection(auth: { userId: number; companyId: number; isSuperAdmin: boolean; isCompanyAdmin: boolean }, id: string, newSecret: string) {
  const current = await authorizedConnection(auth.userId, auth.companyId, auth.isSuperAdmin, auth.isCompanyAdmin, id, "rotate");
  if (current.status === "revoked") throw new AiControlError("CONNECTION_REVOKED", "Revoked provider connections are terminal.", 409);
  if (!newSecret.trim()) throw new AiControlError("SECRET_REQUIRED", "A replacement API key is required.");
  const e = encryptSecret(id, newSecret.trim());
  await pool.query(`UPDATE provider_connections SET status='pending_validation', secret_ciphertext=$2, secret_iv=$3, secret_tag=$4, wrapped_data_key=$5, wrap_iv=$6, wrap_tag=$7, key_version=$8, rotated_at=now(), validated_at=NULL, updated_at=now() WHERE id=$1`, [id, e.secretCiphertext, e.secretIv, e.secretTag, e.wrappedDataKey, e.wrapIv, e.wrapTag, e.keyVersion]);
  await recordAudit(auth.userId, "ai_provider_connection_rotated", "provider_connection", id, { keyVersion: e.keyVersion });
  return { id, status: "pending_validation", maskedKey: maskProviderKey(newSecret) };
}

export async function revokeConnection(auth: { userId: number; companyId: number; isSuperAdmin: boolean; isCompanyAdmin: boolean }, id: string) {
  const current = await authorizedConnection(auth.userId, auth.companyId, auth.isSuperAdmin, auth.isCompanyAdmin, id, "revoke");
  if (current.status === "revoked") throw new AiControlError("CONNECTION_REVOKED", "Revoked provider connections are terminal.", 409);
  await pool.query(`UPDATE provider_connections SET status='revoked', secret_ciphertext=NULL, secret_iv=NULL, secret_tag=NULL, wrapped_data_key=NULL, wrap_iv=NULL, wrap_tag=NULL, revoked_at=now(), updated_at=now() WHERE id=$1`, [id]);
  await recordAudit(auth.userId, "ai_provider_connection_revoked", "provider_connection", id, { cryptographicErasure: true });
  return { id, status: "revoked" };
}

export async function updateConnectionPolicy(auth: { userId: number; companyId: number; isSuperAdmin: boolean; isCompanyAdmin: boolean }, id: string, input: { status?: "active" | "disabled"; allowedModels?: string[] }) {
  const action: ConnectionAction = input.status === "disabled" ? "disable" : input.status === "active" ? "enable" : "update_models";
  const current = await authorizedConnection(auth.userId, auth.companyId, auth.isSuperAdmin, auth.isCompanyAdmin, id, action);
  if (input.status && !["active", "disabled"].includes(input.status)) throw new AiControlError("STATUS_INVALID", "Status must be active or disabled.");
  if (current.status === "revoked") throw new AiControlError("CONNECTION_REVOKED", "Revoked provider connections are terminal.", 409);
  if (input.status === "active" && (current.status !== "disabled" || !current.validated_at)) throw new AiControlError("VALIDATION_REQUIRED", "Only a previously validated disabled key can be re-enabled.", 409);
  if (input.status === "disabled" && current.status !== "active") throw new AiControlError("STATE_TRANSITION_INVALID", "Only active keys can be disabled.", 409);
  const result = await pool.query(`UPDATE provider_connections SET status=COALESCE($2,status), allowed_models=COALESCE($3::jsonb,allowed_models), updated_at=now() WHERE id=$1 RETURNING id, owner_type, provider, status, label, allowed_models, validated_at, rotated_at, revoked_at`, [id, input.status || null, input.allowedModels ? JSON.stringify(input.allowedModels) : null]);
  await recordAudit(auth.userId, "ai_provider_connection_policy_updated", "provider_connection", id, { status: input.status, allowedModels: input.allowedModels });
  return result.rows[0];
}

export type Actor = { userId: number; companyId: number; isSuperAdmin: boolean; isCompanyAdmin: boolean };

async function selectConnection(client: any, actor: Actor, input: { connectionId?: string; provider: ProviderName; capability: string }) {
  if (input.connectionId) {
    const { rows } = await client.query(`SELECT * FROM provider_connections WHERE id=$1 AND status='active'`, [input.connectionId]);
    const row = rows[0];
    if (!row) throw new AiControlError("CONNECTION_UNAVAILABLE", "Selected provider connection is unavailable.", 409);
    const allowed = row.owner_type === "personal" ? row.user_id === actor.userId : row.owner_type === "company" ? row.company_id === actor.companyId : actor.isSuperAdmin;
    if (!allowed) throw new AiControlError("CONNECTION_FORBIDDEN", "Selected provider connection is not authorized.", 403);
    if (row.provider !== input.provider) throw new AiControlError("PROVIDER_MISMATCH", "Selected connection does not match the provider.");
    return row;
  }
  throw new AiControlError("CONNECTION_SELECTION_REQUIRED", "Choose the funding connection explicitly.", 409);
}

const positiveInt = (value: unknown, name: string, allowZero = false) => { const n = Number(value); if (!Number.isSafeInteger(n) || (allowZero ? n < 0 : n <= 0)) throw new AiControlError("INPUT_INVALID", `${name} must be a ${allowZero ? "non-negative" : "positive"} integer.`); return n; };
const strArray = (value: unknown, name: string) => { if (!Array.isArray(value) || value.some((x) => typeof x !== "string")) throw new AiControlError("INPUT_INVALID", `${name} must be a string array.`); return value as string[]; };
const calculate = (tokens: bigint, rate: bigint, basis: bigint) => (tokens * rate + basis - 1n) / basis;
const requestCostExpr = `CASE WHEN r.status='reserved' THEN r.reserved_micros WHEN r.status='settled' THEN COALESCE(r.actual_micros,0) ELSE 0 END`;

async function periodUsage(client: any, scope: "budget_id" | "allocation_id", scopeId: string, sessionId: string) {
  const query = scope === "budget_id"
    ? `SELECT
        COALESCE(SUM(CASE WHEN r.created_at>=date_trunc('day',now()) THEN ${requestCostExpr} ELSE 0 END),0)
          + COALESCE((SELECT SUM(c.amount_micros) FROM ai_usage_costs c JOIN ai_runs cr ON cr.id=c.run_id WHERE cr.budget_id=$1 AND c.entry_type='correction' AND c.created_at>=date_trunc('day',now())),0) daily,
        COALESCE(SUM(CASE WHEN r.created_at>=date_trunc('month',now()) THEN ${requestCostExpr} ELSE 0 END),0)
          + COALESCE((SELECT SUM(c.amount_micros) FROM ai_usage_costs c JOIN ai_runs cr ON cr.id=c.run_id WHERE cr.budget_id=$1 AND c.entry_type='correction' AND c.created_at>=date_trunc('month',now())),0) monthly,
        COALESCE(SUM(CASE WHEN r.session_id=$2 THEN ${requestCostExpr} ELSE 0 END),0)
          + COALESCE((SELECT SUM(c.amount_micros) FROM ai_usage_costs c JOIN ai_runs cr ON cr.id=c.run_id WHERE cr.budget_id=$1 AND cr.session_id=$2 AND c.entry_type='correction'),0) session
       FROM ai_runs r WHERE r.budget_id=$1 AND r.status IN ('reserved','settled')`
    : `SELECT
        COALESCE(SUM(CASE WHEN r.created_at>=date_trunc('day',now()) THEN ${requestCostExpr} ELSE 0 END),0)
          + COALESCE((SELECT SUM(c.amount_micros) FROM ai_usage_costs c JOIN ai_runs cr ON cr.id=c.run_id WHERE cr.allocation_id=$1 AND c.entry_type='correction' AND c.created_at>=date_trunc('day',now())),0) daily,
        COALESCE(SUM(CASE WHEN r.created_at>=date_trunc('month',now()) THEN ${requestCostExpr} ELSE 0 END),0)
          + COALESCE((SELECT SUM(c.amount_micros) FROM ai_usage_costs c JOIN ai_runs cr ON cr.id=c.run_id WHERE cr.allocation_id=$1 AND c.entry_type='correction' AND c.created_at>=date_trunc('month',now())),0) monthly,
        COALESCE(SUM(CASE WHEN r.session_id=$2 THEN ${requestCostExpr} ELSE 0 END),0)
          + COALESCE((SELECT SUM(c.amount_micros) FROM ai_usage_costs c JOIN ai_runs cr ON cr.id=c.run_id WHERE cr.allocation_id=$1 AND cr.session_id=$2 AND c.entry_type='correction'),0) session
       FROM ai_runs r WHERE r.allocation_id=$1 AND r.status IN ('reserved','settled')`;
  return (await client.query(query, [scopeId, sessionId])).rows[0];
}

export async function createEstimate(actor: Actor, body: Record<string, unknown>) {
  const provider = assertProvider(body.provider);
  const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : (() => { throw new AiControlError("MODEL_REQUIRED", "Model is required."); })();
  const capability = typeof body.capability === "string" && body.capability.trim() ? body.capability.trim() : "assistant";
  const purpose = typeof body.purpose === "string" && body.purpose.trim() ? body.purpose.trim() : (() => { throw new AiControlError("PURPOSE_REQUIRED", "Purpose is required."); })();
  const contextCategories = strArray(body.contextCategories || [], "contextCategories");
  const contextManifestHash = typeof body.contextManifestHash === "string" && /^[a-f0-9]{64}$/i.test(body.contextManifestHash) ? body.contextManifestHash.toLowerCase() : (() => { throw new AiControlError("CONTEXT_HASH_REQUIRED", "A SHA-256 context manifest hash is required."); })();
  const fileManifestHash = body.fileManifestHash == null ? null : typeof body.fileManifestHash === "string" && /^[a-f0-9]{64}$/i.test(body.fileManifestHash) ? body.fileManifestHash.toLowerCase() : (() => { throw new AiControlError("FILE_HASH_INVALID", "File manifest hash must be SHA-256."); })();
  const filesWillBeTransmitted = body.filesWillBeTransmitted === true;
  if (filesWillBeTransmitted && !fileManifestHash) throw new AiControlError("FILE_CONFIRMATION_REQUIRED", "A file manifest is required when files will be transmitted.");
  const inputMin = positiveInt(body.inputTokenMin, "inputTokenMin", true), inputMax = positiveInt(body.inputTokenMax, "inputTokenMax"), outputMax = positiveInt(body.outputTokenMax, "outputTokenMax");
  if (inputMin > inputMax) throw new AiControlError("TOKEN_RANGE_INVALID", "Minimum input tokens cannot exceed maximum input tokens.");
  const idempotencyKey = typeof body.idempotencyKey === "string" && body.idempotencyKey.trim() ? body.idempotencyKey.trim() : (() => { throw new AiControlError("IDEMPOTENCY_REQUIRED", "Idempotency key is required."); })();
  const connectionId = typeof body.connectionId === "string" && body.connectionId.trim() ? body.connectionId.trim() : (() => { throw new AiControlError("CONNECTION_SELECTION_REQUIRED", "Choose the funding connection explicitly.", 409); })();
  const sessionId = typeof body.sessionId === "string" && body.sessionId.trim() ? body.sessionId.trim() : (() => { throw new AiControlError("SESSION_REQUIRED", "Session identifier is required."); })();
  const projectId = body.projectId == null ? null : positiveInt(body.projectId,"projectId");
  const fileCount = filesWillBeTransmitted ? positiveInt(body.fileCount,"fileCount") : 0;
  const fileTypes = filesWillBeTransmitted ? strArray(body.fileTypes,"fileTypes") : [];
  const fileTotalBytes = filesWillBeTransmitted ? positiveInt(body.fileTotalBytes,"fileTotalBytes") : 0;
  const pageImageEstimate = filesWillBeTransmitted ? positiveInt(body.pageImageEstimate,"pageImageEstimate",true) : 0;
  const transmissionScope = filesWillBeTransmitted && typeof body.transmissionScope === "string" && body.transmissionScope.trim() ? body.transmissionScope.trim() : null;
  const fileAdditionalInputTokensMax = filesWillBeTransmitted ? positiveInt(body.fileAdditionalInputTokensMax,"fileAdditionalInputTokensMax",true) : 0;
  if (filesWillBeTransmitted && !transmissionScope) throw new AiControlError("FILE_SCOPE_REQUIRED","File transmission scope is required.");
  const normalizedRequest = {provider,model,capability,purpose,connectionId,sessionId,projectId,contextCategories:[...contextCategories].sort(),contextManifestHash,fileManifestHash,filesWillBeTransmitted,fileCount,fileTypes:[...fileTypes].sort(),fileTotalBytes,pageImageEstimate,transmissionScope,fileAdditionalInputTokensMax,inputMin,inputMax,outputMax};
  const requestFingerprint = digest(normalizedRequest);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(`SELECT * FROM ai_runs WHERE user_id=$1 AND idempotency_key=$2`, [actor.userId, idempotencyKey]);
    if (existing.rows[0]) { if(existing.rows[0].request_fingerprint!==requestFingerprint) throw new AiControlError("IDEMPOTENCY_CONFLICT","This idempotency key was already used for a different normalized request.",409); await client.query("COMMIT"); return existing.rows[0]; }
    if(projectId){const pr=await client.query(`SELECT p.id,u.company_id,EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=$2 AND pm.status='active') member FROM projects p JOIN users u ON u.id=p.created_by_id WHERE p.id=$1 AND p.status<>'archived'`,[projectId,actor.userId]);const project=pr.rows[0];if(!project||project.company_id!==actor.companyId)throw new AiControlError("PROJECT_TENANT_FORBIDDEN","Project does not belong to the actor company.",403);if(!project.member&&!actor.isSuperAdmin)throw new AiControlError("PROJECT_ACCESS_REQUIRED","Current project membership is required.",403);}
    const connection = await selectConnection(client, actor, { connectionId, provider, capability });
    if(connection.owner_type==='system'&&!actor.isSuperAdmin) throw new AiControlError("SUPER_ADMIN_REQUIRED","System funding is restricted to Super Admin.",403);
    const ent = await client.query(`SELECT * FROM entitlement_rules WHERE capability=$1 AND funding_type=$2 AND enabled=true AND (($2='system' AND company_id IS NULL) OR ($2<>'system' AND company_id=$3)) AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) ORDER BY version DESC LIMIT 2`, [capability, connection.owner_type, actor.companyId]);
    if(ent.rows.length>1)throw new AiControlError("POLICY_CONFLICT","Multiple active entitlement rules match this request.",409);
    const rule = ent.rows[0];
    if (!rule) throw new AiControlError("ENTITLEMENT_MISSING", "No active entitlement permits this request.", 403);
    if (!(rule.provider_allowlist as string[]).includes(provider) || !(rule.model_allowlist as string[]).includes(model)) throw new AiControlError("MODEL_NOT_ENTITLED", "Provider or model is not entitled.", 403);
    if (!(connection.allowed_models as string[]).includes(model)) throw new AiControlError("MODEL_NOT_ALLOWED", "Model is not allowed by this connection.", 403);
    const priceResult = await client.query(`SELECT * FROM ai_price_schedules WHERE provider=$1 AND model=$2 AND status='active' AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) ORDER BY version DESC LIMIT 2`, [provider, model]);
    if(priceResult.rows.length>1)throw new AiControlError("POLICY_CONFLICT","Multiple active price schedules match this request.",409);
    const price = priceResult.rows[0];
    if (!price) throw new AiControlError("PRICE_MISSING", "No effective price schedule exists for this provider and model.", 409);
    const basis = BigInt(price.unit_basis), minCost = calculate(BigInt(inputMin), BigInt(price.input_micros), basis), fileAdditionalCost=calculate(BigInt(fileAdditionalInputTokensMax),BigInt(price.input_micros),basis), maxCost = calculate(BigInt(inputMax), BigInt(price.input_micros), basis) + calculate(BigInt(outputMax), BigInt(price.output_micros), basis)+fileAdditionalCost;
    let budget = null, allocation = null;
    {
      const br = await client.query(`SELECT * FROM company_ai_budgets WHERE funding_owner_type=$1 AND (($1='personal' AND company_id=$2 AND owner_user_id=$3) OR ($1='company' AND company_id=$2 AND owner_user_id IS NULL) OR ($1='system' AND company_id IS NULL AND owner_user_id IS NULL)) AND status='active' AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) ORDER BY version DESC LIMIT 2`, [connection.owner_type,actor.companyId,actor.userId]);
      if(br.rows.length>1)throw new AiControlError("POLICY_CONFLICT","Multiple active budgets match this request.",409);
      budget = br.rows[0];
      if (!budget) throw new AiControlError("BUDGET_MISSING", `No active ${connection.owner_type} AI budget exists.`, 409);
      if(!(budget.provider_allowlist as string[]).includes(provider)||!(budget.model_allowlist as string[]).includes(model)||!(budget.capability_allowlist as string[]).includes(capability))throw new AiControlError("BUDGET_POLICY_FORBIDDEN","Budget allowlists do not permit this provider, model, and capability.",403);
      if(price.currency!==budget.currency)throw new AiControlError("BUDGET_CURRENCY_MISMATCH","Price and budget currencies differ.",409);
      if (maxCost > BigInt(budget.per_request_limit_micros)) throw new AiControlError("PER_REQUEST_LIMIT", "Estimate exceeds the per-request limit.", 409);
      if(connection.owner_type!=="personal"){const ar = await client.query(`SELECT * FROM user_ai_allocations WHERE budget_id=$1 AND company_id=$2 AND user_id=$3 AND status='active'`, [budget.id, actor.companyId,actor.userId]);allocation=ar.rows[0];if(!allocation)throw new AiControlError("ALLOCATION_MISSING","No active user AI allocation exists.",403);}
    }
    const id = uuid();
    const material = { ...normalizedRequest, creditOwnerType: connection.owner_type, priceScheduleId: price.id, entitlementRuleId: rule.id, budgetId: budget.id, allocationId: allocation?.id || null, estimatedMaxMicros: maxCost.toString() };
    const fingerprint = digest(material);
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    const inserted = await client.query(`INSERT INTO ai_runs (id,user_id,company_id,project_id,session_id,capability,purpose,provider,model,connection_id,credit_owner_type,context_manifest_hash,context_categories,file_manifest_hash,files_will_be_transmitted,file_count,file_types,file_total_bytes,page_image_estimate,transmission_scope,file_additional_input_tokens_max,file_additional_cost_micros,price_schedule_id,entitlement_rule_id,budget_id,allocation_id,input_token_min,input_token_max,output_token_max,estimated_min_micros,estimated_max_micros,currency,request_fingerprint,estimate_fingerprint,estimate_expires_at,status,idempotency_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17::jsonb,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,'estimated',$36) RETURNING *`, [id, actor.userId, actor.companyId,projectId,sessionId, capability, purpose, provider, model, connection.id, connection.owner_type, contextManifestHash, JSON.stringify(contextCategories), fileManifestHash, filesWillBeTransmitted,fileCount,JSON.stringify(fileTypes),String(fileTotalBytes),pageImageEstimate,transmissionScope,fileAdditionalInputTokensMax,fileAdditionalCost.toString(), price.id, rule.id, budget.id, allocation?.id || null, inputMin, inputMax, outputMax, minCost.toString(), maxCost.toString(), price.currency,requestFingerprint, fingerprint, expires, idempotencyKey]);
    await client.query("COMMIT"); return inserted.rows[0];
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function confirmEstimate(actor: Actor, runId: string, body: Record<string, unknown>) {
  const confirmationId = typeof body.confirmationId === "string" && body.confirmationId.trim() ? body.confirmationId.trim() : (() => { throw new AiControlError("CONFIRMATION_REQUIRED", "Confirmation identifier is required."); })();
  const result = await pool.query(`UPDATE ai_runs SET confirmation_id=$3, confirmed_at=now(), status='confirmed', updated_at=now() WHERE id=$1 AND user_id=$2 AND status='estimated' AND estimate_expires_at>now() AND estimate_fingerprint=$4 AND context_manifest_hash=$5 AND COALESCE(file_manifest_hash,'')=COALESCE($6,'') RETURNING *`, [runId, actor.userId, confirmationId, body.estimateFingerprint, body.contextManifestHash, body.fileManifestHash ?? null]);
  if (!result.rows[0]) throw new AiControlError("ESTIMATE_CHANGED_OR_EXPIRED", "Estimate expired or material context changed. Request a new estimate and confirm again.", 409);
  return result.rows[0];
}

export async function confirmFileEstimate(actor: Actor, runId: string, body: Record<string, unknown>) {
  const fileConfirmationId=typeof body.fileConfirmationId==="string"&&body.fileConfirmationId.trim()?body.fileConfirmationId.trim():(()=>{throw new AiControlError("FILE_CONFIRMATION_REQUIRED","A separate file-reading confirmation identifier is required.");})();
  const result=await pool.query(`UPDATE ai_runs SET file_confirmation_id=$3,file_confirmed_at=now(),file_confirmation_expires_at=estimate_expires_at,status='file_confirmed',updated_at=now() WHERE id=$1 AND user_id=$2 AND status='confirmed' AND files_will_be_transmitted=true AND estimate_expires_at>now() AND file_manifest_hash=$4 AND file_count=$5 AND file_types=$6::jsonb AND file_total_bytes=$7 AND page_image_estimate=$8 AND transmission_scope=$9 AND provider=$10 AND model=$11 AND file_additional_cost_micros=$12 RETURNING *`,[runId,actor.userId,fileConfirmationId,body.fileManifestHash,positiveInt(body.fileCount,"fileCount"),JSON.stringify(strArray(body.fileTypes,"fileTypes")),String(positiveInt(body.fileTotalBytes,"fileTotalBytes")),positiveInt(body.pageImageEstimate,"pageImageEstimate",true),body.transmissionScope,body.provider,body.model,String(positiveInt(body.maxAdditionalCostMicros,"maxAdditionalCostMicros",true))]);
  if(!result.rows[0])throw new AiControlError("FILE_ESTIMATE_CHANGED_OR_EXPIRED","File estimate details changed or expired. Confirm the exact file estimate again.",409);
  return result.rows[0];
}

export async function reserveRun(actor: Actor, runId: string, body: Record<string, unknown>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const rr = await client.query(`SELECT * FROM ai_runs WHERE id=$1 AND user_id=$2 FOR UPDATE`, [runId, actor.userId]); const run=rr.rows[0];
    if (!run) throw new AiControlError("RUN_NOT_FOUND", "AI run not found.", 404);
    if (run.status === "reserved") { await client.query("COMMIT"); return run; }
    const expectedStatus=run.files_will_be_transmitted?"file_confirmed":"confirmed";
    if (run.status !== expectedStatus || (run.files_will_be_transmitted&&run.file_confirmation_id!==body.fileConfirmationId) || run.estimate_expires_at <= new Date() || run.confirmation_id !== body.confirmationId || run.estimate_fingerprint !== body.estimateFingerprint || run.context_manifest_hash !== body.contextManifestHash || (run.file_manifest_hash || null) !== (body.fileManifestHash || null)) throw new AiControlError("RECONFIRM_REQUIRED", "The confirmed estimate is no longer current.", 409);
    const currentConnection = await client.query(`SELECT * FROM provider_connections WHERE id=$1 AND status='active'`, [run.connection_id]);
    const currentPrice = await client.query(`SELECT id,currency FROM ai_price_schedules WHERE id=$1 AND status='active' AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now())`, [run.price_schedule_id]);
    const currentRule = await client.query(`SELECT id,provider_allowlist,model_allowlist FROM entitlement_rules WHERE id=$1 AND enabled=true AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now())`, [run.entitlement_rule_id]);
    if (!currentPrice.rows[0] || !currentRule.rows[0]) throw new AiControlError("RECONFIRM_REQUIRED", "Pricing or entitlement changed. Request a new estimate.", 409);
    const connection=currentConnection.rows[0];
    if(!connection||connection.provider!==run.provider||connection.owner_type!==run.credit_owner_type||!(connection.allowed_models as string[]).includes(run.model)) throw new AiControlError("RECONFIRM_REQUIRED","Connection policy changed. Request a new estimate.",409);
    if(!(currentRule.rows[0].provider_allowlist as string[]).includes(run.provider)||!(currentRule.rows[0].model_allowlist as string[]).includes(run.model)||currentPrice.rows[0].currency!==run.currency) throw new AiControlError("RECONFIRM_REQUIRED","Pricing or entitlement changed. Request a new estimate.",409);
    const amount=BigInt(run.estimated_max_micros);
    if (run.budget_id) {
      const br=await client.query(`SELECT * FROM company_ai_budgets WHERE id=$1 FOR UPDATE`,[run.budget_id]); const budget=br.rows[0];
      if (!budget||budget.status!=="active"||BigInt(budget.limit_micros)-BigInt(budget.reserved_micros)-BigInt(budget.settled_micros)<amount) throw new AiControlError("BUDGET_EXHAUSTED", "AI budget cannot cover this request.",409);
      if(budget.funding_owner_type!==run.credit_owner_type||budget.currency!==run.currency||!(budget.provider_allowlist as string[]).includes(run.provider)||!(budget.model_allowlist as string[]).includes(run.model)||!(budget.capability_allowlist as string[]).includes(run.capability)||BigInt(budget.per_request_limit_micros)<amount) throw new AiControlError("BUDGET_POLICY_FORBIDDEN","Budget policy no longer permits this request.",403);
      const used=await periodUsage(client,"budget_id",run.budget_id,run.session_id);
      if(BigInt(used.daily)+amount>BigInt(budget.daily_limit_micros)||BigInt(used.monthly)+amount>BigInt(budget.monthly_limit_micros)||BigInt(used.session)+amount>BigInt(budget.session_limit_micros))throw new AiControlError("BUDGET_PERIOD_LIMIT","Daily, monthly, or session budget limit would be exceeded.",409);
      let allocation=null;if(run.allocation_id){const ar=await client.query(`SELECT * FROM user_ai_allocations WHERE id=$1 AND status='active' FOR UPDATE`,[run.allocation_id]);allocation=ar.rows[0];if(!allocation||BigInt(allocation.limit_micros)-BigInt(allocation.reserved_micros)-BigInt(allocation.settled_micros)<amount)throw new AiControlError("ALLOCATION_EXHAUSTED","User AI allocation cannot cover this request.",409);const usedAlloc=await periodUsage(client,"allocation_id",run.allocation_id,run.session_id);if(BigInt(usedAlloc.daily)+amount>BigInt(allocation.daily_limit_micros)||BigInt(usedAlloc.monthly)+amount>BigInt(allocation.monthly_limit_micros)||BigInt(usedAlloc.session)+amount>BigInt(allocation.session_limit_micros))throw new AiControlError("ALLOCATION_PERIOD_LIMIT","Daily, monthly, or session allocation limit would be exceeded.",409);}
      await client.query(`UPDATE company_ai_budgets SET reserved_micros=reserved_micros+$2 WHERE id=$1`,[run.budget_id,amount.toString()]);
      if(allocation)await client.query(`UPDATE user_ai_allocations SET reserved_micros=reserved_micros+$2,updated_at=now() WHERE id=$1`,[run.allocation_id,amount.toString()]);
    }
    await client.query(`INSERT INTO ai_usage_costs (id,run_id,entry_type,amount_micros,currency,price_schedule_id,actor_user_id,idempotency_key) VALUES ($1,$2,'reservation',$3,$4,$5,$6,'reservation')`,[uuid(),run.id,amount.toString(),run.currency,run.price_schedule_id,actor.userId]);
    const updated=await client.query(`UPDATE ai_runs SET status='reserved',reserved_micros=$2,updated_at=now() WHERE id=$1 RETURNING *`,[run.id,amount.toString()]);
    await client.query("COMMIT"); return updated.rows[0];
  } catch(e){await client.query("ROLLBACK");throw e;} finally{client.release();}
}

export async function cancelRun(actor: Actor, runId: string) { return releaseOrSettle(actor,runId,{kind:"cancel"}); }
export type ProviderBrokerSettlement={source:"provider_broker";runId:string;inputTokens:number;outputTokens:number;providerRequestId:string};
export async function settleRunFromBroker(input:ProviderBrokerSettlement) { if(input.source!=="provider_broker")throw new AiControlError("INTERNAL_BROKER_REQUIRED","Settlement is available only to the typed provider broker.",403);const owner=await pool.query(`SELECT user_id,company_id FROM ai_runs WHERE id=$1`,[input.runId]);if(!owner.rows[0])throw new AiControlError("RUN_NOT_FOUND","AI run not found.",404);return releaseOrSettle({userId:owner.rows[0].user_id,companyId:owner.rows[0].company_id,isSuperAdmin:false,isCompanyAdmin:false},input.runId,{kind:"settle",inputTokens:positiveInt(input.inputTokens,"inputTokens",true),outputTokens:positiveInt(input.outputTokens,"outputTokens",true),providerRequestId:input.providerRequestId}); }
export type ProviderBrokerFailure={source:"provider_broker";runId:string;providerRequestId?:string;errorCode:string};
export async function failRunFromBroker(input:ProviderBrokerFailure) { if(input.source!=="provider_broker")throw new AiControlError("INTERNAL_BROKER_REQUIRED","Failure recording is available only to the typed provider broker.",403);const owner=await pool.query(`SELECT user_id,company_id FROM ai_runs WHERE id=$1`,[input.runId]);if(!owner.rows[0])throw new AiControlError("RUN_NOT_FOUND","AI run not found.",404);const code=typeof input.errorCode==="string"&&input.errorCode.trim()?input.errorCode.trim():(()=>{throw new AiControlError("ERROR_CODE_REQUIRED","Provider failure code is required.");})();return releaseOrSettle({userId:owner.rows[0].user_id,companyId:owner.rows[0].company_id,isSuperAdmin:false,isCompanyAdmin:false},input.runId,{kind:"fail",providerRequestId:input.providerRequestId||null,errorCode:code}); }

async function releaseOrSettle(actor:Actor,runId:string,op:{kind:"cancel"}|{kind:"settle";inputTokens:number;outputTokens:number;providerRequestId:string}|{kind:"fail";providerRequestId:string|null;errorCode:string}){
 const client=await pool.connect(); try{await client.query("BEGIN"); const rr=await client.query(`SELECT * FROM ai_runs WHERE id=$1 AND user_id=$2 FOR UPDATE`,[runId,actor.userId]);const run=rr.rows[0];if(!run)throw new AiControlError("RUN_NOT_FOUND","AI run not found.",404);if(op.kind==="cancel"&&run.status==="cancelled"){await client.query("COMMIT");return run;}if(op.kind==="settle"&&run.status==="settled"){if(run.input_tokens_actual!==op.inputTokens||run.output_tokens_actual!==op.outputTokens||run.provider_request_id!==op.providerRequestId)throw new AiControlError("IDEMPOTENCY_CONFLICT","Settlement callback was retried with different provider usage.",409);await client.query("COMMIT");return run;}if(op.kind==="fail"&&run.status==="failed"){const existing=await client.query(`SELECT reason,provider_request_id FROM ai_usage_costs WHERE run_id=$1 AND idempotency_key='provider-failure'`,[run.id]);const row=existing.rows[0];if(!row||row.reason!==op.errorCode||((row.provider_request_id||null)!==(op.providerRequestId||null)))throw new AiControlError("IDEMPOTENCY_CONFLICT","Failure callback was retried with different details.",409);await client.query("COMMIT");return run;}if(run.status!=="reserved")throw new AiControlError("RUN_NOT_RESERVED","Only a reserved run can be settled, failed, or cancelled.",409);
 const reserved=BigInt(run.reserved_micros);let actual=0n;if(op.kind==="settle"){const pr=await client.query(`SELECT * FROM ai_price_schedules WHERE id=$1`,[run.price_schedule_id]);const price=pr.rows[0];actual=calculate(BigInt(op.inputTokens),BigInt(price.input_micros),BigInt(price.unit_basis))+calculate(BigInt(op.outputTokens),BigInt(price.output_micros),BigInt(price.unit_basis));if(actual>reserved)throw new AiControlError("ACTUAL_EXCEEDS_RESERVATION","Provider-reported usage exceeds the reserved maximum; correction review is required.",409);}
 if(run.budget_id){await client.query(`UPDATE company_ai_budgets SET reserved_micros=reserved_micros-$2,settled_micros=settled_micros+$3 WHERE id=$1`,[run.budget_id,reserved.toString(),actual.toString()]);if(run.allocation_id)await client.query(`UPDATE user_ai_allocations SET reserved_micros=reserved_micros-$2,settled_micros=settled_micros+$3,updated_at=now() WHERE id=$1`,[run.allocation_id,reserved.toString(),actual.toString()]);}
 if(op.kind==="settle")await client.query(`INSERT INTO ai_usage_costs (id,run_id,entry_type,amount_micros,currency,input_tokens,output_tokens,provider_request_id,price_schedule_id,actor_user_id,idempotency_key) VALUES ($1,$2,'settlement',$3,$4,$5,$6,$7,$8,$9,'settlement')`,[uuid(),run.id,actual.toString(),run.currency,op.inputTokens,op.outputTokens,op.providerRequestId,run.price_schedule_id,actor.userId]);
 if(op.kind==="fail")await client.query(`INSERT INTO ai_usage_costs (id,run_id,entry_type,amount_micros,currency,provider_request_id,price_schedule_id,actor_user_id,idempotency_key,reason) VALUES ($1,$2,'failure','0',$3,$4,$5,$6,'provider-failure',$7)`,[uuid(),run.id,run.currency,op.providerRequestId,run.price_schedule_id,actor.userId,op.errorCode]);
 const unused=reserved-actual;if(unused>0n)await client.query(`INSERT INTO ai_usage_costs (id,run_id,entry_type,amount_micros,currency,price_schedule_id,actor_user_id,idempotency_key) VALUES ($1,$2,'release',$3,$4,$5,$6,$7)`,[uuid(),run.id,(-unused).toString(),run.currency,run.price_schedule_id,actor.userId,op.kind==="cancel"?"cancel-release":op.kind==="fail"?"failure-release":"settlement-release"]);
 const updated=await client.query(`UPDATE ai_runs SET status=$2,actual_micros=$3,provider_request_id=$4,input_tokens_actual=$5,output_tokens_actual=$6,updated_at=now() WHERE id=$1 RETURNING *`,[run.id,op.kind==="cancel"?"cancelled":op.kind==="fail"?"failed":"settled",op.kind==="settle"?actual.toString():null,op.kind==="settle"?op.providerRequestId:op.kind==="fail"?op.providerRequestId:null,op.kind==="settle"?op.inputTokens:null,op.kind==="settle"?op.outputTokens:null]);await client.query("COMMIT");return updated.rows[0];
 }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}}

export async function addInternalCorrection(actor:Actor,runId:string,body:Record<string,unknown>){if(!actor.isSuperAdmin)throw new AiControlError("SUPER_ADMIN_REQUIRED","Super admin access required.",403);const amount=typeof body.amountMicros==="string"&&/^-?\d+$/.test(body.amountMicros)?BigInt(body.amountMicros):(()=>{throw new AiControlError("AMOUNT_INVALID","Correction amount must be an integer string.");})();if(amount===0n)throw new AiControlError("AMOUNT_INVALID","Correction amount cannot be zero.");const reason=typeof body.reason==="string"&&body.reason.trim()?body.reason.trim():(()=>{throw new AiControlError("REASON_REQUIRED","Correction reason is required.");})();const key=typeof body.idempotencyKey==="string"&&body.idempotencyKey.trim()?body.idempotencyKey.trim():(()=>{throw new AiControlError("IDEMPOTENCY_REQUIRED","Idempotency key is required.");})();const correctionOfId=typeof body.correctionOfId==="string"&&body.correctionOfId.trim()?body.correctionOfId.trim():(()=>{throw new AiControlError("CORRECTION_LINK_REQUIRED","Correction linkage is required.");})();const fingerprint=digest({amountMicros:amount.toString(),reason,correctionOfId});const client=await pool.connect();try{await client.query("BEGIN");const rr=await client.query(`SELECT * FROM ai_runs WHERE id=$1 FOR UPDATE`,[runId]);const run=rr.rows[0];if(!run)throw new AiControlError("RUN_NOT_FOUND","AI run not found.",404);const linked=await client.query(`SELECT id FROM ai_usage_costs WHERE id=$1 AND run_id=$2 AND entry_type IN ('settlement','correction')`,[correctionOfId,runId]);if(!linked.rows[0])throw new AiControlError("CORRECTION_LINK_INVALID","Correction must link to an existing settlement or correction receipt for this run.",409);const existing=await client.query(`SELECT * FROM ai_usage_costs WHERE run_id=$1 AND idempotency_key=$2`,[runId,key]);if(existing.rows[0]){const existingFingerprint=digest({amountMicros:String(existing.rows[0].amount_micros),reason:existing.rows[0].reason,correctionOfId:existing.rows[0].correction_of_id});if(existingFingerprint!==fingerprint)throw new AiControlError("IDEMPOTENCY_CONFLICT","Correction idempotency key was reused with different details.",409);await client.query("COMMIT");return existing.rows[0];}if(run.budget_id){const updatedBudget=await client.query(`UPDATE company_ai_budgets SET settled_micros=settled_micros+$2 WHERE id=$1 AND settled_micros+$2>=0 RETURNING id`,[run.budget_id,amount.toString()]);if(!updatedBudget.rows[0])throw new AiControlError("CORRECTION_NEGATIVE_TOTAL","Correction would make budget settled total negative.",409);if(run.allocation_id){const updatedAllocation=await client.query(`UPDATE user_ai_allocations SET settled_micros=settled_micros+$2,updated_at=now() WHERE id=$1 AND settled_micros+$2>=0 RETURNING id`,[run.allocation_id,amount.toString()]);if(!updatedAllocation.rows[0])throw new AiControlError("CORRECTION_NEGATIVE_TOTAL","Correction would make allocation settled total negative.",409);}}const row=await client.query(`INSERT INTO ai_usage_costs(id,run_id,entry_type,amount_micros,currency,price_schedule_id,correction_of_id,reason,actor_user_id,idempotency_key) VALUES($1,$2,'correction',$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[uuid(),runId,amount.toString(),run.currency,run.price_schedule_id,correctionOfId,reason,actor.userId,key]);await recordAudit(actor.userId,"ai_usage_cost_correction_appended","ai_run",runId,{amountMicros:amount.toString(),reason,correctionOfId,idempotencyKey:key});await client.query("COMMIT");return row.rows[0];}catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}}

export async function listUsage(actor:Actor){const result=await pool.query(`SELECT r.id,r.capability,r.purpose,r.provider,r.model,r.credit_owner_type,r.status,r.estimated_min_micros,r.estimated_max_micros,r.reserved_micros,r.actual_micros,r.currency,r.created_at,r.updated_at,COALESCE(json_agg(json_build_object('id',c.id,'type',c.entry_type,'amountMicros',c.amount_micros,'inputTokens',c.input_tokens,'outputTokens',c.output_tokens,'providerRequestId',c.provider_request_id,'reason',c.reason,'createdAt',c.created_at) ORDER BY c.created_at) FILTER(WHERE c.id IS NOT NULL),'[]') receipts FROM ai_runs r LEFT JOIN ai_usage_costs c ON c.run_id=r.id WHERE r.user_id=$1 GROUP BY r.id ORDER BY r.created_at DESC LIMIT 100`,[actor.userId]);return result.rows;}

export const aiControlInternals={digest,calculate};
