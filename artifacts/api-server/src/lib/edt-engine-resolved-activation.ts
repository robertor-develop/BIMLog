import { decideEdtRecordAuthorization, type EdtRecordAuthorizationInput } from "./edt-engine-authorization";
import { loadEdtActivationCandidate, fingerprintEdtActivationCandidate } from "./edt-engine-activation-candidate";
import { validateEdtPlanCoverage, validateEdtPlanNodes, validateEdtPlanSourceBindings, validateEdtPlanWorkItems } from "./edt-engine-activation-service";
import { deterministicEdtId, edtFingerprint, EdtEngineConflict, withEdtTransaction, type EdtTransactionHost } from "./edt-engine-transaction";

type Actor = Pick<EdtRecordAuthorizationInput, "grants" | "actorUserId" | "actorCompanyId" | "actorProjectIds"> & { eligibleRole: string };

export const EDT_RESOLVED_REQUEST_INSERT_SQL = `INSERT INTO job_activation_requests(id,company_id,project_id,intake_id,intake_revision,governance_version_id,
  pricing_version_id,workflow_version_ids,request_fingerprint,idempotency_key,requested_by_id,eligible_role,reason,evidence)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,'{}'::jsonb)`;
export const EDT_RESOLVED_NODE_INSERT_SQL = `INSERT INTO job_activation_edt_nodes(id,company_id,project_id,intake_id,parent_id,node_kind,
  source_identity,code,name,sequence,source_snapshot,source_fingerprint,created_by_id)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13)`;
export const EDT_RESOLVED_WORK_ITEM_UPDATE_SQL = `UPDATE job_activation_work_items SET edt_node_id=$2,location_identity=$3,
  location_snapshot=$4::jsonb,trade_identity=$5,trade_snapshot=$6::jsonb,deliverable_type_identity=$7,
  deliverable_type_snapshot=$8::jsonb,display_code=$9,revision_number=0,issuance_version=0,
  identity_fingerprint=$10,updated_at=now() WHERE id=$1 AND project_id=$11 AND intake_id=$12 AND edt_node_id IS NULL`;
export const EDT_RESOLVED_DECISION_INSERT_SQL = `INSERT INTO job_activation_decisions(id,request_id,company_id,project_id,outcome,request_fingerprint,
  decided_by_id,eligible_role,reason,evidence)
  VALUES($1,$2,$3,$4,'approved',$5,$6,$7,$8,$9::jsonb)`;

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
    await client.query(EDT_RESOLVED_REQUEST_INSERT_SQL,
      [id, input.companyId, input.projectId, input.intakeId, candidate.intakeRevision, candidate.governanceVersionId,
        candidate.pricingVersionId, JSON.stringify(candidate.workflowVersionIds), candidate.requestFingerprint,
        input.idempotencyKey, input.actor.actorUserId, input.actor.eligibleRole, input.reason.trim()]);
    return { id, fingerprint: candidate.requestFingerprint, state: "pending", idempotent: false };
  }, host);
}

export function validateResolvedEdtApprovalIntent(input: {
  actor: Actor; companyId: number; projectId: number; expectedFingerprint: string;
  reason: string; requesterId: number;
}): void {
  requireEdtPermission(input.actor, "JOB_ACTIVATION_APPROVE", input.companyId, input.projectId, input.requesterId);
  if (!/^[a-f0-9]{64}$/.test(input.expectedFingerprint))
    throw new EdtEngineConflict("EDT_CANDIDATE_STALE", "The EDT request fingerprint is invalid.");
  if (!input.reason.trim() || input.reason.length > 2000)
    throw new EdtEngineConflict("REASON_REQUIRED", "An approval reason is required for the immutable audit decision.");
}

