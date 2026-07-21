import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  compareCoordinatorActions,
  deadlineState,
  evaluateProjectReadAccess,
  parseRegisterQuery,
  type CoordinatorActionItem,
} from "../src/lib/coordinator-action-register";

type Result = { name: string; passed: boolean };
const results: Result[] = [];
const check = (name: string, fn: () => void) => {
  try {
    fn();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false });
    console.error(`[FAIL] ${name}`, error);
  }
};

const root = path.resolve(import.meta.dirname, "../../..");
const service = fs.readFileSync(
  path.join(
    root,
    "artifacts/api-server/src/lib/coordinator-action-register.ts",
  ),
  "utf8",
);
const route = fs.readFileSync(
  path.join(root, "artifacts/api-server/src/routes/coordinator-actions.ts"),
  "utf8",
);
const ui = fs.readFileSync(
  path.join(
    root,
    "artifacts/bimlog/src/pages/project/CoordinatorCommandCenter.tsx",
  ),
  "utf8",
);
const css = fs.readFileSync(
  path.join(root, "artifacts/bimlog/src/index.css"),
  "utf8",
);
const lensUi = fs.readFileSync(
  path.join(root, "artifacts/bimlog/src/pages/project/LensViewpointsView.tsx"),
  "utf8",
);
const meetingUi = fs.readFileSync(
  path.join(root, "artifacts/bimlog/src/pages/project/MeetingsTab.tsx"),
  "utf8",
);
const sourceSql = service.slice(
  service.indexOf("const SOURCE_SQL"),
  service.indexOf("async function loadSource"),
);

check("query.defaults_are_bounded", () => {
  const query = parseRegisterQuery({});
  assert.equal(query.page, 1);
  assert.equal(query.pageSize, 25);
  assert.deepEqual(query.modules, [
    "lens",
    "rfi",
    "submittal",
    "meeting",
    "schedule",
  ]);
});
check("query.page_limit", () =>
  assert.throws(() => parseRegisterQuery({ page: "101" }), /page must be/),
);
check("query.page_size_limit", () =>
  assert.throws(() => parseRegisterQuery({ pageSize: "51" }), /pageSize/),
);
check("query.module_allowlist", () =>
  assert.throws(
    () => parseRegisterQuery({ modules: "lens,clash" }),
    /filter value/,
  ),
);
check("query.invalid_timezone", () =>
  assert.throws(() => parseRegisterQuery({ timezone: "Not/AZone" }), /IANA/),
);
check("query.no_zero_fallback", () => {
  const query = parseRegisterQuery({
    modules: "lens",
    statuses: "follow_up",
    search: "no-match",
  });
  assert.deepEqual(query.modules, ["lens"]);
  assert.deepEqual(query.statuses, ["follow_up"]);
  assert.equal(query.search, "no-match");
});
check("deadline.timezone_overdue", () =>
  assert.equal(
    deadlineState(
      "2026-07-20",
      "America/New_York",
      new Date("2026-07-22T03:30:00Z"),
    ),
    "overdue",
  ),
);
check("deadline.timezone_due_today", () =>
  assert.equal(
    deadlineState(
      "2026-07-22",
      "America/New_York",
      new Date("2026-07-22T03:30:00Z"),
    ),
    "due_this_week",
  ),
);
check("deadline.no_date", () =>
  assert.equal(
    deadlineState(null, "America/New_York", new Date("2026-07-22T03:30:00Z")),
    "no_due_date",
  ),
);
check("deadline.sources_are_date_only", () => {
  assert.equal((sourceSql.match(/::date::text due_at/g) || []).length, 4);
  assert.match(sourceSql, /NULL::text due_at/);
});

