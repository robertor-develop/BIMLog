import type { Request, Response } from "express";
import { pool } from "@workspace/db";
import {
  permissionsForDefaultRole,
  type EdtDefaultRoleProfile,
} from "./edt-engine-authorization";
import { EdtEngineConflict } from "./edt-engine-transaction";

export type EdtRouteActor = Readonly<{
  grants: ReturnType<typeof permissionsForDefaultRole>;
  actorUserId: number;
  actorCompanyId: number;
  actorProjectIds: number[];
  eligibleRole: EdtDefaultRoleProfile;
}>;

const projectRoleProfiles: Readonly<Record<string, EdtDefaultRoleProfile>> = Object.freeze({
  project_admin: "PROJECT_LEADER",
  convention_manager: "BIM_COORDINATOR",
  discipline_lead: "PROJECT_MANAGER",
  member: "DRAFTER",
  sub_trade: "DRAFTER",
});

export function edtRoleFromCurrentAuthority(row: {
  isOperationsDirector: boolean; projectRole: string | null;
  isSuperAdmin: boolean; isCompanyPmo: boolean;
}): EdtDefaultRoleProfile | undefined {
  if (row.isOperationsDirector && row.projectRole) return "OPERATIONS_DIRECTOR";
  if (row.isSuperAdmin) return "CEO";
  if (row.isCompanyPmo) return "PMO";
  return row.projectRole ? projectRoleProfiles[row.projectRole] : undefined;
}

export const edtRouteActorSql = `SELECT u.id,u.company_id,u.is_super_admin,
      EXISTS(SELECT 1 FROM company_master_catalog_administrators a
        WHERE a.company_id=u.company_id AND a.user_id=u.id AND a.state='active') AS is_company_pmo,
      EXISTS(SELECT 1 FROM edt_operations_director_grants g
        WHERE g.company_id=u.company_id AND g.project_id=$2 AND g.user_id=u.id
          AND NOT EXISTS(SELECT 1 FROM edt_operations_director_revocations r WHERE r.grant_id=g.id)) AS is_operations_director,
      (SELECT pm.role FROM project_members pm
        WHERE pm.project_id=$2 AND pm.user_id=u.id AND pm.status='active' LIMIT 1) AS project_role,
      (SELECT COALESCE(binding.company_id, owner.company_id)
        FROM projects p
        JOIN users owner ON owner.id=p.created_by_id
        LEFT JOIN LATERAL (SELECT company_id FROM project_company_binding_versions
          WHERE project_id=p.id ORDER BY version DESC LIMIT 1) binding ON true
        WHERE p.id=$2 AND p.status<>'archived') AS project_company_id
    FROM users u WHERE u.id=$1`;

export async function resolveEdtRouteActor(req: Request, projectId: number): Promise<EdtRouteActor> {
  if (!req.user?.userId || !Number.isInteger(projectId) || projectId <= 0) {
    throw new EdtEngineConflict("AUTHENTICATION_REQUIRED", "Authenticated project identity is required.");
  }
  const result = await pool.query<{
    id: number;
    company_id: number;
    is_super_admin: boolean;
    is_company_pmo: boolean;
    is_operations_director: boolean;
    project_role: string | null;
    project_company_id: number | null;
  }>(edtRouteActorSql, [req.user.userId, projectId]);
  const row = result.rows[0];
  if (!row || Number(row.company_id) !== Number(req.user.companyId)) {
    throw new EdtEngineConflict("USER_COMPANY_MISMATCH", "Authenticated company identity is stale or invalid.");
  }
  if (row.project_company_id === null || Number(row.project_company_id) !== Number(row.company_id)) {
    throw new EdtEngineConflict("PROJECT_COMPANY_MISMATCH", "Project is missing or outside the authenticated company.");
  }
  const role = edtRoleFromCurrentAuthority({
    isOperationsDirector: row.is_operations_director,
    projectRole: row.project_role,
    isSuperAdmin: row.is_super_admin,
    isCompanyPmo: row.is_company_pmo,
  });
  if (!role) throw new EdtEngineConflict("ACTIVE_PROJECT_ROLE_REQUIRED", "An active eligible project role is required.");
  return Object.freeze({
    grants: permissionsForDefaultRole(role),
    actorUserId: Number(row.id),
    actorCompanyId: Number(row.company_id),
    actorProjectIds: [projectId],
    eligibleRole: role,
  });
}

export function edtProjectId(req: Request): number {
  const value = Number(req.params.projectId);
  if (!Number.isInteger(value) || value <= 0) throw new EdtEngineConflict("PROJECT_ID_INVALID", "A valid project ID is required.");
  return value;
}

export function sendEdtRouteError(res: Response, error: unknown): void {
  if (!(error instanceof EdtEngineConflict)) throw error;
  const denied = /REQUIRED$|PROHIBITED$|DENIED$|MISMATCH$/.test(error.code);
  const missing = /NOT_FOUND$/.test(error.code);
  const invalid = /INVALID$|REASON_REQUIRED$|EVIDENCE_REQUIRED$/.test(error.code);
  res.status(missing ? 404 : denied ? 403 : invalid ? 400 : 409).json({ code: error.code, error: error.message });
}
