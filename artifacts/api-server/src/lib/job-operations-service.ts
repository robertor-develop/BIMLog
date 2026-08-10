import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { FinancialControlError } from "./financial-control-contract";
import { effectiveCommercialAccessForUser } from "./commercial-entitlement";
import { waitForJobIntakeMigration } from "./job-intake-migration";

type Queryable = { query: (text: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }> };
const TASK_STATUSES = new Set(["not_started", "in_progress", "blocked", "complete", "cancelled"]);
const DELIVERABLE_TYPES = new Set(["shop_drawing", "submittal", "deliverable", "supporting"]);
const MANAGER_ROLES = new Set(["owner", "admin", "project_admin", "project_manager", "bim_manager", "manager"]);

function id(value: unknown, field: string) {
  const parsed = String(value ?? "").trim();
  if (!/^[0-9a-f-]{8,64}$/i.test(parsed)) throw new FinancialControlError(400, "JOB_OPERATIONS_ID_INVALID", `${field} is invalid.`);
  return parsed;
}
function positiveInt(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new FinancialControlError(400, "JOB_OPERATIONS_ID_INVALID", `${field} is invalid.`);
  return parsed;
}
function text(value: unknown, max: number, field: string) {
  const parsed = String(value ?? "").trim();
  if (parsed.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(parsed)) throw new FinancialControlError(400, "JOB_OPERATIONS_TEXT_INVALID", `${field} is invalid.`);
  return parsed;
}
function workHours(value: unknown) {
  const parsed = String(value ?? "").trim();
  if (!/^(?:0*[0-9]|1[0-9]|2[0-3])(?:\.\d{1,6})?$|^24(?:\.0{1,6})?$/.test(parsed) || Number(parsed) <= 0) throw new FinancialControlError(400, "JOB_OPERATIONS_HOURS_INVALID", "Hours must be greater than zero and no more than 24.");
  return parsed;
}

async function scope(actorUserId: number, projectId: number, client: Queryable = pool) {
  const row = (await client.query(`SELECT p.id,p.name,p.code,u.is_super_admin,pm.role,ji.id intake_id,ji.data
    FROM projects p JOIN users u ON u.id=$2
    LEFT JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=u.id AND pm.status='active'
    LEFT JOIN job_intakes ji ON ji.project_id=p.id
    WHERE p.id=$1 AND p.status<>'archived'`, [projectId, actorUserId])).rows[0];
  if (!row) throw new FinancialControlError(404, "JOB_OPERATIONS_PROJECT_NOT_FOUND", "Project not found.");
  if (!row.is_super_admin && !row.role) throw new FinancialControlError(403, "JOB_OPERATIONS_MEMBERSHIP_REQUIRED", "Active project membership is required.");
  const leaderId = Number(row.data?.team?.projectLeaderUserId ?? 0) || null;
  return { projectId, projectName: row.name, projectCode: row.code, intakeId: row.intake_id ?? null, leaderId, canManage: row.is_super_admin === true || leaderId === actorUserId || MANAGER_ROLES.has(String(row.role ?? "").toLowerCase()) };
}

async function event(client: Queryable, input: { projectId: number; actorUserId: number; eventType: string; workItemId?: string | null; taskId?: string | null; assignmentId?: string | null; evidence?: Record<string, unknown> }) {
  await client.query(`INSERT INTO job_activation_operation_events(id,project_id,work_item_id,task_id,assignment_id,actor_user_id,event_type,evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`, [crypto.randomUUID(), input.projectId, input.workItemId ?? null, input.taskId ?? null, input.assignmentId ?? null, input.actorUserId, input.eventType, JSON.stringify(input.evidence ?? {})]);
}

async function taskAccess(client: Queryable, actorUserId: number, projectId: number, taskId: string) {
  const access = await scope(actorUserId, projectId, client);
  const task = (await client.query(`SELECT t.*,w.project_id,w.intake_id FROM job_activation_tasks t JOIN job_activation_work_items w ON w.id=t.work_item_id WHERE t.id=$1 AND w.project_id=$2`, [taskId, projectId])).rows[0];
  if (!task) throw new FinancialControlError(404, "JOB_OPERATIONS_TASK_NOT_FOUND", "Task not found.");
  const assigned = Number(task.assignee_user_id) === actorUserId || Boolean((await client.query(`SELECT 1 FROM job_activation_resource_assignments WHERE task_id=$1 AND user_id=$2 LIMIT 1`, [taskId, actorUserId])).rows[0]);
  return { access, task, canControl: access.canManage || assigned };
}

