import { randomUUID } from "node:crypto";
import { EdtEngineConflict, withEdtTransaction, type EdtTransactionHost } from "./edt-engine-transaction";

export type EdtDirectorGrantAction = "grant" | "revoke";

export async function listEdtOperationsDirectorAssignments(input: {
  actorUserId: number; actorCompanyId: number; projectId: number;
}, host?: EdtTransactionHost) {
  return withEdtTransaction(async client => {
    const administrator = (await client.query<{ id: number }>(
      "SELECT id FROM users WHERE id=$1 AND company_id=$2 AND is_super_admin=true",
      [input.actorUserId, input.actorCompanyId])).rows[0];
    if (!administrator) throw new EdtEngineConflict("EDT_DIRECTOR_ADMIN_REQUIRED", "A current company Super Administrator must view Operations Director assignments.");
    const project = (await client.query<{ id: number }>(
      `SELECT p.id FROM projects p JOIN users owner ON owner.id=p.created_by_id
       LEFT JOIN LATERAL (SELECT company_id FROM project_company_binding_versions WHERE project_id=p.id ORDER BY version DESC LIMIT 1) binding ON true
       WHERE p.id=$1 AND p.status<>'archived' AND COALESCE(binding.company_id,owner.company_id)=$2`,
      [input.projectId, input.actorCompanyId])).rows[0];
    if (!project) throw new EdtEngineConflict("PROJECT_COMPANY_MISMATCH", "The project is outside the administrator's company.");
    const members = (await client.query<{
      user_id: number; full_name: string; email: string; project_role: string; active: boolean;
    }>(`SELECT u.id AS user_id,u.full_name,u.email,pm.role AS project_role,
         EXISTS(SELECT 1 FROM edt_operations_director_grants g WHERE g.company_id=$2 AND g.project_id=$1 AND g.user_id=u.id
           AND NOT EXISTS(SELECT 1 FROM edt_operations_director_revocations r WHERE r.grant_id=g.id)) AS active
       FROM project_members pm JOIN users u ON u.id=pm.user_id
       WHERE pm.project_id=$1 AND pm.status='active' AND u.company_id=$2 ORDER BY u.full_name,u.id`,
      [input.projectId, input.actorCompanyId])).rows;
    return members.map(member => ({ userId: member.user_id, fullName: member.full_name, email: member.email,
      projectRole: member.project_role, active: member.active }));
  }, host);
}

function boundedReason(value: string): string {
  const reason = value.trim();
  if (reason.length < 10 || reason.length > 2000)
    throw new EdtEngineConflict("REASON_REQUIRED", "Provide a 10–2000 character reason for Operations Director authority.");
  return reason;
}

/** A separate, current Super Administrator assigns this narrow EDT approval role to an active same-company project member. */
export async function changeEdtOperationsDirectorGrant(input: {
  actorUserId: number; actorCompanyId: number; projectId: number; targetUserId: number;
  action: EdtDirectorGrantAction; reason: string;
}, host?: EdtTransactionHost) {
  const reason = boundedReason(input.reason);
  if (!Number.isSafeInteger(input.projectId) || input.projectId < 1 ||
      !Number.isSafeInteger(input.targetUserId) || input.targetUserId < 1)
    throw new EdtEngineConflict("REQUEST_BODY_INVALID", "A valid project and existing user are required.");
  if (input.actorUserId === input.targetUserId)
    throw new EdtEngineConflict("SELF_GRANT_PROHIBITED", "A user cannot assign or revoke their own Operations Director authority.");
  return withEdtTransaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`edt-director:${input.projectId}:${input.targetUserId}`]);
    const actor = (await client.query<{ id: number }>(
      "SELECT id FROM users WHERE id=$1 AND company_id=$2 AND is_super_admin=true FOR SHARE",
      [input.actorUserId, input.actorCompanyId])).rows[0];
    if (!actor) throw new EdtEngineConflict("EDT_DIRECTOR_ADMIN_REQUIRED", "A current company Super Administrator must manage Operations Director authority.");
    const target = (await client.query<{ id: number }>(
      `SELECT u.id FROM users u JOIN project_members pm ON pm.user_id=u.id AND pm.project_id=$3 AND pm.status='active'
       JOIN projects p ON p.id=pm.project_id AND p.status<>'archived'
       JOIN users owner ON owner.id=p.created_by_id
       LEFT JOIN LATERAL (SELECT company_id FROM project_company_binding_versions WHERE project_id=p.id ORDER BY version DESC LIMIT 1) binding ON true
       WHERE u.id=$1 AND u.company_id=$2 AND COALESCE(binding.company_id,owner.company_id)=$2 FOR SHARE OF u,pm,p`,
      [input.targetUserId, input.actorCompanyId, input.projectId])).rows[0];
    if (!target) throw new EdtEngineConflict("EDT_DIRECTOR_SCOPE_REQUIRED", "The user must be an active member of this company-owned project.");
    const active = (await client.query<{ id: string }>(
      `SELECT g.id FROM edt_operations_director_grants g
       WHERE g.company_id=$1 AND g.project_id=$2 AND g.user_id=$3
         AND NOT EXISTS(SELECT 1 FROM edt_operations_director_revocations r WHERE r.grant_id=g.id)
       ORDER BY g.created_at DESC,g.id DESC LIMIT 1 FOR SHARE OF g`,
      [input.actorCompanyId, input.projectId, input.targetUserId])).rows[0];
    if (input.action === "grant") {
      if (active) return { grantId: active.id, active: true, idempotent: true };
      const grantId = randomUUID();
      await client.query(
        `INSERT INTO edt_operations_director_grants(id,company_id,project_id,user_id,granted_by_id,reason)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [grantId, input.actorCompanyId, input.projectId, input.targetUserId, input.actorUserId, reason]);
      return { grantId, active: true, idempotent: false };
    }
    if (!active) throw new EdtEngineConflict("EDT_DIRECTOR_GRANT_NOT_FOUND", "No active Operations Director grant exists for this project member.");
    await client.query(
      "INSERT INTO edt_operations_director_revocations(grant_id,revoked_by_id,reason) VALUES($1,$2,$3)",
      [active.id, input.actorUserId, reason]);
    return { grantId: active.id, active: false, idempotent: false };
  }, host);
}
