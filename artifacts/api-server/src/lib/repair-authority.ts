import crypto from "node:crypto";
import { promisify } from "node:util";
import { pool } from "@workspace/db";
import { ensureRepairAuthoritySchema } from "./repair-authority-migration";

const scrypt = promisify(crypto.scrypt);
const text = (value: unknown, maximum: number) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maximum) : "";
const secretPattern = /(?:password|secret|token|api[_ -]?key|bearer)\s*[:=]/i;
export type RepairActor = { userId: number; companyId: number; isSuperAdmin: boolean };
export class RepairAuthorityError extends Error { constructor(public code: string, message: string, public status = 400) { super(message); } }
const fail = (code: string, message: string, status = 400): never => { throw new RepairAuthorityError(code, message, status); };
const digest = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const executionStates = new Set(["implementing","testing","deployed","verified","failed"]);
function verifyBridgeKey(value: unknown) { const expected=process.env.BIMLOG_ORION_BRIDGE_KEY||""; const supplied=typeof value==="string"?value:""; if(expected.length<32||supplied.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))fail("REPAIR_BRIDGE_DENIED","Verified Orion MAIN bridge credentials are required.",401); }
async function executionConnected(){if((process.env.BIMLOG_ORION_BRIDGE_KEY||"").length<32)return false;const row=await pool.query(`SELECT 1 FROM platform_repair_bridges WHERE bridge_id='orion-main' AND last_seen_at>now()-interval '5 minutes'`);return Boolean(row.rows[0]);}
async function pinDigest(userId: number, pin: string, salt: string) {
  if (!/^\d{4,12}$/.test(pin)) fail("REPAIR_PIN_INVALID", "Enter the configured 4–12 digit repair PIN.");
  const pepper = process.env.BIMLOG_REPAIR_PIN_PEPPER;
  if (!pepper || pepper.length < 32) fail("REPAIR_SECURITY_UNAVAILABLE", "Repair confirmation is not configured.", 503);
  return (await scrypt(`${userId}\0${pin}\0${pepper}`, salt, 32) as Buffer).toString("hex");
}
async function event(actor: RepairActor, proposalId: string | null, action: string, evidence: object = {}) {
  await pool.query(`INSERT INTO platform_repair_events(id,company_id,actor_id,proposal_id,action,evidence) VALUES($1,$2,$3,$4,$5,$6::jsonb)`, [crypto.randomUUID(), actor.companyId, actor.userId, proposalId, action, JSON.stringify(evidence)]);
}
export async function canAuthorizeRepair(actor: RepairActor) {
  if (actor.isSuperAdmin) return true;
  await ensureRepairAuthoritySchema();
  const row = await pool.query(`SELECT 1 FROM platform_repair_delegates WHERE company_id=$1 AND user_id=$2 AND active=true`, [actor.companyId, actor.userId]);
  return Boolean(row.rows[0]);
}
async function verifyPin(actor: RepairActor, pin: unknown) {
  if (!await canAuthorizeRepair(actor)) fail("REPAIR_AUTHORITY_REQUIRED", "Only a Global Super Administrator or explicitly delegated repair approver may authorize platform repairs.", 403);
  const row = await pool.query(`UPDATE platform_repair_pins SET attempts=CASE WHEN window_until IS NULL OR window_until<=now() THEN 1 ELSE attempts+1 END,window_until=CASE WHEN window_until IS NULL OR window_until<=now() THEN now()+interval '15 minutes' ELSE window_until END WHERE user_id=$1 AND (window_until IS NULL OR window_until<=now() OR attempts<5) RETURNING salt,digest`, [actor.userId]);
  if (!row.rows[0]) fail("REPAIR_PIN_RATE_LIMITED", "PIN is not configured or the attempt limit was reached.", 429);
  let accepted = false;
  try { const calculated = await pinDigest(actor.userId, String(pin ?? ""), row.rows[0].salt); accepted = crypto.timingSafeEqual(Buffer.from(calculated, "hex"), Buffer.from(row.rows[0].digest, "hex")); } catch { accepted = false; }
  await event(actor, null, accepted ? "repair.pin_confirmed" : "repair.pin_rejected");
  if (!accepted) fail("REPAIR_PIN_REJECTED", "Repair PIN was not accepted.", 403);
}
export async function configureRepairPin(actor: RepairActor, pin: unknown, currentPin?: unknown) {
  await ensureRepairAuthoritySchema(); if (!await canAuthorizeRepair(actor)) fail("REPAIR_AUTHORITY_REQUIRED", "Repair authority is required.", 403);
  const existing = await pool.query(`SELECT 1 FROM platform_repair_pins WHERE user_id=$1`, [actor.userId]); if (existing.rows[0]) await verifyPin(actor, currentPin);
  const salt = crypto.randomBytes(24).toString("hex"), calculated = await pinDigest(actor.userId, String(pin ?? ""), salt);
  await pool.query(`INSERT INTO platform_repair_pins(user_id,salt,digest) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET salt=excluded.salt,digest=excluded.digest,attempts=0,window_until=NULL,version=platform_repair_pins.version+1,updated_at=now()`, [actor.userId, salt, calculated]);
  await event(actor, null, "repair.pin_configured"); return { configured: true };
}
export async function setRepairDelegate(actor: RepairActor, input: Record<string, unknown>) {
  await ensureRepairAuthoritySchema();
  if (!actor.isSuperAdmin) fail("REPAIR_DELEGATION_FORBIDDEN", "Only a Global Super Administrator may grant platform repair authority.", 403);
  const email = text(input.email, 320).toLowerCase(), active = input.active === true;
  if (!email.includes("@")) fail("REPAIR_DELEGATE_EMAIL_REQUIRED", "Enter an existing user's email address.");
  const user = await pool.query(`SELECT id,company_id,email FROM users WHERE lower(email)=$1 AND company_id=$2 LIMIT 1`, [email, actor.companyId]);
  if (!user.rows[0]) fail("REPAIR_DELEGATE_NOT_FOUND", "No active user with that email belongs to this company.", 404);
  await pool.query(`INSERT INTO platform_repair_delegates(company_id,user_id,granted_by_id,active) VALUES($1,$2,$3,$4) ON CONFLICT(company_id,user_id) DO UPDATE SET granted_by_id=excluded.granted_by_id,active=excluded.active,updated_at=now()`, [actor.companyId, user.rows[0].id, actor.userId, active]);
  await event(actor, null, active ? "repair.delegate_granted" : "repair.delegate_revoked", { userId: user.rows[0].id });
  return { email: user.rows[0].email, active };
}
export async function reportRepair(actor: RepairActor, input: Record<string, unknown>) {
  await ensureRepairAuthoritySchema(); const issue = text(input.issue, 2000), scope = text(input.scope, 4000), tests = text(input.tests, 2000), page = text(input.page, 300), projectId = Number.isSafeInteger(input.projectId) ? Number(input.projectId) : null;
  if (issue.length < 10 || scope.length < 20 || tests.length < 10) fail("REPAIR_SCOPE_REQUIRED", "Issue, exact proposed scope, and verification tests are required.");
  if ([issue, scope, tests].some(value => secretPattern.test(value))) fail("REPAIR_SECRET_REJECTED", "Credentials and secrets are not accepted.");
  const payload = { issue, page, projectId, scope, tests, actions: ["implement", "test", "push", "deploy"], exclusions: ["customer actions", "payments", "credentials", "destructive production data changes"] };
  const id = crypto.randomUUID(), scopeDigest = digest(payload);
  await pool.query(`INSERT INTO platform_repair_proposals(id,company_id,project_id,reporter_id,payload,scope_digest,state) VALUES($1,$2,$3,$4,$5::jsonb,$6,'reported')`, [id, actor.companyId, projectId, actor.userId, JSON.stringify(payload), scopeDigest]);
  await event(actor, id, "repair.reported", { scopeDigest }); return { id, state: "reported", scopeDigest, ...payload };
}
export async function authorizeRepair(actor: RepairActor, id: string, input: Record<string, unknown>) {
  await ensureRepairAuthoritySchema(); await verifyPin(actor, input.pin); if (input.confirmed !== true) fail("REPAIR_CONFIRMATION_REQUIRED", "Confirm the exact displayed proposal.");
  const result = await pool.query(`UPDATE platform_repair_proposals SET state='authorized',approved_by_id=$1,expires_at=now()+interval '1 hour' WHERE id=$2 AND company_id=$3 AND state IN ('reported','proposed') AND scope_digest=$4 RETURNING id,state,scope_digest,expires_at`, [actor.userId, id, actor.companyId, text(input.scopeDigest, 64)]);
  if (!result.rows[0]) fail("REPAIR_PROPOSAL_CONFLICT", "The proposal changed, expired, or was already handled. Refresh and review it again.", 409);
  await event(actor, id, "repair.authorized", { scopeDigest: result.rows[0].scope_digest }); const connected=await executionConnected(); return { ...result.rows[0], executionConnected: connected, message: connected ? "Authorization recorded. Orion MAIN can now claim this exact proposal." : "Authorization recorded. Execution will begin when the verified Orion MAIN bridge reconnects and claims this exact proposal." };
}
export async function listRepairs(actor: RepairActor) {
  await ensureRepairAuthoritySchema(); const allowed = await canAuthorizeRepair(actor);
  const rows = await pool.query(`SELECT id,payload,scope_digest,state,created_at,expires_at,execution_receipt FROM platform_repair_proposals WHERE company_id=$1 AND ($2::boolean OR reporter_id=$3) ORDER BY created_at DESC LIMIT 30`, [actor.companyId, allowed, actor.userId]);
  return { canAuthorize: allowed, proposals: rows.rows, executionConnected: await executionConnected() };
}
export async function claimRepairExecution(bridgeKey: unknown, input: Record<string,unknown>) { await ensureRepairAuthoritySchema();verifyBridgeKey(bridgeKey);const bridgeVersion=text(input.bridgeVersion,80)||"unknown";await pool.query(`INSERT INTO platform_repair_bridges(bridge_id,version,metadata) VALUES('orion-main',$1,$2::jsonb) ON CONFLICT(bridge_id) DO UPDATE SET last_seen_at=now(),version=excluded.version,metadata=excluded.metadata`,[bridgeVersion,JSON.stringify({host:text(input.host,120)})]);const result=await pool.query(`WITH candidate AS (SELECT id FROM platform_repair_proposals WHERE state='authorized' AND expires_at>now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE platform_repair_proposals p SET state='implementing',execution_receipt=jsonb_build_object('bridgeId','orion-main','bridgeVersion',$1,'claimedAt',now(),'attempt',COALESCE((p.execution_receipt->>'attempt')::int,0)+1) FROM candidate WHERE p.id=candidate.id RETURNING p.id,p.company_id,p.project_id,p.payload,p.scope_digest,p.state,p.execution_receipt`,[bridgeVersion]);return {connected:true,proposal:result.rows[0]||null}; }
export async function updateRepairExecution(bridgeKey: unknown,id:string,input:Record<string,unknown>){await ensureRepairAuthoritySchema();verifyBridgeKey(bridgeKey);const state=text(input.state,20),scopeDigest=text(input.scopeDigest,64),message=text(input.message,2000),evidence=typeof input.evidence==="object"&&input.evidence!==null?input.evidence:{};if(!executionStates.has(state))fail("REPAIR_EXECUTION_STATE_INVALID","A valid execution state is required.");const result=await pool.query(`UPDATE platform_repair_proposals SET state=$1,execution_receipt=COALESCE(execution_receipt,'{}'::jsonb)||jsonb_build_object('updatedAt',now(),'message',$2,'evidence',$3::jsonb) WHERE id=$4 AND scope_digest=$5 AND state IN ('implementing','testing','deployed','verified','failed') RETURNING id,state,scope_digest,execution_receipt`,[state,message,JSON.stringify(evidence),id,scopeDigest]);if(!result.rows[0])fail("REPAIR_EXECUTION_CONFLICT","The repair scope or execution state changed. Refresh before reporting progress.",409);await pool.query(`UPDATE platform_repair_bridges SET last_seen_at=now() WHERE bridge_id='orion-main'`);return result.rows[0];}
