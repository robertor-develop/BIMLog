import { decideEdtRecordAuthorization, type EdtRecordAuthorizationInput } from "./edt-engine-authorization";
import { loadEdtActivationCandidate, fingerprintEdtActivationCandidate } from "./edt-engine-activation-candidate";
import { deterministicEdtId, EdtEngineConflict, withEdtTransaction, type EdtTransactionHost } from "./edt-engine-transaction";

type Actor = Pick<EdtRecordAuthorizationInput, "grants" | "actorUserId" | "actorCompanyId" | "actorProjectIds"> & { eligibleRole: string };

function requireEdtPermission(actor: Actor, permission: EdtRecordAuthorizationInput["permission"], companyId: number, projectId: number,
  requesterId?: number): void {
  const decision = decideEdtRecordAuthorization({ ...actor, permission, recordCompanyId: companyId,
    recordProjectId: projectId, recordRequesterUserId: requesterId });
  if (!decision.allow) throw new EdtEngineConflict(decision.code, "Governed EDT activation authorization denied.");
}

function requireReasonAndKey(reason: string, idempotencyKey: string): void {
  if (!reason.trim() || reason.length > 2000) throw new EdtEngineConflict("REASON_REQUIRED", "A bounded audit reason is required.");
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(idempotencyKey))
    throw new EdtEngineConflict("IDEMPOTENCY_KEY_INVALID", "A stable 8–128 character idempotency key is required.");
}

export function validateResolvedEdtRequestIntent(input: {
  actor: Actor; companyId: number; projectId: number; expectedFingerprint: string;
  reason: string; idempotencyKey: string;
}): void {
  requireEdtPermission(input.actor, "JOB_ACTIVATION_REQUEST", input.companyId, input.projectId);
  requireReasonAndKey(input.reason, input.idempotencyKey);
  if (!/^[a-f0-9]{64}$/.test(input.expectedFingerprint))
    throw new EdtEngineConflict("EDT_CANDIDATE_STALE", "Refresh the saved EDT candidate before requesting activation.");
}

/** The only input from the browser is intent and its last observed fingerprint; all authority is reloaded. */
export async function requestResolvedEdtActivation(input: {
  actor: Actor; companyId: number; projectId: number; intakeId: string;
  expectedFingerprint: string; reason: string; idempotencyKey: string;
}, host?: EdtTransactionHost) {
  validateResolvedEdtRequestIntent(input);
  return withEdtTransaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`edt-activation:${input.intakeId}`]);
    const candidate = await loadEdtActivationCandidate(client, input);
    if (candidate.requestFingerprint !== input.expectedFingerprint ||
      fingerprintEdtActivationCandidate(candidate) !== candidate.requestFingerprint)
      throw new EdtEngineConflict("EDT_CANDIDATE_STALE", "Saved EDT source changed. Refresh its preview before requesting activation.");
    const existing = (await client.query<{ id: string; idempotency_key: string; request_fingerprint: string; state: string }>(
      "SELECT id,idempotency_key,request_fingerprint,state FROM job_activation_requests WHERE intake_id=$1 AND company_id=$2 AND project_id=$3 ORDER BY created_at,id FOR UPDATE",
      [input.intakeId, input.companyId, input.projectId])).rows;
    const replay = existing.find(row => row.idempotency_key === input.idempotencyKey);
    if (replay) {
      if (replay.request_fingerprint !== candidate.requestFingerprint)
        throw new EdtEngineConflict("IDEMPOTENCY_CONFLICT", "The idempotency key belongs to another EDT candidate.");
      return { id: replay.id, fingerprint: replay.request_fingerprint, state: replay.state, idempotent: true };
    }
    if (existing.some(row => row.state === "pending"))
      throw new EdtEngineConflict("EDT_REQUEST_PENDING", "Resolve the existing EDT activation request before creating another.");
    if (existing.some(row => row.state === "approved"))
      throw new EdtEngineConflict("EDT_ALREADY_ACTIVATED", "This Intake already has an approved EDT activation.");
    const nodes = (await client.query<{ id: string }>(
      "SELECT id FROM job_activation_edt_nodes WHERE intake_id=$1 AND company_id=$2 AND project_id=$3 LIMIT 1",
      [input.intakeId, input.companyId, input.projectId])).rows;
    if (nodes.length) throw new EdtEngineConflict("EDT_ALREADY_ACTIVATED", "This Intake already has saved EDT nodes.");
    const id = deterministicEdtId("activation-request", `${input.intakeId}:${input.idempotencyKey}`);
    await client.query(`INSERT INTO job_activation_requests(id,company_id,project_id,intake_id,intake_revision,governance_version_id,
      pricing_version_id,workflow_version_ids,request_fingerprint,idempotency_key,requested_by_id,eligible_role,reason,evidence)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,'{}'::jsonb)`,
      [id, input.companyId, input.projectId, input.intakeId, candidate.intakeRevision, candidate.governanceVersionId,
        candidate.pricingVersionId, JSON.stringify(candidate.workflowVersionIds), candidate.requestFingerprint,
        input.idempotencyKey, input.actor.actorUserId, input.actor.eligibleRole, input.reason.trim()]);
    return { id, fingerprint: candidate.requestFingerprint, state: "pending", idempotent: false };
  }, host);
}