export async function getJobOperations(input: { actorUserId: number; projectId: unknown }) {
  await waitForJobIntakeMigration();
  const projectId = positiveInt(input.projectId, "projectId"), access = await scope(input.actorUserId, projectId);
  const capabilities = await effectiveCommercialAccessForUser(input.actorUserId);
  if (!access.intakeId) return { available: false, project: { id: projectId, name: access.projectName, code: access.projectCode }, canManage: access.canManage, capabilities };
  const [workItems, tasks, assignments, timeEntries, deliverables, members, files, totals] = await Promise.all([
    pool.query(`SELECT id,stable_scope_item_id "stableScopeItemId",name,description,unit,planned_hours "plannedHours",workflow_template "workflowTemplate",status,billing_hourly_rate "billingHourlyRate",planned_billable_value "plannedBillableValue",contract_id "contractId" FROM job_activation_work_items WHERE intake_id=$1 ORDER BY created_at,id`, [access.intakeId]),
    pool.query(`SELECT t.id,t.work_item_id "workItemId",t.task_key "taskKey",t.name_en "nameEn",t.name_es "nameEs",t.status,t.version,t.progress_percent "progressPercent",t.planned_hours "plannedHours",t.assignee_user_id "assigneeUserId",COALESCE(e.actual_hours,0)::text "actualHours",COALESCE(d.deliverable_count,0)::int "deliverableCount"
      FROM job_activation_tasks t
      JOIN job_activation_work_items w ON w.id=t.work_item_id
      LEFT JOIN LATERAL (SELECT SUM(hours) actual_hours FROM job_activation_time_entries WHERE task_id=t.id) e ON true
      LEFT JOIN LATERAL (SELECT COUNT(*) deliverable_count FROM job_activation_task_deliverables WHERE task_id=t.id) d ON true
      WHERE w.intake_id=$1 ORDER BY t.work_item_id,t.sequence,t.id`, [access.intakeId]),
    pool.query(`SELECT r.id,r.work_item_id "workItemId",r.task_id "taskId",r.user_id "userId",r.person_name "personName",r.role,r.employment_type "employmentType",r.planned_hours "plannedHours",r.internal_hourly_rate "internalHourlyRate",r.billing_hourly_rate "billingHourlyRate",r.planned_internal_cost "plannedInternalCost",r.planned_billable_value "plannedBillableValue",r.version,COALESCE(SUM(e.hours),0)::text "actualHours" FROM job_activation_resource_assignments r LEFT JOIN job_activation_time_entries e ON e.assignment_id=r.id WHERE r.intake_id=$1 GROUP BY r.id ORDER BY r.created_at,r.id`, [access.intakeId]),
    pool.query(`SELECT e.id,e.task_id "taskId",e.assignment_id "assignmentId",e.user_id "userId",u.full_name "userName",e.work_date "workDate",e.hours::text,e.note,e.created_at "createdAt" FROM job_activation_time_entries e JOIN users u ON u.id=e.user_id WHERE e.intake_id=$1 ORDER BY e.work_date DESC,e.created_at DESC,e.id DESC LIMIT 500`, [access.intakeId]),
    pool.query(`SELECT d.id,d.task_id "taskId",d.work_item_id "workItemId",d.file_id "fileId",f.file_name "fileName",d.deliverable_type "deliverableType",d.note,d.linked_by_id "linkedById",d.linked_at "linkedAt" FROM job_activation_task_deliverables d JOIN files f ON f.id=d.file_id JOIN job_activation_work_items w ON w.id=d.work_item_id WHERE w.intake_id=$1 ORDER BY d.linked_at DESC,d.id`, [access.intakeId]),
    pool.query(`SELECT u.id,u.full_name "fullName",u.email,pm.role FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=$1 AND pm.status='active' ORDER BY u.full_name,u.email`, [projectId]),
    pool.query(`SELECT id,file_name "fileName",file_type "fileType",status,version FROM files WHERE project_id=$1 AND COALESCE(status,'')<>'deleted' AND is_superseded=false ORDER BY updated_at DESC,id DESC LIMIT 500`, [projectId]),
    pool.query(`SELECT
      COALESCE((SELECT SUM(planned_hours) FROM job_activation_work_items WHERE intake_id=$1),0)::text "plannedHours",
      COALESCE((SELECT SUM(hours) FROM job_activation_time_entries WHERE intake_id=$1),0)::text "actualHours",
      COALESCE((SELECT SUM(planned_internal_cost) FROM job_activation_resource_assignments WHERE intake_id=$1),0)::text "plannedInternalCost",
      COALESCE((SELECT SUM(e.hours*r.internal_hourly_rate) FROM job_activation_time_entries e JOIN job_activation_resource_assignments r ON r.id=e.assignment_id WHERE e.intake_id=$1),0)::text "actualInternalCost",
      COALESCE((SELECT SUM(planned_billable_value) FROM job_activation_work_items WHERE intake_id=$1),0)::text "plannedBillableValue",
      COALESCE((SELECT SUM(e.hours*COALESCE(r.billing_hourly_rate,w.billing_hourly_rate)) FROM job_activation_time_entries e JOIN job_activation_work_items w ON w.id=e.work_item_id LEFT JOIN job_activation_resource_assignments r ON r.id=e.assignment_id WHERE e.intake_id=$1),0)::text "earnedBillableValue"`, [access.intakeId]),
  ]);
  const showBudget = capabilities.budget === true;
  const showPlanner = capabilities.cost_value_planner === true;
  const safeWorkItems = workItems.rows.map((row) => ({
    ...row,
    billingHourlyRate: showPlanner ? row.billingHourlyRate : null,
    plannedBillableValue: showPlanner ? row.plannedBillableValue : null,
  }));
  const safeAssignments = assignments.rows.map((row) => ({
    ...row,
    internalHourlyRate: showBudget ? row.internalHourlyRate : null,
    plannedInternalCost: showBudget ? row.plannedInternalCost : null,
    billingHourlyRate: showPlanner ? row.billingHourlyRate : null,
    plannedBillableValue: showPlanner ? row.plannedBillableValue : null,
  }));
  const safeTasks = tasks.rows.map((row) => ({
    ...row,
    canControl: access.canManage || Number(row.assigneeUserId) === input.actorUserId || assignments.rows.some((assignment) => assignment.taskId === row.id && Number(assignment.userId) === input.actorUserId),
  }));
  const safeDeliverables = deliverables.rows.map((row) => ({
    ...row,
    canRemove: access.canManage || Number(row.linkedById) === input.actorUserId,
  }));
  const safeTotals = {
    ...totals.rows[0],
    plannedInternalCost: showBudget ? totals.rows[0].plannedInternalCost : null,
    actualInternalCost: showBudget ? totals.rows[0].actualInternalCost : null,
    plannedBillableValue: showPlanner ? totals.rows[0].plannedBillableValue : null,
    earnedBillableValue: showPlanner ? totals.rows[0].earnedBillableValue : null,
  };
  return { available: safeWorkItems.length > 0, project: { id: projectId, name: access.projectName, code: access.projectCode }, canManage: access.canManage, leaderId: access.leaderId, capabilities, workItems: safeWorkItems, tasks: safeTasks, assignments: safeAssignments, timeEntries: timeEntries.rows, deliverables: safeDeliverables, members: members.rows, files: files.rows, totals: safeTotals };
}

