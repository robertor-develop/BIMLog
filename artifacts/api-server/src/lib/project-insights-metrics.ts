import { pool } from "@workspace/db";
import {
  COORDINATOR_ACTION_MODULES,
  COORDINATOR_CONTEXT_METRICS,
  loadCoordinatorActionRegister,
  type RegisterQuery,
} from "./coordinator-action-register";

const safeCount = (value: unknown) => Number(value ?? 0);

function baseRegisterQuery(timezone: string): RegisterQuery {
  return {
    page: 1,
    pageSize: 1,
    modules: [...COORDINATOR_ACTION_MODULES],
    statuses: [],
    originalStatuses: [],
    presentationStatuses: [],
    lensStatuses: [],
    deadline: "all",
    dueFrom: null,
    dueTo: null,
    overdueOnly: false,
    meetingId: null,
    builtInView: "all_actionable",
    search: null,
    responsibleCompany: null,
    responsiblePerson: null,
    floor: null,
    discipline: null,
    timezone,
  };
}

export async function loadProjectInsightsSummary(input: {
  userId: number;
  projectId: number;
  timezone: string;
  superAdminAccess?: string;
  superAdminReason?: string;
}) {
  const register = await loadCoordinatorActionRegister({
    userId: input.userId,
    projectId: input.projectId,
    query: baseRegisterQuery(input.timezone),
    superAdminAccess: input.superAdminAccess,
    superAdminReason: input.superAdminReason,
  });

  const [fileStatus, fileCompanies, rfiStatus, rfiAging, members] =
    await Promise.all([
      pool.query(
        `SELECT lower(COALESCE(status,'unknown')) AS status,count(*)::int AS count
         FROM files WHERE project_id=$1 GROUP BY lower(COALESCE(status,'unknown'))`,
        [input.projectId],
      ),
      pool.query(
        `SELECT COALESCE(NULLIF(uploaded_by_company,''),'Unknown') AS company,count(*)::int AS rejected
         FROM files WHERE project_id=$1 AND lower(COALESCE(status,''))='rejected'
         GROUP BY company ORDER BY rejected DESC,company ASC LIMIT 5`,
        [input.projectId],
      ),
      pool.query(
        `SELECT lower(COALESCE(status,'unknown')) AS status,count(*)::int AS count
         FROM rfis WHERE project_id=$1 AND deleted_at IS NULL
         GROUP BY lower(COALESCE(status,'unknown'))`,
        [input.projectId],
      ),
      pool.query(
        `SELECT
           count(*) FILTER (WHERE lower(COALESCE(status,''))<>'closed')::int AS open_count,
           count(*) FILTER (WHERE lower(COALESCE(status,''))<>'closed' AND created_at < now() - interval '7 days')::int AS aging_over_7_days,
           round(avg(EXTRACT(epoch FROM (now()-created_at))/86400) FILTER (WHERE lower(COALESCE(status,''))<>'closed'))::int AS average_open_age_days
         FROM rfis WHERE project_id=$1 AND deleted_at IS NULL`,
        [input.projectId],
      ),
      pool.query(
        `SELECT count(*)::int AS members,count(DISTINCT u.company_id)::int AS companies
         FROM project_members pm JOIN users u ON u.id=pm.user_id
         WHERE pm.project_id=$1 AND pm.status='active'`,
        [input.projectId],
      ),
    ]);

  const fileCounts = Object.fromEntries(
    fileStatus.rows.map((row) => [String(row.status), safeCount(row.count)]),
  );
  const rfiCounts = Object.fromEntries(
    rfiStatus.rows.map((row) => [String(row.status), safeCount(row.count)]),
  );
  const totalFiles = Object.values(fileCounts).reduce(
    (sum, count) => sum + safeCount(count),
    0,
  );
  const rejectedFiles = safeCount(fileCounts.rejected);
  const validFiles = Math.max(0, totalFiles - rejectedFiles);
  const complianceRate =
    totalFiles > 0 ? Math.round((validFiles / totalFiles) * 100) : null;
  const rfiAgingRow = rfiAging.rows[0] ?? {};
  const memberRow = members.rows[0] ?? {};

  const commandCenterBase = `/projects/${input.projectId}/command-center`;
  const reportsBase = `/projects/${input.projectId}/reports`;
  const filesBase = `/projects/${input.projectId}/files`;

  return {
    generatedAt: new Date().toISOString(),
    projectId: input.projectId,
    title: {
      en: "Project Insights & Reports",
      es: "Perspectivas e Informes del Proyecto",
    },
    metricAuthority: {
      source: "coordinator-action-register",
      definitions: COORDINATOR_CONTEXT_METRICS,
      timezone: register.timezone,
      partial: register.partial,
      sources: register.sources,
    },
    operationalContext: {
      ...register.counts.context,
      links: {
        actionable: `${commandCenterBase}?ccBuiltIn=all_actionable`,
        overdue: `${commandCenterBase}?ccBuiltIn=overdue`,
        dueSoon: `${commandCenterBase}?ccDeadline=due_this_week`,
        blocked: `${commandCenterBase}?ccPresentation=action_required`,
      },
    },
    compliance: {
      totalFiles,
      validFiles,
      rejectedFiles,
      complianceRate,
      unavailable: totalFiles === 0,
      companies: fileCompanies.rows.map((row) => ({
        company: String(row.company),
        rejected: safeCount(row.rejected),
      })),
      links: {
        source: filesBase,
        report: `${reportsBase}?report=naming-compliance`,
      },
    },
    rfiPerformance: {
      total: Object.values(rfiCounts).reduce(
        (sum, count) => sum + safeCount(count),
        0,
      ),
      byStatus: rfiCounts,
      open: safeCount(rfiAgingRow.open_count),
      agingOver7Days: safeCount(rfiAgingRow.aging_over_7_days),
      averageOpenAgeDays:
        rfiAgingRow.average_open_age_days == null
          ? null
          : safeCount(rfiAgingRow.average_open_age_days),
      links: {
        open: `${commandCenterBase}?ccModules=rfi`,
        aging: `${commandCenterBase}?ccModules=rfi&ccBuiltIn=overdue`,
        report: `${reportsBase}?report=rfi-aging`,
      },
    },
    team: {
      members: safeCount(memberRow.members),
      companies: safeCount(memberRow.companies),
      link: `/projects/${input.projectId}/team`,
    },
    unavailable: [
      {
        key: "historical_trends",
        reason:
          "No authoritative retained history table exists yet for trend-over-time analytics.",
        reasonEs:
          "Todavía no existe una tabla histórica autorizada para tendencias en el tiempo.",
      },
      {
        key: "schedule_forecast_causes",
        reason:
          "Schedule forecasting/causal analytics are unavailable until authoritative history and forecasting rules are accepted.",
        reasonEs:
          "El pronóstico y las causas del cronograma no están disponibles hasta aceptar historial y reglas de pronóstico autorizadas.",
      },
    ],
    removedFromInsights: [
      "recent_activity",
      "recent_files",
      "operational_task_lists",
      "schedule_placeholder",
    ],
    linksGrantAuthority: false,
    aiUsed: false,
  };
}
