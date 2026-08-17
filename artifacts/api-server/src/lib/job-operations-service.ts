import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { FinancialControlError } from "./financial-control-contract";
import { effectiveCommercialAccessForUser } from "./commercial-entitlement";
import { waitForJobIntakeMigration } from "./job-intake-migration";

type Queryable = { query: (text: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }> };
const TASK_STATUSES = new Set(["not_started", "in_progress", "blocked", "complete", "cancelled"]);
const DELIVERABLE_TYPES = new Set(["shop_drawing", "submittal", "deliverable", "supporting"]);
const PACKAGE_TYPES = new Set(["shop_drawing", "submittal", "mixed", "deliverable"]);
const PACKAGE_STATUSES = new Set(["draft", "internal_review", "submitted", "returned", "approved", "cancelled"]);
const DOCUMENT_TARGET_TYPES = new Set(["task", "work_package"]);
const DOCUMENT_ENTITY_TYPES = new Set(["rfi", "file_revision", "transmittal"]);
const DOCUMENT_CONNECTION_OPTION_LIMIT = 200;
const DOCUMENT_CONNECTION_LIST_LIMIT = 200;
const BUDGET_METRICS = new Set(["hours", "internal_cost", "billable_value"]);
const BUDGET_REVIEW_STATUSES = new Set(["acknowledged", "resolved", "rejected"]);
const PACKAGE_TRANSITIONS: Record<string, Set<string>> = {
  draft: new Set(["draft", "internal_review", "cancelled"]),
  internal_review: new Set(["draft", "internal_review", "submitted", "returned", "cancelled"]),
  submitted: new Set(["submitted", "returned", "approved", "cancelled"]),
  returned: new Set(["returned", "internal_review", "submitted", "cancelled"]),
  approved: new Set(["approved", "returned", "cancelled"]),
  cancelled: new Set(["cancelled", "draft"]),
};
const MANAGER_ROLES = new Set(["owner", "admin", "project_admin", "project_manager", "bim_manager", "manager"]);

function id(value: unknown, field: string) {
  const parsed = String(value ?? "").trim();
  if (!/^[0-9a-f-]{8,64}$/i.test(parsed)) throw new FinancialControlError(400, "JOB_OPERATIONS_ID_INVALID", `${field} is invalid.`);
  return parsed;
}
const RFC4122_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function canonicalDocumentConnectionId(value: unknown) {
  const parsed = String(value ?? "");
  if (!RFC4122_UUID.test(parsed)) throw new FinancialControlError(400, "JOB_OPERATIONS_ID_INVALID", "connectionId must be an RFC 4122 UUID.");
  return parsed.toLowerCase();
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
function requiredText(value: unknown, max: number, field: string) {
  const parsed = text(value, max, field);
  if (!parsed) throw new FinancialControlError(400, "JOB_OPERATIONS_TEXT_INVALID", `${field} is required.`);
  return parsed;
}
function optionalDate(value: unknown, field: string) {
  if (value == null || value === "") return null;
  const parsed = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed) || Number.isNaN(Date.parse(`${parsed}T00:00:00Z`))) throw new FinancialControlError(400, "JOB_OPERATIONS_DATE_INVALID", `${field} is invalid.`);
  return parsed;
}
function packageTaskIds(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) throw new FinancialControlError(400, "JOB_OPERATIONS_PACKAGE_TASKS_INVALID", "Choose between 1 and 100 tasks for the package.");
  const parsed = [...new Set(value.map((item) => id(item, "taskId")))];
  if (parsed.length !== value.length) throw new FinancialControlError(400, "JOB_OPERATIONS_PACKAGE_TASKS_INVALID", "Package tasks must be unique.");
  return parsed;
}
function workHours(value: unknown) {
  const parsed = String(value ?? "").trim();
  if (!/^(?:0*[0-9]|1[0-9]|2[0-3])(?:\.\d{1,6})?$|^24(?:\.0{1,6})?$/.test(parsed) || Number(parsed) <= 0) throw new FinancialControlError(400, "JOB_OPERATIONS_HOURS_INVALID", "Hours must be greater than zero and no more than 24.");
  return parsed;
}

async function scope(actorUserId: number, projectId: number, client: Queryable = pool) {
  const row = (await client.query(`SELECT p.id,p.name,p.code,u.is_super_admin,u.company_id actor_company,pm.role,ji.id intake_id,ji.data,
    COALESCE((SELECT company_id FROM project_company_binding_versions WHERE project_id=p.id ORDER BY version DESC LIMIT 1),creator.company_id) project_company
    FROM projects p JOIN users u ON u.id=$2 JOIN users creator ON creator.id=p.created_by_id
    LEFT JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=u.id AND pm.status='active'
    LEFT JOIN job_intakes ji ON ji.project_id=p.id
    WHERE p.id=$1 AND p.status<>'archived'`, [projectId, actorUserId])).rows[0];
  if (!row) throw new FinancialControlError(404, "JOB_OPERATIONS_PROJECT_NOT_FOUND", "Project not found.");
  if (!row.is_super_admin && !row.role) throw new FinancialControlError(403, "JOB_OPERATIONS_MEMBERSHIP_REQUIRED", "Active project membership is required.");
  if (!row.is_super_admin && Number(row.actor_company) !== Number(row.project_company)) throw new FinancialControlError(403, "JOB_OPERATIONS_COMPANY_MISMATCH", "The project belongs to another company.");
  const leaderId = Number(row.data?.team?.projectLeaderUserId ?? 0) || null;
  return { projectId, projectName: row.name, projectCode: row.code, companyId: Number(row.project_company), intakeId: row.intake_id ?? null, leaderId, canManage: row.is_super_admin === true || leaderId === actorUserId || MANAGER_ROLES.has(String(row.role ?? "").toLowerCase()) };
}

