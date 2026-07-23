import { pool } from "@workspace/db";
import { hasScopedAuthority, mapCurrentProjectRole } from "./scoped-authority";
import { resolveEffectiveEntitlement } from "./feature-catalog-service";

export const COORDINATOR_ACTION_MODULES = [
  "lens",
  "rfi",
  "submittal",
  "meeting",
  "schedule",
] as const;
export type CoordinatorActionModule =
  (typeof COORDINATOR_ACTION_MODULES)[number];
export type DeadlineState =
  | "overdue"
  | "due_this_week"
  | "upcoming"
  | "no_due_date";
export const COORDINATOR_BUILT_IN_VIEWS = [
  "my_items",
  "this_week",
  "overdue",
  "next_coordination_meeting",
  "all_actionable",
] as const;
export type CoordinatorBuiltInView =
  (typeof COORDINATOR_BUILT_IN_VIEWS)[number];

export type LensIdentity = {
  serverId: number;
  displayId: string | null;
  viewpointId: string;
  navisworksGuid: string | null;
  bimlogPhysicalId: string | null;
  lifecycleStatus: string;
  revisionNumber: number;
  supersedesId: number | null;
  issueGroupId: string | null;
  sourceProjectId: number | null;
  sourceServerId: number | null;
  sourcePhysicalId: string | null;
  sourceDisplayLabel: string | null;
  importedLineageStatus: string | null;
};

export type RelatedIdentity = { id: number; internalLink: string };

export type CoordinatorActionItem = {
  key: string;
  sourceModule: CoordinatorActionModule;
  sourceId: number;
  projectId: number;
  displayIdentifier: string;
  originalStatus: string;
  presentationStatus: string;
  title: string;
  responsibility: {
    company: string | null;
    person: string | null;
    userId: number | null;
  };
  dueAt: string | null;
  deadlineState: DeadlineState;
  floor: string | null;
  discipline: string | null;
  priority: string | null;
  sourceUpdatedAt: string | null;
  internalLink: string;
  related: {
    meetings: RelatedIdentity[];
    schedule: RelatedIdentity[];
    lens: LensIdentity | null;
  };
};

export type SourceState = {
  module: CoordinatorActionModule;
  status: "ok" | "failed" | "unauthorized" | "not_requested";
  count: number | null;
  code?: string;
};

export const COORDINATOR_CONTEXT_METRICS = [
  {
    key: "actionable",
    definition:
      "Current actionable Lens Viewpoints, RFIs, Submittals, Meeting actions, and Schedule tasks after authorization and filters.",
  },
  {
    key: "overdue",
    definition:
      "Actionable records whose canonical due date is before the viewer's project date boundary.",
  },
  {
    key: "dueSoon",
    definition:
      "Actionable records whose canonical due date is today through seven calendar days in the viewer's timezone.",
  },
  {
    key: "blocked",
    definition:
      "Actionable records normalized to blocked/action-required presentation status by the canonical source adapter.",
  },
] as const;

export type RegisterQuery = {
  page: number;
  pageSize: number;
  modules: CoordinatorActionModule[];
  statuses: string[];
  originalStatuses: string[];
  presentationStatuses: string[];
  lensStatuses: string[];
  deadline: "all" | DeadlineState;
  dueFrom: string | null;
  dueTo: string | null;
  overdueOnly: boolean;
  meetingId: number | null;
  builtInView: CoordinatorBuiltInView;
  search: string | null;
  responsibleCompany: string | null;
  responsiblePerson: string | null;
  floor: string | null;
  discipline: string | null;
  timezone: string;
};

export type AccessContext = {
  companyId: number;
  isSuperAdmin: boolean;
  accessMode: "member" | "super_admin_explicit";
};

export function evaluateProjectReadAccess(input: {
  currentCompanyId: number;
  boundCompanyId: number | null;
  role: string | null;
  status: string | null;
  permission: string | null;
  isSuperAdmin: boolean;
  superAdminAccess?: string;
  superAdminReason?: string;
}): AccessContext["accessMode"] | null {
  const mapping = mapCurrentProjectRole(input.role, input.permission);
  const currentTenant =
    Number.isSafeInteger(input.boundCompanyId) &&
    input.boundCompanyId === input.currentCompanyId;
  if (
    currentTenant &&
    input.status === "active" &&
    mapping.knownRole &&
    hasScopedAuthority(mapping, ["project:read"])
  )
    return "member";
  const reason = String(input.superAdminReason ?? "").trim();
  if (
    input.isSuperAdmin &&
    input.superAdminAccess === "project-read" &&
    reason.length >= 12 &&
    reason.length <= 200 &&
    SAFE_TEXT.test(reason)
  ) {
    return "super_admin_explicit";
  }
  return null;
}

