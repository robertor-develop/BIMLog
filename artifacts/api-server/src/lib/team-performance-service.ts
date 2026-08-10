import { pool } from "@workspace/db";
import { FinancialControlError } from "./financial-control-contract";
import { effectiveCommercialAccessForUser } from "./commercial-entitlement";
import { waitForJobIntakeMigration } from "./job-intake-migration";

type Queryable = { query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }> };

function positiveInt(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new FinancialControlError(400, "TEAM_PERFORMANCE_ID_INVALID", `${field} is invalid.`);
  return parsed;
}

function date(value: unknown, field: string) {
  if (value == null || value === "") return null;
  const parsed = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed) || Number.isNaN(Date.parse(`${parsed}T00:00:00Z`))) throw new FinancialControlError(400, "TEAM_PERFORMANCE_DATE_INVALID", `${field} is invalid.`);
  return parsed;
}

const number = (value: unknown) => Number(value ?? 0);
const fixed = (value: number) => value.toFixed(2);
const ratio = (numerator: number, denominator: number) => denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;

export async function getTeamPerformance(input: { actorUserId: unknown; projectId: unknown; from?: unknown; to?: unknown }, client: Queryable = pool) {
  await waitForJobIntakeMigration();
  const actorUserId = positiveInt(input.actorUserId, "actorUserId");
  const projectId = positiveInt(input.projectId, "projectId");
  const from = date(input.from, "from");
  const to = date(input.to, "to");
  if (from && to && from > to) throw new FinancialControlError(400, "TEAM_PERFORMANCE_DATE_INVALID", "From date must not be after to date.");

  const access = (await client.query(`SELECT p.id,p.name,p.code,u.is_super_admin,pm.role
    FROM projects p JOIN users u ON u.id=$2
    LEFT JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=u.id AND pm.status='active'
    WHERE p.id=$1 AND p.status<>'archived'`, [projectId, actorUserId])).rows[0];
  if (!access) throw new FinancialControlError(404, "TEAM_PERFORMANCE_PROJECT_NOT_FOUND", "Project not found.");
  if (!access.is_super_admin && !access.role) throw new FinancialControlError(403, "TEAM_PERFORMANCE_MEMBERSHIP_REQUIRED", "Active project membership is required.");
  const commercial = await effectiveCommercialAccessForUser(actorUserId, client);
  if (!access.is_super_admin && !commercial.team_performance) throw new FinancialControlError(403, "TEAM_PERFORMANCE_ENTITLEMENT_REQUIRED", "Team Performance & Skills access is required.");

  const members = (await client.query(`SELECT u.id,u.full_name "name",COALESCE(u.job_title,'') "jobTitle",pm.role
    FROM project_members pm JOIN users u ON u.id=pm.user_id
    WHERE pm.project_id=$1 AND pm.status='active' ORDER BY lower(u.full_name),u.id`, [projectId])).rows;
  const assignments = (await client.query(`SELECT r.user_id "userId",r.task_id "taskId",r.role,r.employment_type "employmentType",
      r.planned_hours "plannedHours",r.internal_hourly_rate "internalRate",r.billing_hourly_rate "billingRate",
      t.status,t.progress_percent "progress",t.name_en "taskNameEn",t.name_es "taskNameEs",t.updated_at "taskUpdatedAt",
      w.id "workItemId",w.name "workItem",w.workflow_template "workflow"
    FROM job_activation_resource_assignments r
    JOIN job_activation_tasks t ON t.id=r.task_id
    JOIN job_activation_work_items w ON w.id=r.work_item_id
    WHERE w.project_id=$1 AND w.status<>'cancelled' AND r.user_id IS NOT NULL`, [projectId])).rows;
  const directTasks = (await client.query(`SELECT t.assignee_user_id "userId",t.id "taskId",'' role,'' "employmentType",
      t.planned_hours "plannedHours",NULL "internalRate",w.billing_hourly_rate "billingRate",
      t.status,t.progress_percent "progress",t.name_en "taskNameEn",t.name_es "taskNameEs",t.updated_at "taskUpdatedAt",
      w.id "workItemId",w.name "workItem",w.workflow_template "workflow"
    FROM job_activation_tasks t JOIN job_activation_work_items w ON w.id=t.work_item_id
    WHERE w.project_id=$1 AND w.status<>'cancelled' AND t.assignee_user_id IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM job_activation_resource_assignments r WHERE r.task_id=t.id AND r.user_id=t.assignee_user_id)`, [projectId])).rows;
  const time = (await client.query(`SELECT e.user_id "userId",e.task_id "taskId",SUM(e.hours) hours,MAX(e.work_date) "lastDate",
      SUM(e.hours*COALESCE(r.internal_hourly_rate,0)) "actualInternalCost"
    FROM job_activation_time_entries e LEFT JOIN job_activation_resource_assignments r ON r.id=e.assignment_id
    WHERE e.project_id=$1 AND ($2::date IS NULL OR e.work_date >= $2::date) AND ($3::date IS NULL OR e.work_date <= $3::date)
    GROUP BY e.user_id,e.task_id`, [projectId, from, to])).rows;
  const monthlyTime = (await client.query(`SELECT e.user_id "userId",to_char(date_trunc('month',e.work_date),'YYYY-MM') month,SUM(e.hours) hours
    FROM job_activation_time_entries e
    WHERE e.project_id=$1 AND ($2::date IS NULL OR e.work_date >= $2::date) AND ($3::date IS NULL OR e.work_date <= $3::date)
    GROUP BY e.user_id,date_trunc('month',e.work_date) ORDER BY month`, [projectId, from, to])).rows;
  const deliverables = (await client.query(`SELECT COALESCE(r.user_id,t.assignee_user_id) "userId",d.id,d.deliverable_type "deliverableType",
      d.linked_at "linkedAt",t.id "taskId",t.name_en "taskNameEn",t.name_es "taskNameEs",w.name "workItem"
    FROM job_activation_task_deliverables d JOIN job_activation_tasks t ON t.id=d.task_id
    JOIN job_activation_work_items w ON w.id=t.work_item_id
    LEFT JOIN job_activation_resource_assignments r ON r.task_id=t.id
    WHERE d.project_id=$1 AND COALESCE(r.user_id,t.assignee_user_id) IS NOT NULL
    GROUP BY COALESCE(r.user_id,t.assignee_user_id),d.id,t.id,w.name`, [projectId])).rows;
  const packages = (await client.query(`SELECT p.responsible_user_id "userId",p.id,p.package_code "packageCode",p.title,p.status,
      p.package_type "packageType",p.due_date "dueDate",p.updated_at "updatedAt",w.name "workItem"
    FROM job_activation_work_packages p JOIN job_activation_work_items w ON w.id=p.work_item_id
    WHERE p.project_id=$1 AND p.responsible_user_id IS NOT NULL AND p.status<>'cancelled'`, [projectId])).rows;

  const assignmentRows = [...assignments, ...directTasks];
  const today = new Date().toISOString().slice(0, 10);

  const people = members.map(member => {
    const userId = Number(member.id);
    const work = assignmentRows.filter(row => Number(row.userId) === userId);
    const uniqueTasks = [...new Map(work.map(row => [row.taskId, row])).values()];
    const memberTime = time.filter(row => Number(row.userId) === userId);
    const memberMonthlyTime = monthlyTime.filter(row => Number(row.userId) === userId);
    const memberDeliverables = deliverables.filter(row => Number(row.userId) === userId);
    const memberPackages = packages.filter(row => Number(row.userId) === userId);
    const plannedHours = work.reduce((sum, row) => sum + number(row.plannedHours), 0);
    const actualHours = memberTime.reduce((sum, row) => sum + number(row.hours), 0);
    const earnedHours = uniqueTasks.reduce((sum, row) => sum + number(row.plannedHours) * number(row.progress) / 100, 0);
    const plannedInternalCost = work.reduce((sum, row) => sum + number(row.plannedHours) * number(row.internalRate), 0);
    const actualInternalCost = memberTime.reduce((sum, row) => sum + number(row.actualInternalCost), 0);
    const completedTasks = uniqueTasks.filter(row => row.status === "complete").length;
    const blockedTasks = uniqueTasks.filter(row => row.status === "blocked").length;
    const approvedPackages = memberPackages.filter(row => row.status === "approved").length;
    const returnedPackages = memberPackages.filter(row => row.status === "returned").length;
    const overduePackages = memberPackages.filter(row => row.dueDate && String(row.dueDate).slice(0, 10) < today && !["approved", "cancelled"].includes(row.status)).length;
    const remainingCommittedHours = uniqueTasks.filter(row => !["complete", "cancelled"].includes(row.status)).reduce((sum, row) => sum + number(row.plannedHours) * (1 - number(row.progress) / 100), 0);
    const activeTasks = uniqueTasks.filter(row => !["complete", "cancelled"].includes(row.status)).length;
    const evidencePoints = uniqueTasks.length + memberTime.length + memberPackages.length + memberDeliverables.length;
    const lastActivity = [
      ...memberTime.map(row => row.lastDate ? String(row.lastDate).slice(0, 10) : null),
      ...memberPackages.map(row => row.updatedAt ? new Date(row.updatedAt).toISOString().slice(0, 10) : null),
    ].filter(Boolean).sort().at(-1) ?? null;
    const roles = [...new Set(work.flatMap(row => [row.role, row.workflow]).filter(Boolean).map(String))].sort();
    const workItems = [...new Set(work.map(row => String(row.workItem)).filter(Boolean))].sort();
    const packageTypes = [...new Set(memberPackages.map(row => String(row.packageType)).filter(Boolean))].sort();
    const reviewed = approvedPackages + returnedPackages;
    const experience = new Map<string, { category: string; kinds: Set<string>; assignedTasks: Set<string>; completedTasks: Set<string>; plannedHours: number; actualHours: number; approvedPackages: number; returnedPackages: number; deliverables: number; lastEvidence: string | null }>();
    const touch = (category: unknown, kind: string, evidenceDate?: unknown) => {
      const label = String(category ?? "").trim();
      if (!label) return null;
      const current = experience.get(label) ?? { category: label, kinds: new Set<string>(), assignedTasks: new Set<string>(), completedTasks: new Set<string>(), plannedHours: 0, actualHours: 0, approvedPackages: 0, returnedPackages: 0, deliverables: 0, lastEvidence: null };
      current.kinds.add(kind);
      const normalizedDate = evidenceDate ? new Date(evidenceDate as string).toISOString().slice(0, 10) : null;
      if (normalizedDate && (!current.lastEvidence || normalizedDate > current.lastEvidence)) current.lastEvidence = normalizedDate;
      experience.set(label, current);
      return current;
    };
    for (const row of uniqueTasks) {
      for (const [categoryValue, kind] of [[row.role, "role"], [row.workflow, "workflow"], [row.workItem, "scope"]] as const) {
        const item = touch(categoryValue, kind, row.taskUpdatedAt); if (!item) continue;
        item.assignedTasks.add(String(row.taskId)); item.plannedHours += number(row.plannedHours);
        if (row.status === "complete") item.completedTasks.add(String(row.taskId));
        item.actualHours += memberTime.filter(entry => entry.taskId === row.taskId).reduce((sum, entry) => sum + number(entry.hours), 0);
      }
    }
    for (const row of memberPackages) {
      for (const [categoryValue, kind] of [[row.packageType, "package"], [row.workItem, "scope"]] as const) {
        const item = touch(categoryValue, kind, row.updatedAt); if (!item) continue;
        if (row.status === "approved") item.approvedPackages += 1;
        if (row.status === "returned") item.returnedPackages += 1;
      }
    }
    for (const row of memberDeliverables) {
      const item = touch(row.deliverableType, "deliverable", row.linkedAt); if (item) item.deliverables += 1;
    }
    const experienceRows = [...experience.values()].map(item => ({ category: item.category, kinds: [...item.kinds].sort(), assignedTasks: item.assignedTasks.size, completedTasks: item.completedTasks.size, plannedHours: fixed(item.plannedHours), actualHours: fixed(item.actualHours), approvedPackages: item.approvedPackages, returnedPackages: item.returnedPackages, deliverables: item.deliverables, evidenceCount: item.assignedTasks.size + item.approvedPackages + item.returnedPackages + item.deliverables, lastEvidence: item.lastEvidence })).sort((a, b) => b.evidenceCount - a.evidenceCount || a.category.localeCompare(b.category));
    const trendMonths = [...new Set([
      ...memberMonthlyTime.map(row => String(row.month)),
      ...uniqueTasks.filter(row => row.status === "complete" && row.taskUpdatedAt).map(row => new Date(row.taskUpdatedAt).toISOString().slice(0, 7)),
      ...memberPackages.filter(row => ["approved", "returned"].includes(row.status)).map(row => new Date(row.updatedAt).toISOString().slice(0, 7)),
    ])].sort();
    const trend = trendMonths.map(month => ({
      month,
      actualHours: fixed(memberMonthlyTime.filter(row => row.month === month).reduce((sum, row) => sum + number(row.hours), 0)),
      completedTasks: uniqueTasks.filter(row => row.status === "complete" && row.taskUpdatedAt && new Date(row.taskUpdatedAt).toISOString().slice(0, 7) === month).length,
      approvedPackages: memberPackages.filter(row => row.status === "approved" && new Date(row.updatedAt).toISOString().slice(0, 7) === month).length,
      returnedPackages: memberPackages.filter(row => row.status === "returned" && new Date(row.updatedAt).toISOString().slice(0, 7) === month).length,
    }));
    const evidenceItems = [
      ...uniqueTasks.map(row => ({ type: "task", id: row.taskId, category: row.workItem, titleEn: row.taskNameEn, titleEs: row.taskNameEs, status: row.status, date: row.taskUpdatedAt ? new Date(row.taskUpdatedAt).toISOString().slice(0, 10) : null, plannedHours: fixed(number(row.plannedHours)), progress: number(row.progress) })),
      ...memberPackages.map(row => ({ type: "package", id: row.id, category: row.packageType, titleEn: `${row.packageCode} · ${row.title}`, titleEs: `${row.packageCode} · ${row.title}`, status: row.status, date: new Date(row.updatedAt).toISOString().slice(0, 10), plannedHours: null, progress: null })),
      ...memberDeliverables.map(row => ({ type: "deliverable", id: row.id, category: row.deliverableType, titleEn: row.taskNameEn, titleEs: row.taskNameEs, status: "linked", date: new Date(row.linkedAt).toISOString().slice(0, 10), plannedHours: null, progress: null })),
    ].sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? ""))).slice(0, 50);
    return {
      userId, name: member.name, jobTitle: member.jobTitle, projectRole: member.role,
      observedCategories: { roles, workItems, packageTypes },
      tasks: { assigned: uniqueTasks.length, completed: completedTasks, blocked: blockedTasks, completionRate: ratio(completedTasks, uniqueTasks.length) },
      hours: { planned: fixed(plannedHours), actual: fixed(actualHours), earned: fixed(earnedHours), efficiencyIndex: ratio(earnedHours, actualHours) },
      costs: { plannedInternal: fixed(plannedInternalCost), actualInternal: fixed(actualInternalCost), averageInternalHourlyRate: actualHours > 0 ? fixed(actualInternalCost / actualHours) : plannedHours > 0 ? fixed(plannedInternalCost / plannedHours) : null },
      delivery: { deliverables: memberDeliverables.length, approvedPackages, returnedPackages, overduePackages, qualityRate: ratio(approvedPackages, reviewed) },
      capacity: { activeTasks, remainingCommittedHours: fixed(remainingCommittedHours) },
      experience: experienceRows,
      trend,
      evidenceItems,
      evidenceLevel: evidencePoints >= 12 ? "established" : evidencePoints >= 4 ? "limited" : "insufficient",
      lastActivity,
      explanations: {
        efficiencyIndex: actualHours > 0 ? "earned planned hours / actual recorded hours" : "Unavailable until actual hours are recorded",
        qualityRate: reviewed > 0 ? "approved responsible packages / approved plus returned responsible packages" : "Unavailable until a responsible package is reviewed",
      },
    };
  });

  const totals = people.reduce((result, person) => ({
    assignedTasks: result.assignedTasks + person.tasks.assigned,
    completedTasks: result.completedTasks + person.tasks.completed,
    plannedHours: result.plannedHours + number(person.hours.planned),
    actualHours: result.actualHours + number(person.hours.actual),
    earnedHours: result.earnedHours + number(person.hours.earned),
    approvedPackages: result.approvedPackages + person.delivery.approvedPackages,
    returnedPackages: result.returnedPackages + person.delivery.returnedPackages,
  }), { assignedTasks: 0, completedTasks: 0, plannedHours: 0, actualHours: 0, earnedHours: 0, approvedPackages: 0, returnedPackages: 0 });

  return {
    project: { id: projectId, name: access.name, code: access.code },
    period: { from, to },
    methodology: {
      source: "Job Intake and Job Operations records for this project",
      limitations: "Observed categories are evidence labels, not inferred skill ratings. Capacity uses remaining committed task hours; weekly capacity and planning horizon are user-entered scenarios. No AI ranking, personality score, or fabricated history is used.",
    },
    totals: { ...totals, plannedHours: fixed(totals.plannedHours), actualHours: fixed(totals.actualHours), earnedHours: fixed(totals.earnedHours), efficiencyIndex: ratio(totals.earnedHours, totals.actualHours) },
    filters: {
      roles: [...new Set(people.flatMap(person => person.observedCategories.roles))].sort(),
      workItems: [...new Set(people.flatMap(person => person.observedCategories.workItems))].sort(),
      packageTypes: [...new Set(people.flatMap(person => person.observedCategories.packageTypes))].sort(),
    },
    people,
  };
}