/** Approves an already activated Intake's EDT projection without reactivating Intake or accepting browser-authored nodes. */
export async function approveResolvedEdtActivation(input: {
  actor: Actor; companyId: number; projectId: number; requestId: string;
  expectedFingerprint: string; reason: string;
}, host?: EdtTransactionHost) {
  return withEdtTransaction(async client => {
    const request = (await client.query<{
      id: string; company_id: number; project_id: number; intake_id: string; intake_revision: number;
      governance_version_id: string; pricing_version_id: string; workflow_version_ids: unknown;
      request_fingerprint: string; requested_by_id: number; state: string;
    }>("SELECT * FROM job_activation_requests WHERE id=$1 AND company_id=$2 AND project_id=$3",
      [input.requestId, input.companyId, input.projectId])).rows[0];
    if (!request) throw new EdtEngineConflict("ACTIVATION_REQUEST_NOT_FOUND", "The scoped EDT request was not found.");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`edt-activation:${request.intake_id}`]);
    const lockedRequest = (await client.query<typeof request>(
      "SELECT * FROM job_activation_requests WHERE id=$1 AND company_id=$2 AND project_id=$3 FOR UPDATE",
      [input.requestId, input.companyId, input.projectId])).rows[0];
    if (!lockedRequest || lockedRequest.intake_id !== request.intake_id)
      throw new EdtEngineConflict("ACTIVATION_REQUEST_MISMATCH", "The EDT request identity changed during approval.");
    Object.assign(request, lockedRequest);
    validateResolvedEdtApprovalIntent({ ...input, requesterId: request.requested_by_id });
    if (request.request_fingerprint !== input.expectedFingerprint)
      throw new EdtEngineConflict("EDT_CANDIDATE_STALE", "The EDT request differs from the preview being approved.");
    if (request.state === "approved") {
      const decision = (await client.query<{ id: string; request_fingerprint: string; outcome: string }>(
        "SELECT id,request_fingerprint,outcome FROM job_activation_decisions WHERE request_id=$1 AND company_id=$2 AND project_id=$3",
        [request.id, input.companyId, input.projectId])).rows[0];
      if (decision?.outcome === "approved" && decision.request_fingerprint === request.request_fingerprint)
        return { decisionId: decision.id, idempotent: true };
      throw new EdtEngineConflict("ACTIVATION_DECISION_INCONSISTENT", "An approved request has no matching immutable decision.");
    }
    if (request.state !== "pending") throw new EdtEngineConflict("ACTIVATION_REQUEST_NOT_PENDING", "Only a pending EDT request can be approved.");
    const candidate = await loadEdtActivationCandidate(client, {
      companyId: input.companyId, projectId: input.projectId, intakeId: request.intake_id,
    });
    if (candidate.requestFingerprint !== request.request_fingerprint ||
      candidate.intakeRevision !== request.intake_revision ||
      candidate.governanceVersionId !== request.governance_version_id ||
      candidate.pricingVersionId !== request.pricing_version_id ||
      JSON.stringify(candidate.workflowVersionIds) !== JSON.stringify(request.workflow_version_ids))
      throw new EdtEngineConflict("EDT_CANDIDATE_STALE", "The saved source changed after request. Start a new review from the current Intake.");
    validateEdtPlanNodes(candidate.plan.nodes);
    validateEdtPlanWorkItems(candidate.plan.nodes, candidate.plan.workItems);
    const saved = (await client.query<{ id: string; contractId: string | null; stableScopeItemId: string; edtNodeId: string | null; displayCode: string | null }>(
      `SELECT id,contract_id AS "contractId",stable_scope_item_id AS "stableScopeItemId",
        edt_node_id AS "edtNodeId",display_code AS "displayCode" FROM job_activation_work_items
        WHERE intake_id=$1 AND project_id=$2 AND status<>'cancelled' ORDER BY id FOR UPDATE`,
      [request.intake_id, input.projectId])).rows;
    validateEdtPlanCoverage(saved.map(item => item.id), candidate.plan.workItems);
    validateEdtPlanSourceBindings(saved, candidate.plan.workItems);
    if (saved.some(item => item.edtNodeId || item.displayCode))
      throw new EdtEngineConflict("EDT_ALREADY_ACTIVATED", "A saved Work Item already has an EDT identity.");
    const existingNodes = (await client.query<{ id: string }>(
      "SELECT id FROM job_activation_edt_nodes WHERE intake_id=$1 AND company_id=$2 AND project_id=$3 LIMIT 1",
      [request.intake_id, input.companyId, input.projectId])).rows;
    if (existingNodes.length) throw new EdtEngineConflict("EDT_ALREADY_ACTIVATED", "This Intake already has EDT nodes.");
    const nodeIds = new Map<string, string>();
    for (const node of candidate.plan.nodes) {
      const id = deterministicEdtId("edt-node", `${request.intake_id}:${node.kind}:${node.sourceIdentity}`);
      const parentId = node.parentSourceIdentity ? nodeIds.get(node.parentSourceIdentity) : null;
      if (node.parentSourceIdentity && !parentId)
        throw new EdtEngineConflict("EDT_PLAN_INCOMPLETE", "An EDT node parent is missing.");
      nodeIds.set(node.sourceIdentity, id);
      await client.query(EDT_RESOLVED_NODE_INSERT_SQL,
        [id, input.companyId, input.projectId, request.intake_id, parentId, node.kind, node.sourceIdentity,
          node.code, node.name, node.sequence, JSON.stringify(node.snapshot), edtFingerprint(node.snapshot), input.actor.actorUserId]);
    }
    for (const item of candidate.plan.workItems) {
      const identity = { locationIdentity: item.locationIdentity, tradeIdentity: item.tradeIdentity,
        deliverableTypeIdentity: item.deliverableTypeIdentity };
      const updated = await client.query(EDT_RESOLVED_WORK_ITEM_UPDATE_SQL,
        [item.id, nodeIds.get(item.edtNodeSourceIdentity), item.locationIdentity, JSON.stringify(item.locationSnapshot),
          item.tradeIdentity, JSON.stringify(item.tradeSnapshot), item.deliverableTypeIdentity,
          JSON.stringify(item.deliverableTypeSnapshot), item.displayCode, edtFingerprint(identity),
          input.projectId, request.intake_id]);
      if (updated.rowCount !== 1)
        throw new EdtEngineConflict("EDT_WORK_ITEM_SCOPE_MISMATCH", "A planned Work Item changed during EDT approval.");
    }
    const decisionId = deterministicEdtId("activation-decision", `${request.id}:${request.request_fingerprint}`);
    await client.query(EDT_RESOLVED_DECISION_INSERT_SQL,
      [decisionId, request.id, input.companyId, input.projectId, request.request_fingerprint,
        input.actor.actorUserId, input.actor.eligibleRole, input.reason.trim(),
        JSON.stringify({ sourceFingerprint: candidate.sourceFingerprint })]);
    const updatedRequest = await client.query("UPDATE job_activation_requests SET state='approved',decided_at=now(),optimistic_version=optimistic_version+1 WHERE id=$1 AND state='pending'", [request.id]);
    if (updatedRequest.rowCount !== 1)
      throw new EdtEngineConflict("ACTIVATION_REQUEST_NOT_PENDING", "The EDT request changed during approval.");
    return { decisionId, idempotent: false, nodeCount: candidate.plan.nodes.length,
      workItemCount: candidate.plan.workItems.length };
  }, host);
}
