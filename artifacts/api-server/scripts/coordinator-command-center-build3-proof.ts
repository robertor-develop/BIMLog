import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import express from "express";

if (!process.env.PROD_DATABASE_URL)
  throw new Error("Load the isolated local test environment first.");
const databaseUrl = new URL(process.env.PROD_DATABASE_URL);
if (
  !["127.0.0.1", "localhost", "::1"].includes(databaseUrl.hostname) ||
  databaseUrl.port !== "55432" ||
  databaseUrl.pathname.slice(1) !== "bimlog_rfi_test"
)
  throw new Error("Build 3 proof requires the isolated loopback database.");
process.env.JWT_SECRET ||= "coordinator-build3-local-proof-only";

const [
  { pool },
  { ensureCoordinatorBulkActionSchema },
  { signToken },
  { default: coordinatorRouter },
  { startFeatureCatalogMigration },
  { startFeaturePolicyMigration },
] = await Promise.all([
  import("@workspace/db"),
  import("../src/lib/coordinator-bulk-action-migration"),
  import("../src/middlewares/auth"),
  import("../src/routes/coordinator-actions"),
  import("../src/lib/feature-catalog-migration"),
  import("../src/lib/feature-policy-migration"),
]);

const root = path.resolve(import.meta.dirname, "../../..");
const service = fs.readFileSync(
  path.join(root, "artifacts/api-server/src/lib/coordinator-bulk-actions.ts"),
  "utf8",
);
const sharedLinks = fs.readFileSync(
  path.join(root, "artifacts/api-server/src/lib/meeting-canonical-links.ts"),
  "utf8",
);
const meetingRoute = fs.readFileSync(
  path.join(root, "artifacts/api-server/src/routes/meeting_minutes.ts"),
  "utf8",
);
const migration = fs.readFileSync(
  path.join(root, "artifacts/api-server/src/lib/coordinator-bulk-action-migration.ts"),
  "utf8",
);
const ui = fs.readFileSync(
  path.join(root, "artifacts/bimlog/src/pages/project/CoordinatorBulkActions.tsx"),
  "utf8",
);
const commandCenter = fs.readFileSync(
  path.join(root, "artifacts/bimlog/src/pages/project/CoordinatorCommandCenter.tsx"),
  "utf8",
);
const css = fs.readFileSync(
  path.join(root, "artifacts/bimlog/src/index.css"),
  "utf8",
);

const results: Array<{ name: string; detail: string }> = [];
const check = (name: string, condition: unknown, detail: string) => {
  assert.ok(condition, name);
  results.push({ name, detail });
};
const marker = `ccc-build3-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const ids = {
  companies: [] as number[],
  users: [] as number[],
  projects: [] as number[],
  meetings: [] as number[],
  rfis: [] as number[],
  submittals: [] as number[],
};

await ensureCoordinatorBulkActionSchema();
await ensureCoordinatorBulkActionSchema();
await startFeaturePolicyMigration();
await startFeatureCatalogMigration();
check(
  "migration.additive_restart_safe",
  !/\b(?:DROP|TRUNCATE)\b/i.test(migration),
  "schema ensured twice; no destructive DDL",
);
check(
  "contract.shared_canonical_links",
  meetingRoute.includes('from "../lib/meeting-canonical-links"') &&
    service.includes('from "./meeting-canonical-links"') &&
    sharedLinks.includes("meetingRfiLinksTable") &&
    sharedLinks.includes("meetingSubmittalLinksTable"),
  "Meeting and Coordinator routes share the accepted canonical link implementation",
);
check(
  "contract.lens_navigation_only_no_clash",
  service.includes("Lens Viewpoints remain navigation-only") &&
    !/clashesTable|clashReportsTable|FROM\s+clashes/i.test(service),
  "Lens is explicitly unsupported for mutation; Clash data is absent",
);
check(
  "contract.transactional_controls",
  service.includes("pg_advisory_xact_lock") &&
    service.includes("projectCompanyBindingVersionsTable") &&
    service.includes("project:write") &&
    service.includes("resolveEffectiveEntitlement") &&
    service.includes("confirmed !== true"),
  "tenant, active membership, scoped write, entitlement, lock, and confirmation controls are present",
);
check(
  "contract.zero_ai_private_payload",
  !/OpenAI\(|anthropic\.messages|getAnthropicClientForUser|ai_usage|telegram|storage_path|provider_url|database_url/i.test(
    `${service}\n${ui}`,
  ),
  "bulk path has no AI, notification, provider, storage, or credential behavior",
);
check(
  "ui.bilingual_390_and_m4",
  ui.includes("Acciones masivas controladas") &&
    ui.includes("Flujo aceptado M4 del Cronograma") &&
    ui.includes("Confirmo agregar") &&
    commandCenter.includes("Select all actions on this page") &&
    /@media \(max-width: 390px\)[\s\S]*\.ccc-bulk-dialog/.test(css),
  "desktop/Spanish controls, confirmations, multi-select, and exact 390px rules are present",
);

const app = express();
app.use(express.json({ limit: "32kb" }));
app.use("/api/v1", coordinatorRouter);
const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.equal(typeof address, "object");
const baseUrl = `http://127.0.0.1:${address!.port}/api/v1`;