const item = (
  overrides: Partial<CoordinatorActionItem>,
): CoordinatorActionItem => ({
  key: "lens:1",
  sourceModule: "lens",
  sourceId: 1,
  projectId: 99,
  displayIdentifier: "FI-001",
  originalStatus: "open",
  presentationStatus: "open",
  title: "Action",
  responsibility: { company: null, person: null, userId: null },
  dueAt: null,
  deadlineState: "no_due_date",
  floor: null,
  discipline: null,
  priority: null,
  sourceUpdatedAt: "2026-07-21T12:00:00Z",
  internalLink: "/projects/99/clash-reports?view=lens&viewpoint=1",
  related: { meetings: [], schedule: [], lens: null },
  ...overrides,
});
check("order.overdue_first", () => {
  const rows = [
    item({ key: "lens:1" }),
    item({
      key: "rfi:2",
      sourceModule: "rfi",
      sourceId: 2,
      deadlineState: "overdue",
      dueAt: "2026-07-20",
    }),
  ].sort(compareCoordinatorActions);
  assert.equal(rows[0].key, "rfi:2");
});
check("order.deterministic_source_tie_break", () => {
  const rows = [
    item({ key: "rfi:2", sourceModule: "rfi", sourceId: 2 }),
    item({ key: "lens:7", sourceId: 7 }),
  ].sort(compareCoordinatorActions);
  assert.equal(rows[0].key, "lens:7");
});
check("identity.source_key_unique", () => {
  const rows = [item({}), item({ key: "rfi:1", sourceModule: "rfi" })];
  assert.equal(new Set(rows.map((row) => row.key)).size, rows.length);
});