type AdapterPayload = {
  count: number;
  rows: Record<string, unknown>[];
  statusCounts: Record<string, number>;
  deadlineCounts: Record<DeadlineState, number>;
};

export class CoordinatorRegisterError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "CoordinatorRegisterError";
  }
}

const SAFE_TEXT = /^[\p{L}\p{N} _.,:/()&+\-'#]{1,120}$/u;
const MAX_PAGE = 100;
const MAX_PAGE_SIZE = 50;
const LENS_ACTIONABLE_STATUSES = ["open", "follow_up", "waiting_design"];

function dateOnly(value: unknown, field: string): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = new Date(`${text}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text)
    throw new CoordinatorRegisterError(400, "REGISTER_DATE_INVALID", `${field} must be YYYY-MM-DD.`);
  return text;
}

function optionalPositiveInteger(value: unknown, field: string): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new CoordinatorRegisterError(400, "REGISTER_FILTER_INVALID", `${field} is invalid.`);
  return parsed;
}

function boundedText(value: unknown, max = 120): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.length > max || !SAFE_TEXT.test(text))
    throw new CoordinatorRegisterError(
      400,
      "REGISTER_FILTER_INVALID",
      "A filter value is invalid.",
    );
  return text;
}

function list(value: unknown, allowed?: readonly string[]): string[] {
  const values = (Array.isArray(value) ? value : String(value ?? "").split(","))
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(values)];
  if (
    unique.length > 20 ||
    unique.some((item) => item.length > 50 || !/^[a-z0-9_-]+$/.test(item))
  ) {
    throw new CoordinatorRegisterError(
      400,
      "REGISTER_FILTER_INVALID",
      "A filter value is invalid.",
    );
  }
  if (allowed && unique.some((item) => !allowed.includes(item))) {
    throw new CoordinatorRegisterError(
      400,
      "REGISTER_FILTER_INVALID",
      "A filter value is invalid.",
    );
  }
  return unique;
}

export function parseRegisterQuery(
  query: Record<string, unknown>,
): RegisterQuery {
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.pageSize ?? 25);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > MAX_PAGE ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > MAX_PAGE_SIZE
  ) {
    throw new CoordinatorRegisterError(
      400,
      "REGISTER_PAGE_INVALID",
      `page must be 1-${MAX_PAGE} and pageSize must be 1-${MAX_PAGE_SIZE}.`,
    );
  }
  const modules = String(query.modules ?? "").trim().toLowerCase() === "none"
    ? []
    : (list(query.modules, COORDINATOR_ACTION_MODULES) as CoordinatorActionModule[]);
  const legacyStatuses = list(query.statuses);
  const originalStatuses = list(query.originalStatuses);
  const presentationStatuses = list(query.presentationStatuses);
  const lensStatuses = list(query.lensStatuses, LENS_ACTIONABLE_STATUSES);
  const deadline = String(query.deadline ?? "all").toLowerCase();
  if (
    !["all", "overdue", "due_this_week", "upcoming", "no_due_date"].includes(
      deadline,
    )
  ) {
    throw new CoordinatorRegisterError(
      400,
      "REGISTER_DEADLINE_INVALID",
      "deadline filter is invalid.",
    );
  }
  const timezone = String(query.timezone ?? "UTC").trim();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new CoordinatorRegisterError(
      400,
      "REGISTER_TIMEZONE_INVALID",
      "timezone must be a valid IANA time zone.",
    );
  }
  const dueFrom = dateOnly(query.dueFrom, "dueFrom");
  const dueTo = dateOnly(query.dueTo, "dueTo");
  if (dueFrom && dueTo && dueFrom > dueTo)
    throw new CoordinatorRegisterError(400, "REGISTER_DATE_RANGE_INVALID", "dueFrom cannot be after dueTo.");
  const overdueRaw = String(query.overdue ?? "false").toLowerCase();
  if (!["true", "false"].includes(overdueRaw))
    throw new CoordinatorRegisterError(400, "REGISTER_FILTER_INVALID", "overdue must be true or false.");
  const builtInView = String(query.builtInView ?? "all_actionable").toLowerCase();
  if (!COORDINATOR_BUILT_IN_VIEWS.includes(builtInView as CoordinatorBuiltInView))
    throw new CoordinatorRegisterError(400, "REGISTER_VIEW_INVALID", "builtInView is invalid.");
  return {
    page,
    pageSize,
    modules: query.modules === undefined ? [...COORDINATOR_ACTION_MODULES] : modules,
    statuses: legacyStatuses,
    originalStatuses,
    presentationStatuses,
    lensStatuses,
    deadline: deadline as RegisterQuery["deadline"],
    dueFrom,
    dueTo,
    overdueOnly: overdueRaw === "true",
    meetingId: optionalPositiveInteger(query.meetingId, "meetingId"),
    builtInView: builtInView as CoordinatorBuiltInView,
    search: boundedText(query.search),
    responsibleCompany: boundedText(query.responsibleCompany),
    responsiblePerson: boundedText(query.responsiblePerson),
    floor: boundedText(query.floor),
    discipline: boundedText(query.discipline),
    timezone,
  };
}

function calendarDateInZone(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addCalendarDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function deadlineState(
  dueAt: string | null,
  timezone: string,
  now = new Date(),
): DeadlineState {
  if (!dueAt) return "no_due_date";
  const today = calendarDateInZone(now, timezone);
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueAt)
    ? dueAt
    : calendarDateInZone(new Date(dueAt), timezone);
  if (dueDate < today) return "overdue";
  if (dueDate <= addCalendarDays(today, 7)) return "due_this_week";
  return "upcoming";
}

const MODULE_ORDER: Record<CoordinatorActionModule, number> = {
  lens: 0,
  rfi: 1,
  submittal: 2,
  meeting: 3,
  schedule: 4,
};
const DEADLINE_ORDER: Record<DeadlineState, number> = {
  overdue: 0,
  due_this_week: 1,
  upcoming: 2,
  no_due_date: 3,
};

export function compareCoordinatorActions(
  a: CoordinatorActionItem,
  b: CoordinatorActionItem,
): number {
  const deadline =
    DEADLINE_ORDER[a.deadlineState] - DEADLINE_ORDER[b.deadlineState];
  if (deadline) return deadline;
  const due =
    (a.dueAt ? Date.parse(a.dueAt) : Number.MAX_SAFE_INTEGER) -
    (b.dueAt ? Date.parse(b.dueAt) : Number.MAX_SAFE_INTEGER);
  if (due) return due;
  const updated =
    (b.sourceUpdatedAt ? Date.parse(b.sourceUpdatedAt) : 0) -
    (a.sourceUpdatedAt ? Date.parse(a.sourceUpdatedAt) : 0);
  if (updated) return updated;
  const module = MODULE_ORDER[a.sourceModule] - MODULE_ORDER[b.sourceModule];
  return module || a.sourceId - b.sourceId;
}

export async function authorizeCoordinatorProject(input: {
  userId: number;
  projectId: number;
  superAdminAccess?: string;
  superAdminReason?: string;
}): Promise<AccessContext> {
  const result = await pool.query(
    `SELECT u.company_id,u.is_super_admin,pm.role,pm.status,co.meta,b.company_id AS bound_company_id
    FROM users u CROSS JOIN projects p
    LEFT JOIN LATERAL (SELECT company_id FROM project_company_binding_versions WHERE project_id=p.id ORDER BY version DESC LIMIT 1) b ON true
    LEFT JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=u.id
    LEFT JOIN config_options co ON co.category='member_role' AND co.value=pm.role
    WHERE u.id=$1 AND p.id=$2 ORDER BY co.id NULLS LAST LIMIT 1`,
    [input.userId, input.projectId],
  );
  const row = result.rows[0];
  if (!row)
    throw new CoordinatorRegisterError(
      403,
      "PROJECT_ACCESS_DENIED",
      "Project access is unavailable.",
    );
  const permission =
    row.meta &&
    typeof row.meta === "object" &&
    typeof row.meta.permission === "string"
      ? row.meta.permission
      : row.role === "admin"
        ? "admin"
        : row.role === "viewer"
          ? "read"
          : null;
  const accessMode = evaluateProjectReadAccess({
    currentCompanyId: Number(row.company_id),
    boundCompanyId:
      row.bound_company_id == null ? null : Number(row.bound_company_id),
    role: row.role == null ? null : String(row.role),
    status: row.status == null ? null : String(row.status),
    permission,
    isSuperAdmin: row.is_super_admin === true,
    superAdminAccess: input.superAdminAccess,
    superAdminReason: input.superAdminReason,
  });
  if (accessMode)
    return {
      companyId: Number(row.company_id),
      isSuperAdmin: row.is_super_admin === true,
      accessMode,
    };
  throw new CoordinatorRegisterError(
    403,
    "PROJECT_ACCESS_DENIED",
    "Active project read access is required.",
  );
}

export async function authorizeCoordinatorModule(
  module: CoordinatorActionModule,
  input: { access: AccessContext; userId: number; projectId: number },
): Promise<{ allowed: boolean; code: string }> {
  if (input.access.accessMode === "super_admin_explicit")
    return { allowed: true, code: "SUPER_ADMIN_EXACT_PROJECT" };
  const featureKey =
    module === "lens"
      ? "navisworks.lens"
      : module === "rfi"
        ? "rfi.core"
        : null;
  if (!featureKey) return { allowed: true, code: "PROJECT_READ" };
  const decision = await resolveEffectiveEntitlement({
    featureKey,
    userId: input.userId,
    companyId: input.access.companyId,
    projectId: input.projectId,
  });
  return { allowed: decision.decision === "allow", code: decision.code };
}

function sharedQuery(baseSql: string): string {
  return `WITH source_rows AS (${baseSql}), filtered AS (
    SELECT * FROM source_rows WHERE
      ($2::text IS NULL OR lower(concat_ws(' ',display_identifier,title,responsible_company,responsible_person,floor,discipline)) LIKE $2)
      AND ($3::text[] IS NULL OR lower(original_status)=ANY($3) OR lower(presentation_status)=ANY($3))
      AND ($4::text[] IS NULL OR lower(original_status)=ANY($4))
      AND ($5::text[] IS NULL OR lower(presentation_status)=ANY($5))
      AND ($6::text IS NULL OR lower(responsible_company)=lower($6))
      AND ($7::text IS NULL OR lower(responsible_person)=lower($7))
      AND ($8::text IS NULL OR lower(floor)=lower($8))
      AND ($9::text IS NULL OR lower(discipline)=lower($9))
      AND ($10::text='all' OR ($10='no_due_date' AND due_at IS NULL)
        OR ($10='overdue' AND due_at::date < $11::date)
        OR ($10='due_this_week' AND due_at::date >= $11::date AND due_at::date <= $12::date)
        OR ($10='upcoming' AND due_at::date > $12::date))
      AND ($13::date IS NULL OR due_at::date >= $13::date)
      AND ($14::date IS NULL OR due_at::date <= $14::date)
      AND (NOT $15::boolean OR due_at::date < $11::date)
      AND ($16::int IS NULL OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(related->'meetings','[]'::jsonb)) rel WHERE (rel->>'id')::int=$16))
      AND ($18::text[] IS NULL OR source_module<>'lens' OR lower(original_status)=ANY($18))
      AND ($19::text<>'my_items' OR responsible_user_id=$20::int)
      AND ($19::text<>'this_week' OR (due_at::date >= $11::date AND due_at::date <= $12::date))
      AND ($19::text<>'overdue' OR due_at::date < $11::date)
      AND ($19::text<>'next_coordination_meeting' OR ($17::int IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(related->'meetings','[]'::jsonb)) rel WHERE (rel->>'id')::int=$17)))
  ), selected AS (
    SELECT * FROM filtered ORDER BY
      CASE WHEN due_at::date < $11::date THEN 0 WHEN due_at::date <= $12::date THEN 1 WHEN due_at IS NULL THEN 3 ELSE 2 END,
      due_at ASC NULLS LAST, source_updated_at DESC NULLS LAST, source_id ASC LIMIT $21
  ) SELECT
    (SELECT count(*)::int FROM filtered) AS count,
    COALESCE((SELECT jsonb_agg(to_jsonb(selected) ORDER BY
      CASE WHEN due_at::date < $11::date THEN 0 WHEN due_at::date <= $12::date THEN 1 WHEN due_at IS NULL THEN 3 ELSE 2 END,
      due_at ASC NULLS LAST, source_updated_at DESC NULLS LAST, source_id ASC) FROM selected),'[]'::jsonb) AS rows,
    COALESCE((SELECT jsonb_object_agg(presentation_status,status_count) FROM
      (SELECT presentation_status,count(*)::int AS status_count FROM filtered GROUP BY presentation_status) status_groups),'{}'::jsonb) AS status_counts,
    COALESCE((SELECT jsonb_object_agg(deadline_state,deadline_count) FROM
      (SELECT
        CASE WHEN due_at IS NULL THEN 'no_due_date'
          WHEN due_at::date < $11::date THEN 'overdue'
          WHEN due_at::date <= $12::date THEN 'due_this_week'
          ELSE 'upcoming' END AS deadline_state,
        count(*)::int AS deadline_count
       FROM filtered GROUP BY deadline_state) deadline_groups),'{}'::jsonb) AS deadline_counts`;
}

function queryParams(
  projectId: number,
  query: RegisterQuery,
  now: Date,
  userId: number,
  nextMeetingId: number | null,
): unknown[] {
  const today = calendarDateInZone(now, query.timezone);
  return [
    projectId,
    query.search ? `%${query.search.toLowerCase()}%` : null,
    query.statuses.length ? query.statuses : null,
    query.originalStatuses.length ? query.originalStatuses : null,
    query.presentationStatuses.length ? query.presentationStatuses : null,
    query.responsibleCompany,
    query.responsiblePerson,
    query.floor,
    query.discipline,
    query.deadline,
    today,
    addCalendarDays(today, 7),
    query.dueFrom,
    query.dueTo,
    query.overdueOnly,
    query.meetingId,
    nextMeetingId,
    query.lensStatuses.length ? query.lensStatuses : null,
    query.builtInView,
    userId,
    query.page * query.pageSize,
  ];
}

const lensIdentitySql = (
  alias: string,
) => `jsonb_strip_nulls(jsonb_build_object(
  'serverId',${alias}.id,'displayId',${alias}.display_id,'viewpointId',${alias}.viewpoint_id,
  'navisworksGuid',${alias}.navisworks_guid,'bimlogPhysicalId',${alias}.bimlog_physical_id,
  'lifecycleStatus',${alias}.lifecycle_status,'revisionNumber',${alias}.revision_number,
  'supersedesId',${alias}.supersedes_id,'issueGroupId',${alias}.issue_group_id,
  'sourceProjectId',${alias}.source_project_id,'sourceServerId',${alias}.source_server_id,
  'sourcePhysicalId',${alias}.source_physical_id,'sourceDisplayLabel',${alias}.source_display_label,
  'importedLineageStatus',${alias}.imported_lineage_status))`;

const relationArray = (sql: string) => `COALESCE((${sql}),'[]'::jsonb)`;

const SOURCE_SQL: Record<CoordinatorActionModule, string> = {
  lens: `SELECT 'lens'::text source_module,l.id source_id,l.project_id,COALESCE(l.display_id,l.viewpoint_id) display_identifier,
    l.status original_status,l.status presentation_status,COALESCE(NULLIF(l.note,''),NULLIF(l.open_items,''),l.display_id,l.viewpoint_id) title,
    l.responsible_company,NULL::text responsible_person,NULL::int responsible_user_id,NULL::text due_at,
    l.floor,l.trade discipline,CASE WHEN l.priority IS NULL THEN NULL ELSE 'P'||l.priority::text END priority,l.updated_at source_updated_at,
    '/projects/'||l.project_id||'/clash-reports?view=lens&viewpoint='||l.id internal_link,
    jsonb_build_object('meetings','[]'::jsonb,'schedule','[]'::jsonb,'lens',${lensIdentitySql("l")}) related
    FROM lens_viewpoints l WHERE l.project_id=$1 AND l.lifecycle_status='active' AND lower(l.status) IN ('open','follow_up','waiting_design')`,
  rfi: `SELECT 'rfi'::text source_module,r.id source_id,r.project_id,r.number display_identifier,r.status original_status,
    CASE lower(r.status) WHEN 'in_review' THEN 'in_review' ELSE lower(r.status) END presentation_status,r.subject title,
    COALESCE(r.submitted_to_company,ac.name) responsible_company,COALESCE(au.full_name,r.submitted_to_person,r.ball_in_court) responsible_person,
    r.assigned_to_id responsible_user_id,COALESCE(r.date_required,r.due_date)::date::text due_at,r.location_description floor,r.rfi_type discipline,r.priority,
    r.updated_at source_updated_at,'/projects/'||r.project_id||'/rfis?rfi='||r.id internal_link,
    jsonb_build_object('meetings',${relationArray(`SELECT jsonb_agg(jsonb_build_object('id',x.meeting_id,'internalLink','/projects/'||r.project_id||'/meetings?meeting='||x.meeting_id) ORDER BY x.meeting_id) FROM (SELECT meeting_id FROM meeting_rfi_links WHERE project_id=r.project_id AND rfi_id=r.id ORDER BY meeting_id LIMIT 20) x`)},
      'schedule',${relationArray(`SELECT jsonb_agg(jsonb_build_object('id',x.id,'internalLink','/projects/'||r.project_id||'/schedule?task='||x.id) ORDER BY x.id) FROM (SELECT id FROM project_milestones WHERE project_id=r.project_id AND linked_module='rfi' AND linked_id=r.id ORDER BY id LIMIT 20) x`)},
      'lens',CASE WHEN lv.id IS NULL THEN NULL ELSE ${lensIdentitySql("lv")} END) related
    FROM rfis r LEFT JOIN users au ON au.id=r.assigned_to_id LEFT JOIN companies ac ON ac.id=au.company_id
    LEFT JOIN LATERAL (SELECT l.* FROM lens_viewpoints l WHERE l.project_id=r.project_id AND l.lifecycle_status='active' AND r.source_viewpoint_id IS NOT NULL
      AND (l.display_id=r.source_viewpoint_id OR l.viewpoint_id=r.source_viewpoint_id) ORDER BY (l.display_id=r.source_viewpoint_id) DESC,l.revision_number DESC,l.id DESC LIMIT 1) lv ON true
    WHERE r.project_id=$1 AND r.deleted_at IS NULL AND lower(r.status) IN ('open','pending','in_review')`,
  submittal: `SELECT 'submittal'::text source_module,s.id source_id,s.project_id,s.number display_identifier,s.status original_status,
    CASE lower(COALESCE(NULLIF(s.review_decision,''),s.status)) WHEN 'under_review' THEN 'in_review' WHEN 'revise_resubmit' THEN 'action_required'
      WHEN 'rejected' THEN 'action_required' ELSE lower(COALESCE(NULLIF(s.review_decision,''),s.status)) END presentation_status,s.title,
    COALESCE(s.responsible_company,s.submitted_to_company,ac.name) responsible_company,
    COALESCE(au.full_name,s.submitted_to_person,s.ball_in_court) responsible_person,s.assigned_to_id responsible_user_id,
    COALESCE(s.date_required,s.due_date)::date::text due_at,s.floor,s.trade discipline,NULL::text priority,s.updated_at source_updated_at,
    '/projects/'||s.project_id||'/submittals?submittal='||s.id internal_link,
    jsonb_build_object('meetings',${relationArray(`SELECT jsonb_agg(jsonb_build_object('id',x.meeting_id,'internalLink','/projects/'||s.project_id||'/meetings?meeting='||x.meeting_id) ORDER BY x.meeting_id) FROM (SELECT meeting_id FROM meeting_submittal_links WHERE project_id=s.project_id AND submittal_id=s.id ORDER BY meeting_id LIMIT 20) x`)},
      'schedule',${relationArray(`SELECT jsonb_agg(jsonb_build_object('id',x.id,'internalLink','/projects/'||s.project_id||'/schedule?task='||x.id) ORDER BY x.id) FROM (SELECT id FROM project_milestones WHERE project_id=s.project_id AND linked_module='submittal' AND linked_id=s.id ORDER BY id LIMIT 20) x`)},'lens',NULL) related
    FROM submittals s LEFT JOIN users au ON au.id=s.assigned_to_id LEFT JOIN companies ac ON ac.id=au.company_id
    WHERE s.project_id=$1 AND s.deleted_at IS NULL AND lower(COALESCE(NULLIF(s.review_decision,''),s.status)) IN ('pending','submitted','under_review','revise_resubmit','rejected')`,
  meeting: `SELECT 'meeting'::text source_module,a.id source_id,a.project_id,a.id::text display_identifier,a.status original_status,
    CASE lower(a.status) WHEN 'in_progress' THEN 'in_review' WHEN 'blocked' THEN 'action_required' ELSE lower(a.status) END presentation_status,
    a.description title,ac.name responsible_company,COALESCE(au.full_name,a.assigned_to_name) responsible_person,a.assigned_to_id responsible_user_id,
    a.due_date::date::text due_at,NULL::text floor,NULL::text discipline,NULL::text priority,a.updated_at source_updated_at,
    '/projects/'||a.project_id||'/meetings?meeting='||a.meeting_id||'&action='||a.id internal_link,
    jsonb_build_object('meetings',CASE WHEN a.meeting_id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('id',a.meeting_id,'internalLink','/projects/'||a.project_id||'/meetings?meeting='||a.meeting_id)) END,
      'schedule','[]'::jsonb,'lens',NULL) related
    FROM action_items a LEFT JOIN meeting_minutes m ON m.id=a.meeting_id AND m.project_id=a.project_id
    LEFT JOIN users au ON au.id=a.assigned_to_id LEFT JOIN companies ac ON ac.id=au.company_id
    WHERE a.project_id=$1 AND lower(a.status) NOT IN ('completed','cancelled') AND (a.meeting_id IS NULL OR (m.id IS NOT NULL AND m.deleted_at IS NULL))`,
  schedule: `SELECT 'schedule'::text source_module,m.id source_id,m.project_id,m.id::text display_identifier,m.status original_status,
    CASE lower(m.status) WHEN 'in_progress' THEN 'in_review' WHEN 'delayed' THEN 'action_required' ELSE lower(m.status) END presentation_status,
    m.title,m.responsible_company,au.full_name responsible_person,m.assigned_user_id responsible_user_id,m.due_date::date::text due_at,m.building_level floor,m.trade discipline,
    NULL::text priority,m.updated_at source_updated_at,'/projects/'||m.project_id||'/schedule?task='||m.id internal_link,
    jsonb_build_object('meetings',${relationArray(`SELECT jsonb_agg(jsonb_build_object('id',x.meeting_id,'internalLink','/projects/'||m.project_id||'/meetings?meeting='||x.meeting_id) ORDER BY x.meeting_id) FROM (SELECT meeting_id FROM meeting_schedule_task_links WHERE project_id=m.project_id AND milestone_id=m.id UNION SELECT m.linked_id WHERE m.linked_module='meeting' AND m.linked_id IS NOT NULL ORDER BY meeting_id LIMIT 20) x`)},
      'schedule',jsonb_build_array(jsonb_build_object('id',m.id,'internalLink','/projects/'||m.project_id||'/schedule?task='||m.id)),'lens',NULL) related
    FROM project_milestones m LEFT JOIN users au ON au.id=m.assigned_user_id
    WHERE m.project_id=$1 AND lower(m.status) NOT IN ('completed','closed','resolved','approved','approved_as_noted','cancelled')`,
};

async function loadSource(
  module: CoordinatorActionModule,
  projectId: number,
  query: RegisterQuery,
  now: Date,
  userId: number,
  nextMeetingId: number | null,
): Promise<AdapterPayload> {
  const result = await pool.query(
    sharedQuery(SOURCE_SQL[module]),
    queryParams(projectId, query, now, userId, nextMeetingId),
  );
  const row = result.rows[0] ?? {};
  return {
    count: Number(row.count ?? 0),
    rows: Array.isArray(row.rows) ? row.rows : [],
    statusCounts:
      row.status_counts && typeof row.status_counts === "object"
        ? row.status_counts
        : {},
    deadlineCounts:
      row.deadline_counts && typeof row.deadline_counts === "object"
        ? row.deadline_counts
        : {},
  };
}

function iso(value: unknown): string | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function dueDateValue(value: unknown): string | null {
  if (value == null || value === "") return null;
  const text = value instanceof Date ? value.toISOString() : String(value);
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return match?.[1] ?? null;
}

function toItem(
  row: Record<string, any>,
  timezone: string,
): CoordinatorActionItem {
  const sourceModule = String(row.source_module) as CoordinatorActionModule;
  const sourceId = Number(row.source_id);
  const dueAt = dueDateValue(row.due_at);
  const related =
    row.related && typeof row.related === "object" ? row.related : {};
  return {
    key: `${sourceModule}:${sourceId}`,
    sourceModule,
    sourceId,
    projectId: Number(row.project_id),
    displayIdentifier: String(row.display_identifier ?? sourceId),
    originalStatus: String(row.original_status ?? ""),
    presentationStatus: String(
      row.presentation_status ?? row.original_status ?? "",
    ),
    title: String(row.title ?? row.display_identifier ?? sourceId),
    responsibility: {
      company:
        row.responsible_company == null
          ? null
          : String(row.responsible_company),
      person:
        row.responsible_person == null ? null : String(row.responsible_person),
      userId:
        row.responsible_user_id == null
          ? null
          : Number(row.responsible_user_id),
    },
    dueAt,
    deadlineState: deadlineState(dueAt, timezone),
    floor: row.floor == null ? null : String(row.floor),
    discipline: row.discipline == null ? null : String(row.discipline),
    priority: row.priority == null ? null : String(row.priority),
    sourceUpdatedAt: iso(row.source_updated_at),
    internalLink: String(row.internal_link),
    related: {
      meetings: Array.isArray(related.meetings) ? related.meetings : [],
      schedule: Array.isArray(related.schedule) ? related.schedule : [],
      lens:
        related.lens && typeof related.lens === "object"
          ? (related.lens as LensIdentity)
          : null,
    },
  };
}

export async function loadCoordinatorActionRegister(input: {
  userId: number;
  projectId: number;
  query: RegisterQuery;
  superAdminAccess?: string;
  superAdminReason?: string;
  now?: Date;
}) {
  if (!Number.isSafeInteger(input.projectId) || input.projectId <= 0)
    throw new CoordinatorRegisterError(
      400,
      "PROJECT_INVALID",
      "projectId is invalid.",
    );
  const now = input.now ?? new Date();
  const access = await authorizeCoordinatorProject(input);
  let nextMeetingId: number | null = null;
  let meetingContext: {
    status: "not_requested" | "ok" | "none" | "failed";
    id: number | null;
    title: string | null;
    meetingAt: string | null;
  } = { status: "not_requested", id: null, title: null, meetingAt: null };
  if (input.query.builtInView === "next_coordination_meeting") {
    try {
      const result = await pool.query(
        `SELECT id,title,meeting_date FROM meeting_minutes
         WHERE project_id=$1 AND deleted_at IS NULL AND meeting_date >= $2
         ORDER BY meeting_date ASC,id ASC LIMIT 1`,
        [input.projectId, now],
      );
      const row = result.rows[0];
      if (row) {
        nextMeetingId = Number(row.id);
        meetingContext = {
          status: "ok",
          id: nextMeetingId,
          title: String(row.title),
          meetingAt: iso(row.meeting_date),
        };
      } else {
        meetingContext = { status: "none", id: null, title: null, meetingAt: null };
      }
    } catch {
      meetingContext = { status: "failed", id: null, title: null, meetingAt: null };
    }
  }
  const requested = new Set(input.query.modules);
  const states = new Map<CoordinatorActionModule, SourceState>(
    COORDINATOR_ACTION_MODULES.map((module) => [
      module,
      {
        module,
        status: requested.has(module) ? "failed" : "not_requested",
        count: requested.has(module) ? null : 0,
      },
    ]),
  );
  const payloads = new Map<CoordinatorActionModule, AdapterPayload>();

  await Promise.all(
    COORDINATOR_ACTION_MODULES.map(async (module) => {
      if (!requested.has(module)) return;
      try {
        const authorization = await authorizeCoordinatorModule(module, {
          access,
          userId: input.userId,
          projectId: input.projectId,
        });
        if (!authorization.allowed) {
          states.set(module, {
            module,
            status: "unauthorized",
            count: null,
            code: authorization.code,
          });
          return;
        }
        const payload = await loadSource(
          module,
          input.projectId,
          input.query,
          now,
          input.userId,
          nextMeetingId,
        );
        payloads.set(module, payload);
        states.set(module, {
          module,
          status: "ok",
          count: payload.count,
          code: authorization.code,
        });
      } catch {
        states.set(module, {
          module,
          status: "failed",
          count: null,
          code: "SOURCE_UNAVAILABLE",
        });
      }
    }),
  );

  const items: CoordinatorActionItem[] = [];
  const seen = new Set<string>();
  const statusCounts: Record<string, number> = {};
  const deadlineCounts: Record<DeadlineState, number> = {
    overdue: 0,
    due_this_week: 0,
    upcoming: 0,
    no_due_date: 0,
  };
  for (const module of COORDINATOR_ACTION_MODULES) {
    const payload = payloads.get(module);
    if (!payload) continue;
    const moduleItems: CoordinatorActionItem[] = [];
    let integrityFailed = false;
    for (const raw of payload.rows) {
      const item = toItem(raw, input.query.timezone);
      if (
        item.projectId !== input.projectId ||
        item.sourceModule !== module ||
        seen.has(item.key)
      ) {
        payloads.delete(module);
        states.set(module, {
          module,
          status: "failed",
          count: null,
          code: "SOURCE_INTEGRITY_FAILED",
        });
        integrityFailed = true;
        break;
      }
      seen.add(item.key);
      moduleItems.push(item);
    }
    if (integrityFailed) {
      for (const item of moduleItems) seen.delete(item.key);
      continue;
    }
    for (const [status, count] of Object.entries(payload.statusCounts))
      statusCounts[status] = (statusCounts[status] ?? 0) + Number(count);
    for (const [state, count] of Object.entries(payload.deadlineCounts)) {
      if (state in deadlineCounts)
        deadlineCounts[state as DeadlineState] += Number(count);
    }
    items.push(...moduleItems);
  }
  items.sort(compareCoordinatorActions);
  const offset = (input.query.page - 1) * input.query.pageSize;
  const pageItems = items.slice(offset, offset + input.query.pageSize);
  const sourceStates = COORDINATOR_ACTION_MODULES.map(
    (module) => states.get(module)!,
  );
  const total = sourceStates.reduce(
    (sum, state) => sum + (state.status === "ok" ? (state.count ?? 0) : 0),
    0,
  );
  const partial = sourceStates.some(
    (state) => requested.has(state.module) && state.status !== "ok",
  ) || meetingContext.status === "failed";
  return {
    items: pageItems,
    page: input.query.page,
    pageSize: input.query.pageSize,
    total,
    totalPages: Math.ceil(total / input.query.pageSize),
    counts: {
      complete: !partial,
      byModule: Object.fromEntries(
        sourceStates.map((state) => [
          state.module,
          state.status === "ok" ? state.count : null,
        ]),
      ),
      byPresentationStatus: statusCounts,
      byDeadlineState: deadlineCounts,
      context: {
        actionable: total,
        overdue: deadlineCounts.overdue,
        dueSoon: deadlineCounts.due_this_week,
        blocked:
          Number(statusCounts.blocked ?? 0) +
          Number(statusCounts.action_required ?? 0),
      },
      definitions: COORDINATOR_CONTEXT_METRICS,
    },
    sources: sourceStates,
    partial,
    timezone: input.query.timezone,
    generatedAt: now.toISOString(),
    builtInView: input.query.builtInView,
    meetingContext,
    readOnly: true,
    canonicalModulesRemainAuthoritative: true,
    accessMode: access.accessMode,
    aiUsed: false,
  };
}