async function api(
  token: string | null,
  projectId: number,
  suffix: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(`${baseUrl}/projects/${projectId}/${suffix}`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

const exact = (value: unknown) => new Date(String(value)).toISOString();

try {
  const companyA = await pool.query<{ id: number }>(
    "INSERT INTO companies(name) VALUES($1) RETURNING id",
    [`${marker}-company-a`],
  );
  const companyB = await pool.query<{ id: number }>(
    "INSERT INTO companies(name) VALUES($1) RETURNING id",
    [`${marker}-company-b`],
  );
  ids.companies.push(companyA.rows[0].id, companyB.rows[0].id);
  const makeUser = async (label: string, companyId: number) => {
    const user = await pool.query<{
      id: number;
      email: string;
      full_name: string;
    }>(
      "INSERT INTO users(email,password_hash,full_name,company_id) VALUES($1,'proof',$2,$3) RETURNING id,email,full_name",
      [`${marker}-${label}@example.invalid`, `${marker} ${label}`, companyId],
    );
    ids.users.push(user.rows[0].id);
    return user.rows[0];
  };
  const writer = await makeUser("writer", companyA.rows[0].id);
  const reader = await makeUser("reader", companyA.rows[0].id);
  const outsider = await makeUser("outsider", companyB.rows[0].id);
  const projectA = await pool.query<{ id: number }>(
    "INSERT INTO projects(name,code,status,created_by_id) VALUES($1,$2,'active',$3) RETURNING id",
    [`${marker} A`, `${marker}-a`, writer.id],
  );
  const projectB = await pool.query<{ id: number }>(
    "INSERT INTO projects(name,code,status,created_by_id) VALUES($1,$2,'active',$3) RETURNING id",
    [`${marker} B`, `${marker}-b`, outsider.id],
  );
  ids.projects.push(projectA.rows[0].id, projectB.rows[0].id);
  const writeRole = await pool.query<{ value: string }>(
    "SELECT value FROM config_options WHERE category='member_role' AND meta->>'permission' IN ('admin','write') ORDER BY id LIMIT 1",
  );
  const readRole = await pool.query<{ value: string }>(
    "SELECT value FROM config_options WHERE category='member_role' AND meta->>'permission'='read' ORDER BY id LIMIT 1",
  );
  assert.ok(writeRole.rows[0]?.value && readRole.rows[0]?.value);
  await pool.query(
    "INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,$3,'active'),($1,$4,$5,'active'),($6,$7,$3,'active')",
    [
      projectA.rows[0].id,
      writer.id,
      writeRole.rows[0].value,
      reader.id,
      readRole.rows[0].value,
      projectB.rows[0].id,
      outsider.id,
    ],
  );
  await pool.query(
    `INSERT INTO project_company_binding_versions
      (id,project_id,company_id,version,bound_by_id,reason_code,explanation_en,explanation_es,audit_evidence)
     VALUES($1,$2,$3,1,$4,'BUILD3_PROOF','Build 3 proof binding','Vínculo de prueba Build 3','{}'),
       ($5,$6,$7,1,$8,'BUILD3_PROOF','Build 3 proof binding','Vínculo de prueba Build 3','{}')`,
    [
      crypto.randomUUID(),
      projectA.rows[0].id,
      companyA.rows[0].id,
      writer.id,
      crypto.randomUUID(),
      projectB.rows[0].id,
      companyB.rows[0].id,
      outsider.id,
    ],
  );
  const meetingA = await pool.query<{ id: number; updated_at: Date }>(
    "INSERT INTO meeting_minutes(project_id,title,meeting_date,created_by_id) VALUES($1,$2,'2026-08-05T14:00:00Z',$3) RETURNING id,updated_at",
    [projectA.rows[0].id, `${marker} Coordination`, writer.id],
  );
  const meetingB = await pool.query<{ id: number; updated_at: Date }>(
    "INSERT INTO meeting_minutes(project_id,title,meeting_date,created_by_id) VALUES($1,$2,'2026-08-06T14:00:00Z',$3) RETURNING id,updated_at",
    [projectB.rows[0].id, `${marker} Other`, outsider.id],
  );
  ids.meetings.push(meetingA.rows[0].id, meetingB.rows[0].id);
  const rfiA = await pool.query<{ id: number; updated_at: Date }>(
    "INSERT INTO rfis(project_id,number,subject,status,priority,created_by_id) VALUES($1,$2,$3,'open','normal',$4) RETURNING id,updated_at",
    [projectA.rows[0].id, `${marker}-RFI-1`, "Open coordination question", writer.id],
  );
  const rfiCross = await pool.query<{ id: number; updated_at: Date }>(
    "INSERT INTO rfis(project_id,number,subject,status,priority,created_by_id) VALUES($1,$2,$3,'open','normal',$4) RETURNING id,updated_at",
    [projectB.rows[0].id, `${marker}-RFI-X`, "Other tenant question", outsider.id],
  );
  ids.rfis.push(rfiA.rows[0].id, rfiCross.rows[0].id);
  const subA = await pool.query<{ id: number; updated_at: Date }>(
    `INSERT INTO submittals(project_id,number,title,status,submittal_type,submitted_by_id,floor,trade)
     VALUES($1,$2,$3,'under_review','shop_drawing',$4,'L1','Mechanical') RETURNING id,updated_at`,
    [projectA.rows[0].id, `${marker}-SUB-1`, "Duct shop drawings", writer.id],
  );
  const subStale = await pool.query<{ id: number; updated_at: Date }>(
    `INSERT INTO submittals(project_id,number,title,status,submittal_type,submitted_by_id)
     VALUES($1,$2,$3,'under_review','shop_drawing',$4) RETURNING id,updated_at`,
    [projectA.rows[0].id, `${marker}-SUB-2`, "Stale shop drawings", writer.id],
  );
  ids.submittals.push(subA.rows[0].id, subStale.rows[0].id);
  const timestampSql = `to_char(updated_at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS version`;
  const meetingVersion = await pool.query<{ version: string }>(
    `SELECT ${timestampSql} FROM meeting_minutes WHERE id=$1`,
    [meetingA.rows[0].id],
  );
  const [rfiVersion, rfiCrossVersion, subVersion, subStaleVersion] =
    await Promise.all([
      pool.query<{ version: string }>(`SELECT ${timestampSql} FROM rfis WHERE id=$1`, [rfiA.rows[0].id]),
      pool.query<{ version: string }>(`SELECT ${timestampSql} FROM rfis WHERE id=$1`, [rfiCross.rows[0].id]),
      pool.query<{ version: string }>(`SELECT ${timestampSql} FROM submittals WHERE id=$1`, [subA.rows[0].id]),
      pool.query<{ version: string }>(`SELECT ${timestampSql} FROM submittals WHERE id=$1`, [subStale.rows[0].id]),
    ]);

  const writerToken = signToken({
    userId: writer.id,
    email: writer.email,
    companyId: companyA.rows[0].id,
    fullName: writer.full_name,
    companyName: `${marker}-company-a`,
  });
  const readerToken = signToken({
    userId: reader.id,
    email: reader.email,
    companyId: companyA.rows[0].id,
    fullName: reader.full_name,
    companyName: `${marker}-company-a`,
  });
  const outsiderToken = signToken({
    userId: outsider.id,
    email: outsider.email,
    companyId: companyB.rows[0].id,
    fullName: outsider.full_name,
    companyName: `${marker}-company-b`,
  });
  const items = [
    { sourceModule: "rfi", sourceId: rfiA.rows[0].id, sourceUpdatedAt: exact(rfiVersion.rows[0].version) },
    { sourceModule: "submittal", sourceId: subA.rows[0].id, sourceUpdatedAt: exact(subVersion.rows[0].version) },
    { sourceModule: "lens", sourceId: 987654321, sourceUpdatedAt: null },
    { sourceModule: "meeting", sourceId: 987654322, sourceUpdatedAt: null },
    { sourceModule: "schedule", sourceId: 987654323, sourceUpdatedAt: null },
    { sourceModule: "rfi", sourceId: rfiCross.rows[0].id, sourceUpdatedAt: exact(rfiCrossVersion.rows[0].version) },
  ];
  const baseBody = {
    meetingId: meetingA.rows[0].id,
    expectedMeetingUpdatedAt: exact(meetingVersion.rows[0].version),
    items,
  };
  assert.equal(
    (await api(null, projectA.rows[0].id, "coordinator-actions/meeting-links/preview", baseBody)).status,
    401,
  );
  assert.equal(
    (await api(readerToken, projectA.rows[0].id, "coordinator-actions/meeting-links/preview", baseBody)).status,
    403,
  );
  assert.equal(
    (await api(outsiderToken, projectA.rows[0].id, "coordinator-actions/meeting-links/preview", baseBody)).status,
    403,
  );
  check("authorization.read_and_cross_tenant_denied", true, "unauthenticated, read-only, and cross-tenant callers denied");

  const preview = await api(
    writerToken,
    projectA.rows[0].id,
    "coordinator-actions/meeting-links/preview",
    baseBody,
  );
  assert.equal(preview.status, 200);
  assert.equal(preview.body.summary.added, 2);
  assert.equal(preview.body.summary.unsupported, 3);
  assert.equal(preview.body.summary.unauthorized, 1);
  assert.equal(preview.body.canonicalRecordsMutated, false);
  assert.equal(preview.body.lensMutated, false);
  assert.equal(preview.body.clashesQueried, false);
  check("preview.exact_supported_unsupported", true, "RFI/Submittal will add; Lens/Meeting/Schedule unsupported; cross-project RFI hidden");

  const noConfirmation = await api(
    writerToken,
    projectA.rows[0].id,
    "coordinator-actions/meeting-links/execute",
    { ...baseBody, idempotencyKey: `${marker}-no-confirm` },
  );
  assert.equal(noConfirmation.status, 409);
  const operationKey = `${marker}-execute`;
  const concurrent = await Promise.all(
    [1, 2, 3].map(() =>
      api(
        writerToken,
        projectA.rows[0].id,
        "coordinator-actions/meeting-links/execute",
        { ...baseBody, confirmed: true, idempotencyKey: operationKey },
      ),
    ),
  );
  assert.ok(concurrent.every((response) => [200, 201].includes(response.status)));
  assert.equal(concurrent.filter((response) => response.body.idempotent === false).length, 1);
  assert.equal(
    (await pool.query("SELECT count(*)::int count FROM meeting_rfi_links WHERE meeting_id=$1 AND rfi_id=$2", [meetingA.rows[0].id, rfiA.rows[0].id])).rows[0].count,
    1,
  );
  assert.equal(
    (await pool.query("SELECT count(*)::int count FROM meeting_submittal_links WHERE meeting_id=$1 AND submittal_id=$2", [meetingA.rows[0].id, subA.rows[0].id])).rows[0].count,
    1,
  );
  assert.equal(
    (await pool.query("SELECT count(*)::int count FROM meeting_rfi_links WHERE project_id=$1 AND rfi_id=$2", [projectA.rows[0].id, rfiCross.rows[0].id])).rows[0].count,
    0,
  );
  check("execute.confirmed_concurrent_convergence", true, "one receipt and one canonical link per supported item; no cross-project link");

  const retry = await api(
    writerToken,
    projectA.rows[0].id,
    "coordinator-actions/meeting-links/execute",
    { ...baseBody, confirmed: true, idempotencyKey: operationKey },
  );
  assert.equal(retry.status, 200);
  assert.equal(retry.body.idempotent, true);
  const conflict = await api(
    writerToken,
    projectA.rows[0].id,
    "coordinator-actions/meeting-links/execute",
    {
      ...baseBody,
      items: items.slice(0, 1),
      confirmed: true,
      idempotencyKey: operationKey,
    },
  );
  assert.equal(conflict.status, 409);
  const duplicate = await api(
    writerToken,
    projectA.rows[0].id,
    "coordinator-actions/meeting-links/execute",
    {
      ...baseBody,
      items: items.slice(0, 2),
      confirmed: true,
      idempotencyKey: `${marker}-duplicate`,
    },
  );
  assert.equal(duplicate.status, 201);
  assert.equal(duplicate.body.summary.already_linked, 2);
  check("idempotency.retry_conflict_duplicate", true, "exact retry replays, changed payload conflicts, new request reports already linked");

  await pool.query("UPDATE submittals SET updated_at=updated_at + interval '1 second' WHERE id=$1", [subStale.rows[0].id]);
  const staleSource = await api(
    writerToken,
    projectA.rows[0].id,
    "coordinator-actions/meeting-links/preview",
    {
      meetingId: meetingA.rows[0].id,
      expectedMeetingUpdatedAt: exact(meetingVersion.rows[0].version),
      items: [{ sourceModule: "submittal", sourceId: subStale.rows[0].id, sourceUpdatedAt: exact(subStaleVersion.rows[0].version) }],
    },
  );
  assert.equal(staleSource.body.summary.stale, 1);
  await pool.query("UPDATE meeting_minutes SET updated_at=updated_at + interval '1 second' WHERE id=$1", [meetingA.rows[0].id]);
  const staleMeeting = await api(
    writerToken,
    projectA.rows[0].id,
    "coordinator-actions/meeting-links/preview",
    {
      meetingId: meetingA.rows[0].id,
      expectedMeetingUpdatedAt: exact(meetingVersion.rows[0].version),
      items: [{ sourceModule: "submittal", sourceId: subStale.rows[0].id, sourceUpdatedAt: exact(subStaleVersion.rows[0].version) }],
    },
  );
  assert.equal(staleMeeting.body.summary.stale, 1);
  check("stale.source_and_meeting_rejected", true, "canonical source and Meeting version drift return stale without mutation");

  const meetingCurrent = await pool.query<{ version: string }>(`SELECT ${timestampSql} FROM meeting_minutes WHERE id=$1`, [meetingA.rows[0].id]);
  const subStaleCurrent = await pool.query<{ version: string }>(`SELECT ${timestampSql} FROM submittals WHERE id=$1`, [subStale.rows[0].id]);
  await pool.query("UPDATE project_members SET status='inactive' WHERE project_id=$1 AND user_id=$2", [projectA.rows[0].id, writer.id]);
  const inactive = await api(
    writerToken,
    projectA.rows[0].id,
    "coordinator-actions/meeting-links/execute",
    {
      meetingId: meetingA.rows[0].id,
      expectedMeetingUpdatedAt: exact(meetingCurrent.rows[0].version),
      items: [{ sourceModule: "submittal", sourceId: subStale.rows[0].id, sourceUpdatedAt: exact(subStaleCurrent.rows[0].version) }],
      confirmed: true,
      idempotencyKey: `${marker}-inactive`,
    },
  );
  assert.equal(inactive.status, 403);
  assert.equal(
    (await pool.query("SELECT count(*)::int count FROM meeting_submittal_links WHERE meeting_id=$1 AND submittal_id=$2", [meetingA.rows[0].id, subStale.rows[0].id])).rows[0].count,
    0,
  );
  check("authorization.transaction_membership_recheck", true, "membership revoked before execute; operation denied and rolled back");

  const canonicalRfi = await pool.query("SELECT number,subject,status,updated_at FROM rfis WHERE id=$1", [rfiA.rows[0].id]);
  const canonicalSub = await pool.query("SELECT number,title,status,updated_at FROM submittals WHERE id=$1", [subA.rows[0].id]);
  assert.equal(canonicalRfi.rows[0].number, `${marker}-RFI-1`);
  assert.equal(canonicalSub.rows[0].number, `${marker}-SUB-1`);
  check("boundary.zero_canonical_source_mutation", true, "canonical RFI/Submittal fields remain unchanged; only accepted link tables changed");

  const report = {
    suite: "coordinator-command-center-build3",
    database: { host: "127.0.0.1", port: 55432, name: "bimlog_rfi_test" },
    passed: results.length,
    failed: 0,
    results,
  };
  const evidenceDir = process.argv[2];
  if (evidenceDir) {
    fs.mkdirSync(evidenceDir, { recursive: true });
    const reportPath = path.join(evidenceDir, "focused-proof.json");
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    const digest = crypto
      .createHash("sha256")
      .update(fs.readFileSync(reportPath))
      .digest("hex");
    fs.writeFileSync(
      path.join(evidenceDir, "focused-proof.sha256"),
      `${digest}  focused-proof.json\n`,
    );
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (ids.projects.length) {
    await pool.query("DELETE FROM coordinator_bulk_meeting_operations WHERE project_id=ANY($1::int[])", [ids.projects]);
    await pool.query("DELETE FROM meeting_schedule_task_links WHERE project_id=ANY($1::int[])", [ids.projects]);
    await pool.query("DELETE FROM meeting_schedule_bucket_links WHERE project_id=ANY($1::int[])", [ids.projects]);
    await pool.query("DELETE FROM meeting_rfi_links WHERE project_id=ANY($1::int[])", [ids.projects]);
    await pool.query("DELETE FROM meeting_submittal_links WHERE project_id=ANY($1::int[])", [ids.projects]);
    await pool.query("DELETE FROM action_items WHERE project_id=ANY($1::int[])", [ids.projects]);
    await pool.query("DELETE FROM meeting_minutes WHERE project_id=ANY($1::int[])", [ids.projects]);
    await pool.query("DELETE FROM rfis WHERE project_id=ANY($1::int[])", [ids.projects]);
    await pool.query("DELETE FROM submittals WHERE project_id=ANY($1::int[])", [ids.projects]);
    const cleanupClient = await pool.connect();
    try {
      await cleanupClient.query("BEGIN");
      await cleanupClient.query(
        "ALTER TABLE project_company_binding_versions DISABLE TRIGGER project_company_bindings_append_only_trigger",
      );
      await cleanupClient.query(
        "DELETE FROM project_company_binding_versions WHERE project_id=ANY($1::int[])",
        [ids.projects],
      );
      await cleanupClient.query(
        "ALTER TABLE project_company_binding_versions ENABLE TRIGGER project_company_bindings_append_only_trigger",
      );
      await cleanupClient.query("COMMIT");
    } catch (cleanupError) {
      await cleanupClient.query("ROLLBACK");
      throw cleanupError;
    } finally {
      cleanupClient.release();
    }
    await pool.query("DELETE FROM project_members WHERE project_id=ANY($1::int[])", [ids.projects]);
    await pool.query("DELETE FROM projects WHERE id=ANY($1::int[])", [ids.projects]);
  }
  if (ids.users.length)
    await pool.query("DELETE FROM users WHERE id=ANY($1::int[])", [ids.users]);
  if (ids.companies.length)
    await pool.query("DELETE FROM companies WHERE id=ANY($1::int[])", [ids.companies]);
  server.close();
  await pool.end();
}