check("lens.current_lifecycle_only", () =>
  assert.match(sourceSql, /l\.lifecycle_status='active'/),
);
check("lens.actionable_statuses_exact", () =>
  assert.match(sourceSql, /'open','follow_up','waiting_design'/),
);
check("lens.identity_server_display_physical_lineage", () => {
  for (const field of [
    "serverId",
    "displayId",
    "viewpointId",
    "navisworksGuid",
    "bimlogPhysicalId",
    "lifecycleStatus",
    "revisionNumber",
    "supersedesId",
    "issueGroupId",
    "sourceProjectId",
    "sourceServerId",
    "sourcePhysicalId",
    "importedLineageStatus",
  ])
    assert.ok(service.includes(`'${field}'`), field);
});
check("lens.no_clash_substitution", () => {
  assert.doesNotMatch(sourceSql, /\bFROM\s+clashes\b/i);
  assert.doesNotMatch(service, /clashesTable|clashReportsTable/);
});
check("eligibility.rfi_exact", () =>
  assert.match(
    sourceSql,
    /lower\(r\.status\) IN \('open','pending','in_review'\)/,
  ),
);
check("eligibility.submittal_exact", () =>
  assert.match(
    sourceSql,
    /'pending','submitted','under_review','revise_resubmit','rejected'/,
  ),
);
check("eligibility.meeting_actions", () =>
  assert.match(
    sourceSql,
    /lower\(a\.status\) NOT IN \('completed','cancelled'\)/,
  ),
);
check("eligibility.schedule_active", () =>
  assert.match(
    sourceSql,
    /lower\(m\.status\) NOT IN \('completed','closed','resolved','approved','approved_as_noted','cancelled'\)/,
  ),
);
check("read_only.no_mutating_sql", () =>
  assert.doesNotMatch(
    sourceSql,
    /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b/i,
  ),
);
check("tenant.every_source_project_bound", () =>
  assert.equal((sourceSql.match(/project_id=\$1/g) || []).length, 5),
);
check("tenant.current_binding_matches_authenticated_company", () => {
  assert.match(service, /project_company_binding_versions/);
  assert.equal(
    evaluateProjectReadAccess({
      currentCompanyId: 10,
      boundCompanyId: 11,
      role: "project_admin",
      status: "active",
      permission: "admin",
      isSuperAdmin: false,
    }),
    null,
  );
  assert.equal(
    evaluateProjectReadAccess({
      currentCompanyId: 10,
      boundCompanyId: 10,
      role: "project_admin",
      status: "active",
      permission: "admin",
      isSuperAdmin: false,
    }),
    "member",
  );
});
check("tenant.active_membership_and_read_authority", () => {
  assert.match(service, /input\.status === "active"/);
  assert.match(service, /hasScopedAuthority\(mapping, \["project:read"\]\)/);
  assert.equal(
    evaluateProjectReadAccess({
      currentCompanyId: 10,
      boundCompanyId: 10,
      role: "project_admin",
      status: "inactive",
      permission: "admin",
      isSuperAdmin: false,
    }),
    null,
  );
});
check("super_admin.explicit_exact_project_rule", () => {
  assert.ok(route.includes("x-bimlog-super-admin-access"));
  assert.ok(
    service.includes("project-read") &&
      service.includes("super_admin_explicit"),
  );
  assert.equal(
    evaluateProjectReadAccess({
      currentCompanyId: 10,
      boundCompanyId: 11,
      role: null,
      status: null,
      permission: null,
      isSuperAdmin: true,
      superAdminAccess: "project-read",
      superAdminReason: "Review exact project 44",
    }),
    "super_admin_explicit",
  );
  assert.equal(
    evaluateProjectReadAccess({
      currentCompanyId: 10,
      boundCompanyId: 11,
      role: null,
      status: null,
      permission: null,
      isSuperAdmin: true,
      superAdminAccess: "project-read",
      superAdminReason: "short",
    }),
    null,
  );
});
check("module_authorization.rechecked", () => {
  assert.ok(
    service.includes("navisworks.lens") && service.includes("rfi.core"),
  );
  assert.match(service, /resolveEffectiveEntitlement/);
});
check("partial_failure.visible_contract", () => {
  assert.ok(
    service.includes("SOURCE_UNAVAILABLE") && service.includes("partial"),
  );
  assert.ok(
    ui.includes("Counts are partial") &&
      ui.includes("Los conteos son parciales"),
  );
});
check("partial_failure.integrity_counts_excluded", () => {
  assert.match(service, /if \(integrityFailed\)/);
  assert.ok(
    service.indexOf("if (integrityFailed)") <
      service.indexOf("Object.entries(payload.statusCounts)"),
  );
});
check("pagination.fixed_query_count", () => {
  assert.match(service, /Promise\.all\(\s*COORDINATOR_ACTION_MODULES\.map/);
  assert.match(service, /query\.page \* query\.pageSize/);
});
check("privacy.safe_projection", () => {
  for (const forbidden of [
    "screenshot_url",
    "attachments_json",
    "storage_path",
    "provider_url",
    "telegram_id",
    "api_token",
    "password_hash",
  ])
    assert.doesNotMatch(sourceSql, new RegExp(forbidden, "i"));
});
check("direct_links.authoritative", () => {
  for (const link of [
    "view=lens&viewpoint=",
    "/rfis?rfi=",
    "/submittals?submittal=",
    "/meetings?meeting=",
    "/schedule?task=",
  ])
    assert.ok(sourceSql.includes(link), link);
  assert.ok(lensUi.includes("data-lens-viewpoint-id"));
  assert.ok(meetingUi.includes("data-meeting-action-id"));
});
check("ui.bilingual_390px", () => {
  assert.ok(
    ui.includes("Coordinator Command Center") &&
      ui.includes("Centro de Control de Coordinación"),
  );
  for (const label of ["Seguimiento", "Esperando Diseño", "Acción Requerida"])
    assert.ok(ui.includes(label), label);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /overflow: hidden/);
});
check("ui.honest_empty_and_retry", () => {
  assert.ok(
    ui.includes("does not fall back to all records") &&
      ui.includes("no vuelve a mostrar todos los registros"),
  );
  assert.ok(ui.includes("Retry") && ui.includes("Reintentar"));
});
check("zero_ai.no_usage_path", () => {
  assert.doesNotMatch(
    `${service}\n${route}\n${ui}`,
    /getAnthropicClientForUser|OpenAI\(|anthropic\.messages|ai-usage/,
  );
  assert.ok(
    service.includes("aiUsed: false") && ui.includes("no AI use or charges"),
  );
});

const failed = results.filter((result) => !result.passed);
console.log(
  JSON.stringify(
    {
      suite: "coordinator-action-register",
      passed: results.length - failed.length,
      failed: failed.length,
      results,
    },
    null,
    2,
  ),
);
if (failed.length) process.exit(1);