export async function updateJobOperationTask(input: { actorUserId: number; projectId: unknown; taskId: unknown; expectedVersion: unknown; status: unknown; progressPercent: unknown; assigneeUserId?: unknown }) {
  await waitForJobIntakeMigration();
  const projectId = positiveInt(input.projectId, "projectId"), taskId = id(input.taskId, "taskId"), expectedVersion = positiveInt(input.expectedVersion, "expectedVersion");
  const status = String(input.status ?? "");
  if (!TASK_STATUSES.has(status)) throw new FinancialControlError(400, "JOB_OPERATIONS_STATUS_INVALID", "Task status is invalid.");
  let progress = Number(input.progressPercent);
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) throw new FinancialControlError(400, "JOB_OPERATIONS_PROGRESS_INVALID", "Progress must be a whole number from 0 to 100.");
  if (status === "complete") progress = 100;
  if (status === "not_started") progress = 0;
  const assigneeUserId = input.assigneeUserId == null || input.assigneeUserId === "" ? null : positiveInt(input.assigneeUserId, "assigneeUserId");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const control = await taskAccess(client, input.actorUserId, projectId, taskId);
    if (!control.canControl) throw new FinancialControlError(403, "JOB_OPERATIONS_TASK_CONTROL_DENIED", "Only the project leader or assigned team members may update this task.");
    if (assigneeUserId !== Number(control.task.assignee_user_id) && !control.access.canManage) throw new FinancialControlError(403, "JOB_OPERATIONS_REASSIGN_DENIED", "Only the project leader may reassign tasks.");
    if (assigneeUserId && !(await client.query(`SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2 AND status='active'`, [projectId, assigneeUserId])).rows[0]) throw new FinancialControlError(400, "JOB_OPERATIONS_ASSIGNEE_INVALID", "The assignee must be an active project member.");
    const updated = (await client.query(`UPDATE job_activation_tasks SET status=$3,progress_percent=$4,assignee_user_id=$5,version=version+1,updated_at=now() WHERE id=$1 AND version=$2 RETURNING id,work_item_id,version`, [taskId, expectedVersion, status, progress, assigneeUserId])).rows[0];
    if (!updated) throw new FinancialControlError(409, "JOB_OPERATIONS_STALE", "This task changed in another session. Reload before saving.");
    await event(client, { projectId, actorUserId: input.actorUserId, eventType: "task_updated", workItemId: updated.work_item_id, taskId, evidence: { status, progressPercent: progress, assigneeUserId, version: updated.version } });
    await client.query("COMMIT");
    return { id: taskId, version: Number(updated.version), status, progressPercent: progress, assigneeUserId };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function reassignJobOperationResource(input: { actorUserId: number; projectId: unknown; assignmentId: unknown; expectedVersion: unknown; userId: unknown }) {
  await waitForJobIntakeMigration();
  const projectId = positiveInt(input.projectId, "projectId"), assignmentId = id(input.assignmentId, "assignmentId"), expectedVersion = positiveInt(input.expectedVersion, "expectedVersion"), userId = positiveInt(input.userId, "userId");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const access = await scope(input.actorUserId, projectId, client);
    if (!access.canManage) throw new FinancialControlError(403, "JOB_OPERATIONS_REASSIGN_DENIED", "Only the project leader may reassign resources.");
    const member = (await client.query(`SELECT u.full_name,u.email FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=$1 AND pm.user_id=$2 AND pm.status='active'`, [projectId, userId])).rows[0];
    if (!member) throw new FinancialControlError(400, "JOB_OPERATIONS_ASSIGNEE_INVALID", "The assignee must be an active project member.");
    const updated = (await client.query(`UPDATE job_activation_resource_assignments r SET user_id=$4,person_name=$5,version=version+1 FROM job_activation_work_items w WHERE r.id=$1 AND r.version=$2 AND r.work_item_id=w.id AND w.project_id=$3 RETURNING r.id,r.work_item_id,r.task_id,r.version`, [assignmentId, expectedVersion, projectId, userId, member.full_name || member.email])).rows[0];
    if (!updated) throw new FinancialControlError(409, "JOB_OPERATIONS_STALE", "This assignment changed in another session. Reload before saving.");
    await client.query(`UPDATE job_activation_tasks SET assignee_user_id=$2,version=version+1,updated_at=now() WHERE id=$1`, [updated.task_id, userId]);
    await event(client, { projectId, actorUserId: input.actorUserId, eventType: "resource_reassigned", workItemId: updated.work_item_id, taskId: updated.task_id, assignmentId, evidence: { userId, version: updated.version } });
    await client.query("COMMIT"); return { id: assignmentId, userId, personName: member.full_name || member.email, version: Number(updated.version) };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function addJobOperationTime(input: { actorUserId: number; projectId: unknown; entryId: unknown; taskId: unknown; assignmentId?: unknown; workDate: unknown; hours: unknown; note?: unknown }) {
  await waitForJobIntakeMigration();
  const projectId = positiveInt(input.projectId, "projectId"), entryId = id(input.entryId, "entryId"), taskId = id(input.taskId, "taskId"), assignmentId = input.assignmentId ? id(input.assignmentId, "assignmentId") : null;
  const workDate = String(input.workDate ?? ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate) || Number.isNaN(Date.parse(`${workDate}T00:00:00Z`))) throw new FinancialControlError(400, "JOB_OPERATIONS_DATE_INVALID", "Work date is invalid.");
  const hours = workHours(input.hours), note = text(input.note, 500, "note"), client = await pool.connect();
  try {
    await client.query("BEGIN");
    const control = await taskAccess(client, input.actorUserId, projectId, taskId);
    let assignment: any = null;
    if (assignmentId) assignment = (await client.query(`SELECT * FROM job_activation_resource_assignments WHERE id=$1 AND task_id=$2`, [assignmentId, taskId])).rows[0];
    if (assignmentId && !assignment) throw new FinancialControlError(400, "JOB_OPERATIONS_ASSIGNMENT_INVALID", "The selected assignment does not belong to this task.");
    const userId = Number(assignment?.user_id ?? control.task.assignee_user_id ?? input.actorUserId);
    if (!control.access.canManage && userId !== input.actorUserId) throw new FinancialControlError(403, "JOB_OPERATIONS_TIME_DENIED", "Team members may only record their own time.");
    const existing = (await client.query(`SELECT id FROM job_activation_time_entries WHERE id=$1`, [entryId])).rows[0];
    if (!existing) {
      await client.query(`INSERT INTO job_activation_time_entries(id,intake_id,project_id,work_item_id,task_id,assignment_id,user_id,work_date,hours,note,created_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [entryId, control.task.intake_id, projectId, control.task.work_item_id, taskId, assignmentId, userId, workDate, hours, note, input.actorUserId]);
      await event(client, { projectId, actorUserId: input.actorUserId, eventType: "time_recorded", workItemId: control.task.work_item_id, taskId, assignmentId, evidence: { entryId, userId, workDate, hours } });
    }
    await client.query("COMMIT"); return { id: entryId, idempotent: Boolean(existing) };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function linkJobOperationDeliverable(input: { actorUserId: number; projectId: unknown; linkId: unknown; taskId: unknown; fileId: unknown; deliverableType: unknown; note?: unknown }) {
  await waitForJobIntakeMigration();
  const projectId = positiveInt(input.projectId, "projectId"), linkId = id(input.linkId, "linkId"), taskId = id(input.taskId, "taskId"), fileId = positiveInt(input.fileId, "fileId"), deliverableType = String(input.deliverableType ?? ""), note = text(input.note, 500, "note");
  if (!DELIVERABLE_TYPES.has(deliverableType)) throw new FinancialControlError(400, "JOB_OPERATIONS_DELIVERABLE_TYPE_INVALID", "Deliverable type is invalid.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const control = await taskAccess(client, input.actorUserId, projectId, taskId);
    if (!control.canControl) throw new FinancialControlError(403, "JOB_OPERATIONS_DELIVERABLE_DENIED", "Only the project leader or assigned team members may link deliverables.");
    if (!(await client.query(`SELECT 1 FROM files WHERE id=$1 AND project_id=$2 AND COALESCE(status,'')<>'deleted'`, [fileId, projectId])).rows[0]) throw new FinancialControlError(400, "JOB_OPERATIONS_FILE_INVALID", "Choose an active file from this project.");
    const linked = (await client.query(`INSERT INTO job_activation_task_deliverables(id,project_id,work_item_id,task_id,file_id,deliverable_type,note,linked_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(task_id,file_id,deliverable_type) DO UPDATE SET note=EXCLUDED.note RETURNING id`, [linkId, projectId, control.task.work_item_id, taskId, fileId, deliverableType, note, input.actorUserId])).rows[0];
    await event(client, { projectId, actorUserId: input.actorUserId, eventType: "deliverable_linked", workItemId: control.task.work_item_id, taskId, evidence: { linkId: linked.id, fileId, deliverableType } });
    await client.query("COMMIT"); return { id: linked.id };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function unlinkJobOperationDeliverable(input: { actorUserId: number; projectId: unknown; deliverableId: unknown }) {
  await waitForJobIntakeMigration();
  const projectId = positiveInt(input.projectId, "projectId"), deliverableId = id(input.deliverableId, "deliverableId"), client = await pool.connect();
  try {
    await client.query("BEGIN");
    const access = await scope(input.actorUserId, projectId, client);
    const row = (await client.query(`SELECT d.* FROM job_activation_task_deliverables d WHERE d.id=$1 AND d.project_id=$2 FOR UPDATE`, [deliverableId, projectId])).rows[0];
    if (!row) throw new FinancialControlError(404, "JOB_OPERATIONS_DELIVERABLE_NOT_FOUND", "Deliverable link not found.");
    if (!access.canManage && Number(row.linked_by_id) !== input.actorUserId) throw new FinancialControlError(403, "JOB_OPERATIONS_DELIVERABLE_DENIED", "Only the project leader or the person who linked this file may remove it.");
    await client.query(`DELETE FROM job_activation_task_deliverables WHERE id=$1`, [deliverableId]);
    await event(client, { projectId, actorUserId: input.actorUserId, eventType: "deliverable_unlinked", workItemId: row.work_item_id, taskId: row.task_id, evidence: { deliverableId, fileId: row.file_id } });
    await client.query("COMMIT"); return { id: deliverableId, removed: true };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
