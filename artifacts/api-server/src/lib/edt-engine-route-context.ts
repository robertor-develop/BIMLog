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

export async function resolveEdtRouteActor(req: Request, projectId: number): Promise<EdtRouteActor> {
  if (!req.user?.userId || !Number.isInteger(projectId) || projectId <= 0) {
    throw new EdtEngineConflict("AUTHENTICATION_REQUIRED", "Authenticated project identity is required.");
  }
  const result = await pool.query<{
    id: number;
    company_id: number;
    is_super_admin: boolean;
    is_company_pmo: boolean;
    project_role: string | null;
  }>(`SELECT u.id,u.company_id,u.is_super_admin,
      EXISTS(SELECT 1 FROM company_master_catalog_admins a
        WHERE a.company_id=u.company_id AND a.user_id=u.id AND a.state='active') AS is_company_pmo,
      (SELECT pm.role FROM project_members pm
        WHERE pm.project_id=$2 AND pm.user_id=u.id AND pm.status='active' LIMIT 1) AS project_role
    FROM users u WHERE u.id=$1`, [req.user.userId, projectId]);
  const row = result.rows[0];
  if (!row || Number(row.company_id) !== Number(req.user.companyId)) {
    throw new EdtEngineConflict("USER_COMPANY_MISMATCH", "Authenticated company identity is stale or invalid.");
  }
  const role: EdtDefaultRoleProfile | undefined = row.is_super_admin
    ? "CEO"
    : row.is_company_pmo
      ? "PMO"
      : row.project_role
        ? projectRoleProfiles[row.project_role]
        : undefined;
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