async function event(client: Queryable, input: { projectId: number; actorUserId: number; eventType: string; workItemId?: string | null; taskId?: string | null; assignmentId?: string | null; packageId?: string | null; evidence?: Record<string, unknown> }) {
  await client.query(`INSERT INTO job_activation_operation_events(id,project_id,work_item_id,task_id,assignment_id,package_id,actor_user_id,event_type,evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, [crypto.randomUUID(), input.projectId, input.workItemId ?? null, input.taskId ?? null, input.assignmentId ?? null, input.packageId ?? null, input.actorUserId, input.eventType, JSON.stringify(input.evidence ?? {})]);
}

async function taskAccess(client: Queryable, actorUserId: number, projectId: number, taskId: string, knownAccess?: Awaited<ReturnType<typeof scope>>) {
  const access = knownAccess ?? await scope(actorUserId, projectId, client);
  const task = (await client.query(`SELECT t.*,w.project_id,w.intake_id,w.status work_item_status FROM job_activation_tasks t JOIN job_activation_work_items w ON w.id=t.work_item_id WHERE t.id=$1 AND w.project_id=$2`, [taskId, projectId])).rows[0];
  if (!task) throw new FinancialControlError(404, "JOB_OPERATIONS_TASK_NOT_FOUND", "Task not found.");
  const assigned = Number(task.assignee_user_id) === actorUserId || Boolean((await client.query(`SELECT 1 FROM job_activation_resource_assignments WHERE task_id=$1 AND user_id=$2 LIMIT 1`, [taskId, actorUserId])).rows[0]);
  return { access, task, canControl: access.canManage || assigned };
}

async function packageAccess(client: Queryable, actorUserId: number, projectId: number, packageId: string, knownAccess?: Awaited<ReturnType<typeof scope>>) {
  const access = knownAccess ?? await scope(actorUserId, projectId, client);
  const workPackage = (await client.query(`SELECT p.*,w.status work_item_status FROM job_activation_work_packages p JOIN job_activation_work_items w ON w.id=p.work_item_id WHERE p.id=$1 AND p.project_id=$2`, [packageId, projectId])).rows[0];
  if (!workPackage) throw new FinancialControlError(404, "JOB_OPERATIONS_PACKAGE_NOT_FOUND", "Work package not found.");
  return { access, workPackage, canControl: access.canManage || Number(workPackage.responsible_user_id) === actorUserId };
}

type DocumentTargetType = "task" | "work_package";
type DocumentEntityType = "rfi" | "file_revision" | "transmittal";

function documentTargetType(value: unknown): DocumentTargetType {
  const parsed = String(value ?? "");
  if (!DOCUMENT_TARGET_TYPES.has(parsed)) throw new FinancialControlError(400, "JOB_OPERATIONS_DOCUMENT_TARGET_TYPE_INVALID", "Document connection target type is invalid.");
  return parsed as DocumentTargetType;
}

function documentEntityType(value: unknown): DocumentEntityType {
  const parsed = String(value ?? "");
  if (!DOCUMENT_ENTITY_TYPES.has(parsed)) throw new FinancialControlError(400, "JOB_OPERATIONS_DOCUMENT_ENTITY_TYPE_INVALID", "Document connection entity type is invalid.");
  return parsed as DocumentEntityType;
}

async function documentTargetAccess(client: Queryable, actorUserId: number, projectId: number, targetType: DocumentTargetType, targetId: string, options: { allowStale?: boolean; access?: Awaited<ReturnType<typeof scope>> } = {}) {
  if (targetType === "task") {
    const control = await taskAccess(client, actorUserId, projectId, targetId, options.access);
    if (!options.allowStale && (control.task.status === "cancelled" || control.task.work_item_status === "cancelled")) throw new FinancialControlError(409, "JOB_OPERATIONS_DOCUMENT_TARGET_STALE", "The selected task is no longer active.");
    return { access: control.access, canControl: control.canControl, workItemId: String(control.task.work_item_id), taskId: targetId, packageId: null as string | null };
  }
  const control = await packageAccess(client, actorUserId, projectId, targetId, options.access);
  if (!options.allowStale && (control.workPackage.status === "cancelled" || control.workPackage.work_item_status === "cancelled")) throw new FinancialControlError(409, "JOB_OPERATIONS_DOCUMENT_TARGET_STALE", "The selected work package is no longer active.");
  return { access: control.access, canControl: control.canControl, workItemId: String(control.workPackage.work_item_id), taskId: null as string | null, packageId: targetId };
}

function documentEntityDeepLink(entityType: DocumentEntityType, projectId: number, entityId: number) {
  if (entityType === "rfi") return `/projects/${projectId}/rfis?rfi=${entityId}`;
  if (entityType === "file_revision") return `/projects/${projectId}/files?file=${entityId}`;
  return `/projects/${projectId}/transmittals?transmittal=${entityId}`;
}

function documentEntity(input: { entityType: DocumentEntityType; entityId: number; displayCode: unknown; title: unknown; status: unknown; version: unknown; available?: boolean }, projectId: number) {
  const available = input.available !== false;
  return {
    id: Number(input.entityId),
    entityType: input.entityType,
    entityId: Number(input.entityId),
    entityIdentity: `${input.entityType}:${input.entityId}`,
    available,
    stale: !available,
    displayCode: available ? String(input.displayCode ?? "") : "",
    title: available ? String(input.title ?? input.displayCode ?? "") : "",
    status: available && input.status != null ? String(input.status) : null,
    version: available && input.version != null ? Number(input.version) : null,
    deepLink: available ? documentEntityDeepLink(input.entityType, projectId, Number(input.entityId)) : "",
  };
}

async function canonicalDocumentEntity(client: Queryable, projectId: number, entityType: DocumentEntityType, entityId: number) {
  let row: any;
  if (entityType === "rfi") row = (await client.query(`SELECT id,number display_code,subject title,status,COALESCE(revision_number,0) version FROM rfis WHERE id=$1 AND project_id=$2 AND deleted_at IS NULL FOR SHARE`, [entityId, projectId])).rows[0];
  else if (entityType === "file_revision") row = (await client.query(`SELECT id,file_name display_code,file_name title,status,version FROM files WHERE id=$1 AND project_id=$2 AND COALESCE(status,'')<>'deleted' FOR SHARE`, [entityId, projectId])).rows[0];
  else row = (await client.query(`SELECT id,number display_code,title,status,NULL::integer version FROM transmittals WHERE id=$1 AND project_id=$2 AND deleted_at IS NULL FOR SHARE`, [entityId, projectId])).rows[0];
  if (!row) throw new FinancialControlError(404, "JOB_OPERATIONS_DOCUMENT_ENTITY_NOT_FOUND", "Canonical document record not found in this project.");
  return documentEntity({ entityType, entityId: Number(row.id), displayCode: row.display_code, title: row.title, status: row.status, version: row.version }, projectId);
}

export function presentDocumentConnectionOptionView(projectId: number, rows: { rfis: any[]; fileRevisions: any[]; transmittals: any[] }, totals: { rfis: number; fileRevisions: number; transmittals: number }) {
  const option = (row: any, deepLink: string) => ({ id: Number(row.id), displayCode: String(row.display_code), title: String(row.title ?? row.display_code), status: row.status == null ? null : String(row.status), version: row.version == null ? null : Number(row.version), deepLink });
  const options = {
    rfis: rows.rfis.map((row) => option(row, documentEntityDeepLink("rfi", projectId, Number(row.id)))),
    fileRevisions: rows.fileRevisions.map((row) => ({ ...option(row, documentEntityDeepLink("file_revision", projectId, Number(row.id))), parentFileId: row.parent_file_id == null ? null : Number(row.parent_file_id) })),
    transmittals: rows.transmittals.map((row) => option(row, documentEntityDeepLink("transmittal", projectId, Number(row.id)))),
  };
  return { options, meta: {
    rfis: { total: totals.rfis, limited: totals.rfis > options.rfis.length, max: DOCUMENT_CONNECTION_OPTION_LIMIT },
    fileRevisions: { total: totals.fileRevisions, limited: totals.fileRevisions > options.fileRevisions.length, max: DOCUMENT_CONNECTION_OPTION_LIMIT },
    transmittals: { total: totals.transmittals, limited: totals.transmittals > options.transmittals.length, max: DOCUMENT_CONNECTION_OPTION_LIMIT },
  } };
}

async function documentConnectionOptions(client: Queryable, projectId: number) {
  const [rfis, fileRevisions, transmittals, rfiCount, fileRevisionCount, transmittalCount] = await Promise.all([
    client.query(`SELECT id,number display_code,subject title,status,COALESCE(revision_number,0) version FROM rfis WHERE project_id=$1 AND deleted_at IS NULL ORDER BY lower(number),id LIMIT $2`, [projectId, DOCUMENT_CONNECTION_OPTION_LIMIT]),
    client.query(`SELECT id,file_name display_code,file_name title,status,version,parent_file_id FROM files WHERE project_id=$1 AND COALESCE(status,'')<>'deleted' ORDER BY lower(file_name),version DESC,id LIMIT $2`, [projectId, DOCUMENT_CONNECTION_OPTION_LIMIT]),
    client.query(`SELECT id,number display_code,title,status,NULL::integer version FROM transmittals WHERE project_id=$1 AND deleted_at IS NULL ORDER BY lower(number),id LIMIT $2`, [projectId, DOCUMENT_CONNECTION_OPTION_LIMIT]),
    client.query(`SELECT COUNT(*)::integer total FROM rfis WHERE project_id=$1 AND deleted_at IS NULL`, [projectId]),
    client.query(`SELECT COUNT(*)::integer total FROM files WHERE project_id=$1 AND COALESCE(status,'')<>'deleted'`, [projectId]),
    client.query(`SELECT COUNT(*)::integer total FROM transmittals WHERE project_id=$1 AND deleted_at IS NULL`, [projectId]),
  ]);
  const total = { rfis: Number(rfiCount.rows[0]?.total ?? 0), fileRevisions: Number(fileRevisionCount.rows[0]?.total ?? 0), transmittals: Number(transmittalCount.rows[0]?.total ?? 0) };
  return presentDocumentConnectionOptionView(projectId, { rfis: rfis.rows, fileRevisions: fileRevisions.rows, transmittals: transmittals.rows }, total);
}

async function documentConnectionRows(client: Queryable, projectId: number, connectionId: string) {
  return (await client.query(`SELECT c.id,c.project_id "projectId",c.target_type "targetType",c.target_id "targetId",c.entity_type "entityType",c.entity_id "entityId",c.note,c.linked_by_id "linkedById",c.linked_at "linkedAt",
    CASE c.entity_type WHEN 'rfi' THEN r.id WHEN 'file_revision' THEN f.id WHEN 'transmittal' THEN tx.id END "canonicalId",
    CASE c.entity_type WHEN 'rfi' THEN r.number WHEN 'file_revision' THEN f.file_name WHEN 'transmittal' THEN tx.number END "displayCode",
    CASE c.entity_type WHEN 'rfi' THEN r.subject WHEN 'file_revision' THEN f.file_name WHEN 'transmittal' THEN tx.title END title,
    CASE c.entity_type WHEN 'rfi' THEN CASE WHEN r.deleted_at IS NULL THEN r.status ELSE 'deleted' END WHEN 'file_revision' THEN f.status WHEN 'transmittal' THEN CASE WHEN tx.deleted_at IS NULL THEN tx.status ELSE 'deleted' END END status,
    CASE c.entity_type WHEN 'rfi' THEN COALESCE(r.revision_number,0) WHEN 'file_revision' THEN f.version ELSE NULL END version
    FROM job_activation_document_connections c
    LEFT JOIN rfis r ON c.entity_type='rfi' AND r.id=c.entity_id AND r.project_id=c.project_id
    LEFT JOIN files f ON c.entity_type='file_revision' AND f.id=c.entity_id AND f.project_id=c.project_id
    LEFT JOIN transmittals tx ON c.entity_type='transmittal' AND tx.id=c.entity_id AND tx.project_id=c.project_id
    WHERE c.project_id=$1 AND c.id=$2
    ORDER BY c.linked_at DESC,c.id LIMIT 1`, [projectId, connectionId])).rows;
}

export function presentDocumentConnection(row: any, canRemove: boolean) {
  const entityType = row.entityType as DocumentEntityType, entityId = Number(row.entityId);
  const entityAvailable = row.canonicalId != null
    && !(entityType === "rfi" && row.status === "deleted")
    && !(entityType === "file_revision" && row.status === "deleted")
    && !(entityType === "transmittal" && row.status === "deleted");
  return {
    id: String(row.id), projectId: Number(row.projectId), targetType: row.targetType as DocumentTargetType, targetId: String(row.targetId), entityType, entityId,
    note: String(row.note ?? ""), linkedById: Number(row.linkedById), linkedAt: row.linkedAt,
    canRemove,
    entity: documentEntity({ entityType, entityId, displayCode: row.displayCode, title: row.title, status: row.status, version: row.version, available: entityAvailable }, Number(row.projectId)),
  };
}

export function presentDocumentConnectionListView(rows: any[], canManage: boolean) {
  const total = Number(rows[0]?.connectionTotal ?? 0);
  const connections = rows.map((row) => presentDocumentConnection(row, canManage || row.currentCanControl === true));
  return { connections, meta: { total, limited: total > connections.length, max: DOCUMENT_CONNECTION_LIST_LIMIT } };
}

async function documentConnectionList(client: Queryable, projectId: number, actorUserId: number, canManage: boolean) {
  const rows = (await client.query(`WITH current_task_control AS (
      SELECT t.id FROM job_activation_tasks t
      JOIN job_activation_work_items w ON w.id=t.work_item_id
      LEFT JOIN job_activation_resource_assignments ra ON ra.task_id=t.id AND ra.user_id=$2
      WHERE w.project_id=$1 AND (t.assignee_user_id=$2 OR ra.id IS NOT NULL)
      GROUP BY t.id
    ), current_package_control AS (
      SELECT p.id FROM job_activation_work_packages p WHERE p.project_id=$1 AND p.responsible_user_id=$2
    )
    SELECT c.id,c.project_id "projectId",c.target_type "targetType",c.target_id "targetId",c.entity_type "entityType",c.entity_id "entityId",c.note,c.linked_by_id "linkedById",c.linked_at "linkedAt",
    COUNT(*) OVER()::integer "connectionTotal",
    ((c.target_type='task' AND tc.id IS NOT NULL) OR (c.target_type='work_package' AND pc.id IS NOT NULL)) "currentCanControl",
    CASE c.entity_type WHEN 'rfi' THEN r.id WHEN 'file_revision' THEN f.id WHEN 'transmittal' THEN tx.id END "canonicalId",
    CASE c.entity_type WHEN 'rfi' THEN r.number WHEN 'file_revision' THEN f.file_name WHEN 'transmittal' THEN tx.number END "displayCode",
    CASE c.entity_type WHEN 'rfi' THEN r.subject WHEN 'file_revision' THEN f.file_name WHEN 'transmittal' THEN tx.title END title,
    CASE c.entity_type WHEN 'rfi' THEN CASE WHEN r.deleted_at IS NULL THEN r.status ELSE 'deleted' END WHEN 'file_revision' THEN f.status WHEN 'transmittal' THEN CASE WHEN tx.deleted_at IS NULL THEN tx.status ELSE 'deleted' END END status,
    CASE c.entity_type WHEN 'rfi' THEN COALESCE(r.revision_number,0) WHEN 'file_revision' THEN f.version ELSE NULL END version
    FROM job_activation_document_connections c
    LEFT JOIN current_task_control tc ON c.target_type='task' AND tc.id=c.target_id
    LEFT JOIN current_package_control pc ON c.target_type='work_package' AND pc.id=c.target_id
    LEFT JOIN rfis r ON c.entity_type='rfi' AND r.id=c.entity_id AND r.project_id=c.project_id
    LEFT JOIN files f ON c.entity_type='file_revision' AND f.id=c.entity_id AND f.project_id=c.project_id
    LEFT JOIN transmittals tx ON c.entity_type='transmittal' AND tx.id=c.entity_id AND tx.project_id=c.project_id
    WHERE c.project_id=$1
    ORDER BY c.linked_at DESC,c.id
    LIMIT $3`, [projectId, actorUserId, DOCUMENT_CONNECTION_LIST_LIMIT])).rows;
  return presentDocumentConnectionListView(rows, canManage);
}

export async function currentDocumentConnectionCanRemove(client: Queryable, actorUserId: number, projectId: number, row: any, access: Awaited<ReturnType<typeof scope>>) {
  try {
    const target = await documentTargetAccess(client, actorUserId, projectId, documentTargetType(row.targetType ?? row.target_type), id(row.targetId ?? row.target_id, "targetId"), { allowStale: true, access });
    return target.canControl;
  } catch (error) {
    if (error instanceof FinancialControlError && (error.code === "JOB_OPERATIONS_TASK_NOT_FOUND" || error.code === "JOB_OPERATIONS_PACKAGE_NOT_FOUND")) return access.canManage;
    throw error;
  }
}

async function validatePackageTasks(client: Queryable, workItemId: string, taskIds: string[]) {
  const rows = (await client.query(`SELECT id FROM job_activation_tasks WHERE work_item_id=$1 AND id=ANY($2::text[])`, [workItemId, taskIds])).rows;
  if (rows.length !== taskIds.length) throw new FinancialControlError(400, "JOB_OPERATIONS_PACKAGE_TASKS_INVALID", "Every package task must belong to the selected activated work item.");
}

async function liveBudgetSnapshot(client: Queryable, intakeId: string) {
  const items = (await client.query(`SELECT w.id,w.name,w.planned_hours::text "plannedHours",COALESCE(t.actual_hours,0)::text "actualHours",COALESCE(p.planned_internal_cost,0)::text "plannedInternalCost",COALESCE(a.actual_internal_cost,0)::text "actualInternalCost",COALESCE(w.planned_billable_value,0)::text "plannedBillableValue",COALESCE(a.earned_billable_value,0)::text "earnedBillableValue"
    FROM job_activation_work_items w
    LEFT JOIN LATERAL (SELECT SUM(hours) actual_hours FROM job_activation_time_entries WHERE work_item_id=w.id) t ON true
    LEFT JOIN LATERAL (SELECT SUM(planned_internal_cost) planned_internal_cost FROM job_activation_resource_assignments WHERE work_item_id=w.id) p ON true
    LEFT JOIN LATERAL (SELECT SUM(e.hours*r.internal_hourly_rate) actual_internal_cost,SUM(e.hours*COALESCE(r.billing_hourly_rate,w.billing_hourly_rate)) earned_billable_value FROM job_activation_time_entries e LEFT JOIN job_activation_resource_assignments r ON r.id=e.assignment_id WHERE e.work_item_id=w.id) a ON true
    WHERE w.intake_id=$1 AND w.status<>'cancelled' ORDER BY w.id`, [intakeId])).rows;
  const sum = (key: string) => items.reduce((total, item) => total + Number(item[key] ?? 0), 0).toFixed(6);
  return { items, totals: { plannedHours: sum("plannedHours"), actualHours: sum("actualHours"), plannedInternalCost: sum("plannedInternalCost"), actualInternalCost: sum("actualInternalCost"), plannedBillableValue: sum("plannedBillableValue"), earnedBillableValue: sum("earnedBillableValue") } };
}

function baselineContent(snapshot: Awaited<ReturnType<typeof liveBudgetSnapshot>>) {
  return { items: snapshot.items.map(({ id, name, plannedHours, plannedInternalCost, plannedBillableValue }) => ({ id, name, plannedHours, plannedInternalCost, plannedBillableValue })), totals: { plannedHours: snapshot.totals.plannedHours, plannedInternalCost: snapshot.totals.plannedInternalCost, plannedBillableValue: snapshot.totals.plannedBillableValue } };
}

function varianceMetrics(baseline: any, live: Awaited<ReturnType<typeof liveBudgetSnapshot>>) {
  const values = [
    ["hours", baseline?.totals?.plannedHours, live.totals.actualHours],
    ["internal_cost", baseline?.totals?.plannedInternalCost, live.totals.actualInternalCost],
    ["billable_value", baseline?.totals?.plannedBillableValue, live.totals.earnedBillableValue],
  ];
  return values.map(([metric, planned, actual]) => ({ metric, planned: Number(planned ?? 0).toFixed(6), actual: Number(actual ?? 0).toFixed(6), variance: (Number(actual ?? 0) - Number(planned ?? 0)).toFixed(6), overrun: Number(actual ?? 0) > Number(planned ?? 0) }));
}

async function budgetGovernanceView(client: Queryable, access: Awaited<ReturnType<typeof scope>>, capabilities: any) {
  const enabled = capabilities.budget === true || capabilities.cost_value_planner === true;
  if (!enabled || !access.intakeId) return { enabled, latestBaseline: null, history: [], metrics: [], reviews: [], unresolvedOverruns: 0 };
  const live = await liveBudgetSnapshot(client, access.intakeId);
  const history = (await client.query(`SELECT b.id,b.version,b.supersedes_id "supersedesId",b.content,b.revision_reason "revisionReason",b.created_at "createdAt",u.full_name "createdBy" FROM job_activation_budget_baselines b JOIN users u ON u.id=b.created_by_id WHERE b.project_id=$1 ORDER BY b.version DESC`, [access.projectId])).rows;
  const latestBaseline = history[0] ?? null;
  const metrics = latestBaseline ? varianceMetrics(latestBaseline.content, live) : [];
  const reviews = (await client.query(`SELECT r.id,r.baseline_id "baselineId",r.work_item_id "workItemId",r.metric,r.planned_value::text planned,r.actual_value::text actual,r.variance_value::text variance,r.reason,r.corrective_action "correctiveAction",r.status,r.version,r.created_at "createdAt",r.reviewed_at "reviewedAt",u.full_name "createdBy" FROM job_activation_budget_variance_reviews r JOIN users u ON u.id=r.created_by_id WHERE r.project_id=$1 ORDER BY r.created_at DESC,r.id DESC`, [access.projectId])).rows;
  const openMetrics = new Set(reviews.filter((review) => review.status === "open" || review.status === "acknowledged").map((review) => review.metric));
  return { enabled, latestBaseline, history, metrics, reviews, unresolvedOverruns: metrics.filter((metric) => metric.overrun && !openMetrics.has(metric.metric)).length };
}

const fixed = (value: unknown) => Number(value ?? 0).toFixed(2);
const ratio = (numerator: number, denominator: number) => denominator > 0 ? Number((numerator / denominator).toFixed(2)) : null;
const forecast = (actual: number, progressFraction: number) => actual > 0 && progressFraction > 0 ? Number((actual / progressFraction).toFixed(2)) : null;

function controlRow(row: any) {
  const progressPercent = Math.max(0, Math.min(100, Number(row.progressPercent ?? 0)));
  const progressFraction = progressPercent / 100;
  const plannedHours = Number(row.plannedHours ?? 0), actualHours = Number(row.actualHours ?? 0);
  const plannedInternalCost = Number(row.plannedInternalCost ?? 0), actualInternalCost = Number(row.actualInternalCost ?? 0);
  const plannedBillableValue = Number(row.plannedBillableValue ?? 0), earnedBillableValue = Number(row.earnedBillableValue ?? 0);
  const earnedInternalValue = plannedInternalCost * progressFraction;
  const estimatedHoursAtCompletion = forecast(actualHours, progressFraction);
  const estimatedCostAtCompletion = forecast(actualInternalCost, progressFraction);
  const cpi = ratio(earnedInternalValue, actualInternalCost);
  let status = "healthy";
  if (progressPercent === 0 && actualHours === 0) status = "not_started";
  else if (Number(row.blockedPackages ?? 0) > 0 || (cpi != null && cpi < 0.8) || (plannedInternalCost > 0 && actualInternalCost > plannedInternalCost)) status = "critical";
  else if (Number(row.overduePackages ?? 0) > 0 || (cpi != null && cpi < 1) || (estimatedCostAtCompletion != null && plannedInternalCost > 0 && estimatedCostAtCompletion > plannedInternalCost) || (estimatedHoursAtCompletion != null && plannedHours > 0 && estimatedHoursAtCompletion > plannedHours)) status = "warning";
  return {
    id: row.id, name: row.name, progressPercent: Number(progressPercent.toFixed(2)), status,
    packageIds: row.packageIds ?? [], memberIds: (row.memberIds ?? []).map(Number),
    packageCount: Number(row.packageCount ?? 0), overduePackages: Number(row.overduePackages ?? 0), blockedPackages: Number(row.blockedPackages ?? 0),
    plannedHours: fixed(plannedHours), actualHours: fixed(actualHours), remainingHours: fixed(Math.max(0, plannedHours - actualHours)), estimatedHoursAtCompletion: estimatedHoursAtCompletion?.toFixed(2) ?? null, hoursVarianceAtCompletion: estimatedHoursAtCompletion == null ? null : fixed(plannedHours - estimatedHoursAtCompletion),
    plannedInternalCost: fixed(plannedInternalCost), actualInternalCost: fixed(actualInternalCost), earnedInternalValue: fixed(earnedInternalValue), remainingInternalBudget: fixed(Math.max(0, plannedInternalCost - actualInternalCost)), cpi,
    estimatedCostAtCompletion: estimatedCostAtCompletion?.toFixed(2) ?? null, estimatedCostToComplete: estimatedCostAtCompletion == null ? null : fixed(Math.max(0, estimatedCostAtCompletion - actualInternalCost)), costVarianceAtCompletion: estimatedCostAtCompletion == null ? null : fixed(plannedInternalCost - estimatedCostAtCompletion),
    plannedBillableValue: fixed(plannedBillableValue), earnedBillableValue: fixed(earnedBillableValue),
  };
}

async function projectControlsView(client: Queryable, access: Awaited<ReturnType<typeof scope>>, capabilities: any) {
  const budgetVisible = capabilities.budget === true, valueVisible = capabilities.cost_value_planner === true;
  const enabled = budgetVisible || valueVisible;
  if (!enabled || !access.intakeId) return { enabled, budgetVisible, valueVisible, rows: [], totals: null, alerts: { critical: 0, warning: 0, overduePackages: 0, blockedPackages: 0 }, spi: null };
  const sourceRows = (await client.query(`SELECT w.id,w.name,w.planned_hours::text "plannedHours",COALESCE(pr.progress_percent,0)::text "progressPercent",COALESCE(ac.actual_hours,0)::text "actualHours",COALESCE(rp.planned_internal_cost,0)::text "plannedInternalCost",COALESCE(ac.actual_internal_cost,0)::text "actualInternalCost",COALESCE(w.planned_billable_value,0)::text "plannedBillableValue",COALESCE(ac.earned_billable_value,0)::text "earnedBillableValue",COALESCE(rp.member_ids,'{}'::integer[]) "memberIds",COALESCE(pk.package_ids,'{}'::text[]) "packageIds",COALESCE(pk.package_count,0)::int "packageCount",COALESCE(pk.overdue_packages,0)::int "overduePackages",COALESCE(pk.blocked_packages,0)::int "blockedPackages"
    FROM job_activation_work_items w
    LEFT JOIN LATERAL (SELECT COALESCE(SUM(planned_hours*progress_percent)/NULLIF(SUM(planned_hours),0),AVG(progress_percent),0) progress_percent FROM job_activation_tasks WHERE work_item_id=w.id AND status<>'cancelled') pr ON true
    LEFT JOIN LATERAL (SELECT SUM(planned_internal_cost) planned_internal_cost,COALESCE(array_agg(DISTINCT user_id) FILTER(WHERE user_id IS NOT NULL),'{}'::integer[]) member_ids FROM job_activation_resource_assignments WHERE work_item_id=w.id) rp ON true
    LEFT JOIN LATERAL (SELECT SUM(e.hours) actual_hours,SUM(e.hours*r.internal_hourly_rate) actual_internal_cost,SUM(e.hours*COALESCE(r.billing_hourly_rate,w.billing_hourly_rate)) earned_billable_value FROM job_activation_time_entries e LEFT JOIN job_activation_resource_assignments r ON r.id=e.assignment_id WHERE e.work_item_id=w.id) ac ON true
    LEFT JOIN LATERAL (SELECT COALESCE(array_agg(id ORDER BY id),'{}'::text[]) package_ids,COUNT(*) package_count,COUNT(*) FILTER(WHERE due_date<CURRENT_DATE AND status NOT IN('approved','cancelled')) overdue_packages,COUNT(*) FILTER(WHERE EXISTS(SELECT 1 FROM job_activation_work_package_tasks pt JOIN job_activation_tasks t ON t.id=pt.task_id WHERE pt.package_id=job_activation_work_packages.id AND t.status='blocked')) blocked_packages FROM job_activation_work_packages WHERE work_item_id=w.id AND status<>'cancelled') pk ON true
    WHERE w.intake_id=$1 AND w.status<>'cancelled' ORDER BY w.created_at,w.id`, [access.intakeId])).rows;
  const rows = sourceRows.map(controlRow);
  const totalsSource = rows.reduce((total, row) => ({
    plannedHours: total.plannedHours + Number(row.plannedHours), actualHours: total.actualHours + Number(row.actualHours),
    plannedInternalCost: total.plannedInternalCost + Number(row.plannedInternalCost), actualInternalCost: total.actualInternalCost + Number(row.actualInternalCost),
    plannedBillableValue: total.plannedBillableValue + Number(row.plannedBillableValue), earnedBillableValue: total.earnedBillableValue + Number(row.earnedBillableValue),
    earnedHours: total.earnedHours + Number(row.plannedHours) * Number(row.progressPercent) / 100,
    packageCount: total.packageCount + row.packageCount, overduePackages: total.overduePackages + row.overduePackages, blockedPackages: total.blockedPackages + row.blockedPackages,
  }), { plannedHours: 0, actualHours: 0, plannedInternalCost: 0, actualInternalCost: 0, plannedBillableValue: 0, earnedBillableValue: 0, earnedHours: 0, packageCount: 0, overduePackages: 0, blockedPackages: 0 });
  const totals = controlRow({ id: "project", name: access.projectName, progressPercent: ratio(totalsSource.earnedHours * 100, totalsSource.plannedHours) ?? 0, ...totalsSource });
  const protect = (row: ReturnType<typeof controlRow>) => ({ ...row,
    plannedInternalCost: budgetVisible ? row.plannedInternalCost : null, actualInternalCost: budgetVisible ? row.actualInternalCost : null, earnedInternalValue: budgetVisible ? row.earnedInternalValue : null, remainingInternalBudget: budgetVisible ? row.remainingInternalBudget : null, cpi: budgetVisible ? row.cpi : null, estimatedCostAtCompletion: budgetVisible ? row.estimatedCostAtCompletion : null, estimatedCostToComplete: budgetVisible ? row.estimatedCostToComplete : null, costVarianceAtCompletion: budgetVisible ? row.costVarianceAtCompletion : null,
    plannedBillableValue: valueVisible ? row.plannedBillableValue : null, earnedBillableValue: valueVisible ? row.earnedBillableValue : null,
  });
  return {
    enabled, budgetVisible, valueVisible, rows: rows.map(protect), totals: protect(totals), spi: null,
    alerts: { critical: rows.filter((row) => row.status === "critical").length, warning: rows.filter((row) => row.status === "warning").length, overduePackages: totalsSource.overduePackages, blockedPackages: totalsSource.blockedPackages },
    methodology: { progress: "planned-task-hours weighted completion", cpi: "earned internal value / actual internal cost", forecast: "actual / physical progress", spi: "unavailable until an authoritative schedule baseline exists" },
  };
}

export async function getJobOperations(input: { actorUserId: number; projectId: unknown }) {
  await waitForJobIntakeMigration();
  const projectId = positiveInt(input.projectId, "projectId"), access = await scope(input.actorUserId, projectId);
  const [capabilities, connectionOptionView, connectionView] = await Promise.all([
    effectiveCommercialAccessForUser(input.actorUserId),
    documentConnectionOptions(pool, projectId),
    documentConnectionList(pool, projectId, input.actorUserId, access.canManage),
  ]);
  const documentConnections = connectionView.connections;
  if (!access.intakeId) return { available: false, project: { id: projectId, name: access.projectName, code: access.projectCode }, canManage: access.canManage, capabilities, documentConnections, documentConnectionMeta: connectionView.meta, documentConnectionOptions: connectionOptionView.options, documentConnectionOptionMeta: connectionOptionView.meta };
  const [workItems, tasks, assignments, timeEntries, deliverables, packages, packageTasks, members, files, totals] = await Promise.all([
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
    pool.query(`SELECT p.id,p.work_item_id "workItemId",p.package_code "packageCode",p.title,p.description,p.package_type "packageType",p.status,p.responsible_user_id "responsibleUserId",u.full_name "responsibleName",p.due_date "dueDate",p.version,p.created_at "createdAt",p.updated_at "updatedAt",
      COALESCE(s.task_count,0)::int "taskCount",COALESCE(s.completed_count,0)::int "completedCount",COALESCE(s.blocked_count,0)::int "blockedCount",COALESCE(s.progress_percent,0)::int "progressPercent",
      (p.due_date<CURRENT_DATE AND p.status NOT IN('approved','cancelled')) "overdue"
      FROM job_activation_work_packages p
      LEFT JOIN users u ON u.id=p.responsible_user_id
      LEFT JOIN LATERAL (SELECT COUNT(*) task_count,COUNT(*) FILTER(WHERE t.status='complete') completed_count,COUNT(*) FILTER(WHERE t.status='blocked') blocked_count,ROUND(AVG(t.progress_percent)) progress_percent FROM job_activation_work_package_tasks pt JOIN job_activation_tasks t ON t.id=pt.task_id WHERE pt.package_id=p.id) s ON true
      WHERE p.intake_id=$1 ORDER BY p.updated_at DESC,p.id`, [access.intakeId]),
    pool.query(`SELECT pt.package_id "packageId",pt.task_id "taskId",pt.linked_at "linkedAt" FROM job_activation_work_package_tasks pt JOIN job_activation_work_packages p ON p.id=pt.package_id WHERE p.intake_id=$1 ORDER BY pt.package_id,pt.linked_at,pt.task_id`, [access.intakeId]),
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
  const safePackages = packages.rows.map((row) => ({ ...row, canControl: access.canManage || Number(row.responsibleUserId) === input.actorUserId }));
  const packageSummary = {
    total: safePackages.length,
    overdue: safePackages.filter((row) => row.overdue).length,
    blocked: safePackages.filter((row) => Number(row.blockedCount) > 0).length,
    approved: safePackages.filter((row) => row.status === "approved").length,
  };
  const [budgetGovernance, projectControls] = await Promise.all([budgetGovernanceView(pool, access, capabilities), projectControlsView(pool, access, capabilities)]);
  return { available: safeWorkItems.length > 0, project: { id: projectId, name: access.projectName, code: access.projectCode }, canManage: access.canManage, leaderId: access.leaderId, capabilities, budgetGovernance, projectControls, workItems: safeWorkItems, tasks: safeTasks, assignments: safeAssignments, timeEntries: timeEntries.rows, deliverables: safeDeliverables, packages: safePackages, packageTasks: packageTasks.rows, packageSummary, members: members.rows, files: files.rows, documentConnections, documentConnectionMeta: connectionView.meta, documentConnectionOptions: connectionOptionView.options, documentConnectionOptionMeta: connectionOptionView.meta, totals: safeTotals };
}

export async function createJobBudgetBaseline(input: { actorUserId: number; projectId: unknown; baselineId: unknown; revisionReason?: unknown }) {
  await waitForJobIntakeMigration();
  const projectId = positiveInt(input.projectId, "projectId"), baselineId = id(input.baselineId, "baselineId"), revisionReason = text(input.revisionReason, 1000, "revisionReason");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`bimlog:job-budget:${projectId}`]);
    const access = await scope(input.actorUserId, projectId, client);
    if (!access.canManage) throw new FinancialControlError(403, "JOB_BUDGET_MANAGE_DENIED", "Only the project leader may freeze or revise the execution budget baseline.");
    if (!access.intakeId) throw new FinancialControlError(409, "JOB_BUDGET_INTAKE_REQUIRED", "Activate Job Intake before freezing a budget baseline.");
    const capabilities = await effectiveCommercialAccessForUser(input.actorUserId, client as any);
    if (capabilities.budget !== true && capabilities.cost_value_planner !== true) throw new FinancialControlError(403, "JOB_BUDGET_ENTITLEMENT_REQUIRED", "Budget Governance requires Project Budget or Cost & Value Planner access.");
    const previous = (await client.query(`SELECT id,version,content_fingerprint FROM job_activation_budget_baselines WHERE project_id=$1 ORDER BY version DESC LIMIT 1`, [projectId])).rows[0];
    if (previous && revisionReason.length < 10) throw new FinancialControlError(400, "JOB_BUDGET_REVISION_REASON_REQUIRED", "A budget revision requires a reason of at least 10 characters.");
    const content = baselineContent(await liveBudgetSnapshot(client, access.intakeId));
    const fingerprint = crypto.createHash("sha256").update(JSON.stringify(content)).digest("hex");
    if (previous?.content_fingerprint === fingerprint) { await client.query("COMMIT"); return { id: previous.id, version: Number(previous.version), idempotent: true }; }
    const version = Number(previous?.version ?? 0) + 1;
    await client.query(`INSERT INTO job_activation_budget_baselines(id,intake_id,project_id,version,supersedes_id,content,content_fingerprint,revision_reason,created_by_id) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)`, [baselineId, access.intakeId, projectId, version, previous?.id ?? null, JSON.stringify(content), fingerprint, revisionReason, input.actorUserId]);
    await event(client, { projectId, actorUserId: input.actorUserId, eventType: previous ? "budget_baseline_revised" : "budget_baseline_frozen", evidence: { baselineId, version, supersedesId: previous?.id ?? null, revisionReason, fingerprint } });
    await client.query("COMMIT"); return { id: baselineId, version, idempotent: false };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function createJobBudgetVarianceReview(input: { actorUserId: number; projectId: unknown; reviewId: unknown; metric: unknown; reason: unknown; correctiveAction: unknown }) {
  await waitForJobIntakeMigration();
  const projectId = positiveInt(input.projectId, "projectId"), reviewId = id(input.reviewId, "reviewId"), metric = String(input.metric ?? ""), reason = requiredText(input.reason, 1000, "reason"), correctiveAction = requiredText(input.correctiveAction, 2000, "correctiveAction");
  if (!BUDGET_METRICS.has(metric)) throw new FinancialControlError(400, "JOB_BUDGET_METRIC_INVALID", "Budget variance metric is invalid.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`bimlog:job-budget-review:${projectId}:${metric}`]);
    const access = await scope(input.actorUserId, projectId, client);
    if (!access.canManage) throw new FinancialControlError(403, "JOB_BUDGET_MANAGE_DENIED", "Only the project leader may explain a budget variance.");
    const baseline = (await client.query(`SELECT id,content FROM job_activation_budget_baselines WHERE project_id=$1 ORDER BY version DESC LIMIT 1`, [projectId])).rows[0];
    if (!baseline || !access.intakeId) throw new FinancialControlError(409, "JOB_BUDGET_BASELINE_REQUIRED", "Freeze the execution budget baseline first.");
    const current = varianceMetrics(baseline.content, await liveBudgetSnapshot(client, access.intakeId)).find((item) => item.metric === metric)!;
    if (!current.overrun) throw new FinancialControlError(409, "JOB_BUDGET_OVERRUN_REQUIRED", "The selected metric does not currently exceed its baseline.");
    const existing = (await client.query(`SELECT id,status FROM job_activation_budget_variance_reviews WHERE id=$1 OR (baseline_id=$2 AND metric=$3 AND status IN('open','acknowledged')) ORDER BY CASE WHEN id=$1 THEN 0 ELSE 1 END LIMIT 1`, [reviewId, baseline.id, metric])).rows[0];
    if (!existing) {
      await client.query(`INSERT INTO job_activation_budget_variance_reviews(id,baseline_id,project_id,metric,planned_value,actual_value,variance_value,reason,corrective_action,created_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [reviewId, baseline.id, projectId, metric, current.planned, current.actual, current.variance, reason, correctiveAction, input.actorUserId]);
      await event(client, { projectId, actorUserId: input.actorUserId, eventType: "budget_variance_explained", evidence: { reviewId, baselineId: baseline.id, metric, planned: current.planned, actual: current.actual, variance: current.variance } });
    }
    await client.query("COMMIT"); return { id: existing?.id ?? reviewId, status: existing?.status ?? "open", idempotent: Boolean(existing) };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function updateJobBudgetVarianceReview(input: { actorUserId: number; projectId: unknown; reviewId: unknown; expectedVersion: unknown; status: unknown }) {
  await waitForJobIntakeMigration();
  const projectId = positiveInt(input.projectId, "projectId"), reviewId = id(input.reviewId, "reviewId"), expectedVersion = positiveInt(input.expectedVersion, "expectedVersion"), status = String(input.status ?? "");
  if (!BUDGET_REVIEW_STATUSES.has(status)) throw new FinancialControlError(400, "JOB_BUDGET_REVIEW_STATUS_INVALID", "Budget review status is invalid.");
  const client = await pool.connect();
  try { await client.query("BEGIN"); const access = await scope(input.actorUserId, projectId, client); if (!access.canManage) throw new FinancialControlError(403, "JOB_BUDGET_MANAGE_DENIED", "Only the project leader may close a budget variance review.");
    const updated = (await client.query(`UPDATE job_activation_budget_variance_reviews SET status=$4,version=version+1,reviewed_by_id=$5,reviewed_at=now() WHERE id=$1 AND project_id=$2 AND version=$3 RETURNING version,metric`, [reviewId, projectId, expectedVersion, status, input.actorUserId])).rows[0];
    if (!updated) throw new FinancialControlError(409, "JOB_OPERATIONS_STALE", "This budget review changed in another session. Reload before saving.");
    await event(client, { projectId, actorUserId: input.actorUserId, eventType: "budget_variance_reviewed", evidence: { reviewId, status, version: updated.version, metric: updated.metric } }); await client.query("COMMIT"); return { id: reviewId, status, version: Number(updated.version) };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function createJobOperationPackage(input: { actorUserId: number; projectId: unknown; packageId: unknown; workItemId: unknown; packageCode: unknown; title: unknown; description?: unknown; packageType: unknown; responsibleUserId?: unknown; dueDate?: unknown; taskIds: unknown }) {
  await waitForJobIntakeMigration();
  const projectId = positiveInt(input.projectId, "projectId"), packageId = id(input.packageId, "packageId"), workItemId = id(input.workItemId, "workItemId");
  const packageCode = requiredText(input.packageCode, 50, "packageCode"), title = requiredText(input.title, 160, "title"), description = text(input.description, 2000, "description");
  const packageType = String(input.packageType ?? ""), responsibleUserId = input.responsibleUserId == null || input.responsibleUserId === "" ? null : positiveInt(input.responsibleUserId, "responsibleUserId"), dueDate = optionalDate(input.dueDate, "dueDate"), taskIds = packageTaskIds(input.taskIds);
  if (!PACKAGE_TYPES.has(packageType)) throw new FinancialControlError(400, "JOB_OPERATIONS_PACKAGE_TYPE_INVALID", "Work package type is invalid.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const access = await scope(input.actorUserId, projectId, client);
    if (!access.canManage) throw new FinancialControlError(403, "JOB_OPERATIONS_PACKAGE_MANAGE_DENIED", "Only the project leader may create work packages.");
    const workItem = (await client.query(`SELECT id,intake_id FROM job_activation_work_items WHERE id=$1 AND project_id=$2 AND status='active'`, [workItemId, projectId])).rows[0];
    if (!workItem) throw new FinancialControlError(404, "JOB_OPERATIONS_WORK_ITEM_NOT_FOUND", "Activated work item not found.");
    if ((await client.query(`SELECT 1 FROM job_activation_work_packages WHERE project_id=$1 AND package_code=$2 AND id<>$3`, [projectId, packageCode, packageId])).rows[0]) throw new FinancialControlError(409, "JOB_OPERATIONS_PACKAGE_CODE_CONFLICT", "Work package code already exists in this project.");
    if (responsibleUserId && !(await client.query(`SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2 AND status='active'`, [projectId, responsibleUserId])).rows[0]) throw new FinancialControlError(400, "JOB_OPERATIONS_ASSIGNEE_INVALID", "The responsible person must be an active project member.");
    await validatePackageTasks(client, workItemId, taskIds);
    const existing = (await client.query(`SELECT id FROM job_activation_work_packages WHERE id=$1 AND project_id=$2`, [packageId, projectId])).rows[0];
    if (!existing) {
      await client.query(`INSERT INTO job_activation_work_packages(id,intake_id,project_id,work_item_id,package_code,title,description,package_type,status,responsible_user_id,due_date,created_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10,$11)`, [packageId, workItem.intake_id, projectId, workItemId, packageCode, title, description, packageType, responsibleUserId, dueDate, input.actorUserId]);
      await client.query(`INSERT INTO job_activation_work_package_tasks(package_id,task_id,linked_by_id) SELECT $1,task_id,$3 FROM unnest($2::text[]) task_id`, [packageId, taskIds, input.actorUserId]);
      await event(client, { projectId, actorUserId: input.actorUserId, eventType: "work_package_created", workItemId, packageId, evidence: { packageCode, packageType, responsibleUserId, dueDate, taskIds } });
    }
    await client.query("COMMIT");
    return { id: packageId, version: 1, status: "draft", idempotent: Boolean(existing) };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function updateJobOperationPackage(input: { actorUserId: number; projectId: unknown; packageId: unknown; expectedVersion: unknown; status: unknown; title?: unknown; description?: unknown; packageType?: unknown; responsibleUserId?: unknown; dueDate?: unknown; taskIds?: unknown }) {
  await waitForJobIntakeMigration();
  const projectId = positiveInt(input.projectId, "projectId"), packageId = id(input.packageId, "packageId"), expectedVersion = positiveInt(input.expectedVersion, "expectedVersion"), status = String(input.status ?? "");
  if (!PACKAGE_STATUSES.has(status)) throw new FinancialControlError(400, "JOB_OPERATIONS_PACKAGE_STATUS_INVALID", "Work package status is invalid.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const control = await packageAccess(client, input.actorUserId, projectId, packageId);
    if (!control.canControl) throw new FinancialControlError(403, "JOB_OPERATIONS_PACKAGE_CONTROL_DENIED", "Only the project leader or responsible person may update this work package.");
    if (!PACKAGE_TRANSITIONS[String(control.workPackage.status)]?.has(status)) throw new FinancialControlError(409, "JOB_OPERATIONS_PACKAGE_TRANSITION_INVALID", "The requested work package status transition is not allowed.");
    const metadataChange = input.title !== undefined || input.description !== undefined || input.packageType !== undefined || input.responsibleUserId !== undefined || input.dueDate !== undefined || input.taskIds !== undefined;
    if (metadataChange && !control.access.canManage) throw new FinancialControlError(403, "JOB_OPERATIONS_PACKAGE_MANAGE_DENIED", "Only the project leader may change package definition, responsibility, due date, or tasks.");
    const title = input.title === undefined ? control.workPackage.title : requiredText(input.title, 160, "title");
    const description = input.description === undefined ? control.workPackage.description : text(input.description, 2000, "description");
    const packageType = input.packageType === undefined ? control.workPackage.package_type : String(input.packageType);
    if (!PACKAGE_TYPES.has(packageType)) throw new FinancialControlError(400, "JOB_OPERATIONS_PACKAGE_TYPE_INVALID", "Work package type is invalid.");
    const responsibleUserId = input.responsibleUserId === undefined ? control.workPackage.responsible_user_id : input.responsibleUserId == null || input.responsibleUserId === "" ? null : positiveInt(input.responsibleUserId, "responsibleUserId");
    const dueDate = input.dueDate === undefined ? control.workPackage.due_date : optionalDate(input.dueDate, "dueDate");
    if (responsibleUserId && !(await client.query(`SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2 AND status='active'`, [projectId, responsibleUserId])).rows[0]) throw new FinancialControlError(400, "JOB_OPERATIONS_ASSIGNEE_INVALID", "The responsible person must be an active project member.");
    const taskIds = input.taskIds === undefined ? null : packageTaskIds(input.taskIds);
    if (taskIds) await validatePackageTasks(client, control.workPackage.work_item_id, taskIds);
    const updated = (await client.query(`UPDATE job_activation_work_packages SET title=$3,description=$4,package_type=$5,status=$6,responsible_user_id=$7,due_date=$8,version=version+1,updated_at=now() WHERE id=$1 AND version=$2 RETURNING version`, [packageId, expectedVersion, title, description, packageType, status, responsibleUserId, dueDate])).rows[0];
    if (!updated) throw new FinancialControlError(409, "JOB_OPERATIONS_STALE", "This work package changed in another session. Reload before saving.");
    if (taskIds) {
      await client.query(`DELETE FROM job_activation_work_package_tasks WHERE package_id=$1`, [packageId]);
      await client.query(`INSERT INTO job_activation_work_package_tasks(package_id,task_id,linked_by_id) SELECT $1,task_id,$3 FROM unnest($2::text[]) task_id`, [packageId, taskIds, input.actorUserId]);
    }
    await event(client, { projectId, actorUserId: input.actorUserId, eventType: "work_package_updated", workItemId: control.workPackage.work_item_id, packageId, evidence: { status, title, packageType, responsibleUserId, dueDate, taskIds, version: updated.version } });
    await client.query("COMMIT");
    return { id: packageId, version: Number(updated.version), status };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
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

export async function linkJobOperationDocumentConnection(input: { actorUserId: number; projectId: unknown; connectionId: unknown; targetType: unknown; targetId: unknown; entityType: unknown; entityId: unknown; note?: unknown }) {
  await waitForJobIntakeMigration();
  const projectId = positiveInt(input.projectId, "projectId"), connectionId = canonicalDocumentConnectionId(input.connectionId), targetType = documentTargetType(input.targetType), targetId = id(input.targetId, "targetId"), entityType = documentEntityType(input.entityType), entityId = positiveInt(input.entityId, "entityId"), note = text(input.note, 500, "note");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await documentTargetAccess(client, input.actorUserId, projectId, targetType, targetId);
    if (!target.canControl) throw new FinancialControlError(403, "JOB_OPERATIONS_DOCUMENT_CONNECTION_DENIED", "Only the project leader or the responsible task/package member may connect documents.");
    const entity = await canonicalDocumentEntity(client, projectId, entityType, entityId);
    const existingId = (await client.query(`SELECT id,target_type,target_id,entity_type,entity_id,note FROM job_activation_document_connections WHERE id=$1 AND project_id=$2 FOR UPDATE`, [connectionId, projectId])).rows[0];
    if (existingId) {
      const sameRequest = Number(existingId.entity_id) === entityId && existingId.target_type === targetType && existingId.target_id === targetId && existingId.entity_type === entityType && String(existingId.note) === note;
      if (!sameRequest) throw new FinancialControlError(409, "JOB_OPERATIONS_DOCUMENT_CONNECTION_ID_CONFLICT", "Connection ID is already bound to another request.");
      const rows = await documentConnectionRows(client, projectId, connectionId);
      const result = presentDocumentConnection(rows[0], target.canControl);
      await client.query("COMMIT");
      return { ...result, idempotent: true };
    }
    if ((await client.query(`SELECT 1 FROM job_activation_document_connections WHERE id=$1`, [connectionId])).rows[0]) throw new FinancialControlError(409, "JOB_OPERATIONS_DOCUMENT_CONNECTION_ID_CONFLICT", "Connection ID is unavailable.");
    const inserted = (await client.query(`INSERT INTO job_activation_document_connections(id,project_id,target_type,target_id,entity_type,entity_id,note,linked_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING id`, [connectionId, projectId, targetType, targetId, entityType, entityId, note, input.actorUserId])).rows[0];
    let persistedId = inserted?.id as string | undefined;
    if (!persistedId) persistedId = (await client.query(`SELECT id FROM job_activation_document_connections WHERE project_id=$1 AND target_type=$2 AND target_id=$3 AND entity_type=$4 AND entity_id=$5`, [projectId, targetType, targetId, entityType, entityId])).rows[0]?.id;
    if (!persistedId) throw new FinancialControlError(409, "JOB_OPERATIONS_DOCUMENT_CONNECTION_CONFLICT", "The document connection changed concurrently. Reload and retry.");
    if (inserted) await event(client, { projectId, actorUserId: input.actorUserId, eventType: "document_connection_linked", workItemId: target.workItemId, taskId: target.taskId, packageId: target.packageId, evidence: { connectionId: persistedId, targetType, targetId, entityType, entityId, entityIdentity: entity.entityIdentity, displayCode: entity.displayCode, note } });
    const rows = await documentConnectionRows(client, projectId, persistedId);
    const result = presentDocumentConnection(rows[0], target.canControl);
    await client.query("COMMIT");
    return { ...result, idempotent: !inserted };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function unlinkJobOperationDocumentConnection(input: { actorUserId: number; projectId: unknown; connectionId: unknown }) {
  await waitForJobIntakeMigration();
  const projectId = positiveInt(input.projectId, "projectId"), connectionId = canonicalDocumentConnectionId(input.connectionId), client = await pool.connect();
  try {
    await client.query("BEGIN");
    const access = await scope(input.actorUserId, projectId, client);
    const row = (await client.query(`SELECT * FROM job_activation_document_connections WHERE id=$1 AND project_id=$2 FOR UPDATE`, [connectionId, projectId])).rows[0];
    if (!row) throw new FinancialControlError(404, "JOB_OPERATIONS_DOCUMENT_CONNECTION_NOT_FOUND", "Document connection not found.");
    const canRemove = await currentDocumentConnectionCanRemove(client, input.actorUserId, projectId, row, access);
    if (!canRemove) throw new FinancialControlError(403, "JOB_OPERATIONS_DOCUMENT_CONNECTION_DENIED", "Only the current project leader or current responsible task/package member may remove this connection.");
    await client.query(`DELETE FROM job_activation_document_connections WHERE id=$1 AND project_id=$2`, [connectionId, projectId]);
    await event(client, { projectId, actorUserId: input.actorUserId, eventType: "document_connection_unlinked", taskId: row.target_type === "task" ? row.target_id : null, packageId: row.target_type === "work_package" ? row.target_id : null, evidence: { connectionId, targetType: row.target_type, targetId: row.target_id, entityType: row.entity_type, entityId: Number(row.entity_id), note: String(row.note), linkedById: Number(row.linked_by_id), linkedAt: row.linked_at } });
    await client.query("COMMIT");
    return { id: connectionId, removed: true };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
