import { pool } from "@workspace/db";
import { accessMatrix, type AccessFacts, type ProjectRole } from "./access-policy";

export async function resolveAccessProfile(userId: number) {
  const result = await pool.query(`
    SELECT u.id,
           u.is_super_admin,
           u.can_access_living_brief,
           EXISTS (
             SELECT 1 FROM company_master_catalog_administrators a
             WHERE a.company_id=u.company_id AND a.user_id=u.id AND a.state='active'
           ) AS is_company_pmo,
           EXISTS (
             SELECT 1 FROM financial_authority_grants g
             WHERE g.user_id=u.id AND g.company_id=u.company_id
               AND g.authority='financial_administrator'
               AND g.effective_from<=now()
               AND (g.effective_to IS NULL OR g.effective_to>now())
               AND NOT EXISTS (SELECT 1 FROM financial_authority_revocations r WHERE r.grant_id=g.id)
           ) AS is_financial_administrator,
           COALESCE((
             SELECT jsonb_agg(jsonb_build_object('id', memberships.project_id, 'role', memberships.role) ORDER BY memberships.project_id)
             FROM (
               SELECT DISTINCT pm.project_id, pm.role
               FROM project_members pm
               JOIN projects p ON p.id=pm.project_id
               WHERE pm.user_id=u.id AND pm.status='active' AND p.status<>'archived'
             ) memberships
           ), '[]'::jsonb) AS active_projects
    FROM users u WHERE u.id=$1 LIMIT 1`, [userId]);
  const row = result.rows[0];
  if (!row) return null;
  const activeProjects: Array<{ id: number; role: ProjectRole }> = Array.isArray(row.active_projects)
    ? row.active_projects.map((project: { id: unknown; role: unknown }) => ({ id: Number(project.id), role: String(project.role) as ProjectRole }))
      .filter((project: { id: number; role: ProjectRole }) => Number.isSafeInteger(project.id) && project.id > 0)
    : [];
  const facts: AccessFacts = {
    authenticated: true,
    isSuperAdmin: row.is_super_admin === true,
    canAccessLivingBrief: row.can_access_living_brief === true,
    isCompanyPmo: row.is_company_pmo === true,
    isFinancialAdministrator: row.is_financial_administrator === true,
    activeProjectRoles: [...new Set(activeProjects.map((project: { role: ProjectRole }) => project.role))],
  };
  return { facts: { ...facts, activeProjects }, decisions: accessMatrix(facts) };
}
