import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

if (!process.env.PROD_DATABASE_URL) throw new Error("Load the isolated local test environment first.");
const databaseUrl = new URL(process.env.PROD_DATABASE_URL);
if (!["127.0.0.1", "localhost", "::1"].includes(databaseUrl.hostname) || databaseUrl.port !== "55432" || databaseUrl.pathname.slice(1) !== "bimlog_rfi_test") {
  throw new Error("Project Insights proof requires the isolated loopback database.");
}

const [{ pool }, { evaluateProjectReadAccess }, { loadProjectInsightsSummary }] = await Promise.all([
  import("@workspace/db"),
  import("../src/lib/coordinator-action-register"),
  import("../src/lib/project-insights-metrics"),
]);

const root = path.resolve(import.meta.dirname, "../../..");
const registerSource = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/coordinator-action-register.ts"), "utf8");
const insightsSource = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/project-insights-metrics.ts"), "utf8");
const marker = `project-insights-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const ids = {
  companies: [] as number[],
  users: [] as number[],
  projects: [] as number[],
  files: [] as number[],
};
const results: Array<{ name: string; detail: string }> = [];
const check = (name: string, detail: string) => results.push({ name, detail });

try {
  assert.equal(
    evaluateProjectReadAccess({
      currentCompanyId: 100,
      boundCompanyId: null,
      projectCreatorCompanyId: 100,
      role: "project_admin",
      status: "active",
      permission: null,
      isSuperAdmin: false,
    }),
    "member",
  );
  assert.equal(
    evaluateProjectReadAccess({
      currentCompanyId: 200,
      boundCompanyId: null,
      projectCreatorCompanyId: 100,
      role: "project_admin",
      status: "active",
      permission: null,
      isSuperAdmin: false,
    }),
    null,
  );
  check("source.legacy_project_admin_metadata_absent", "project_admin maps to project read on legacy creator-company projects without config metadata, and denies another company");

  assert.doesNotMatch(insightsSource, /uploaded_by_company/i);
  assert.match(insightsSource, /JOIN users u ON u\.id=f\.uploaded_by_id/);
  assert.match(insightsSource, /JOIN companies c ON c\.id=u\.company_id/);
  assert.match(insightsSource, /ccView=overdue/);
  assert.match(insightsSource, /ccPresentationStatus=action_required/);
  assert.match(insightsSource, /Todavía/);
  assert.match(insightsSource, /pronóstico/);
  assert.match(registerSource, /project_creator_company_id/);
  check("source.metrics_links_encoding", "metrics use files->users->companies, live ccView/ccPresentationStatus links, and corrected Spanish literals");

  const companyA = await pool.query<{ id: number }>("INSERT INTO companies(name) VALUES($1) RETURNING id", [`${marker} Alpha`]);
  const companyB = await pool.query<{ id: number }>("INSERT INTO companies(name) VALUES($1) RETURNING id", [`${marker} Beta`]);
  ids.companies.push(companyA.rows[0].id, companyB.rows[0].id);

  const admin = await pool.query<{ id: number }>(
    "INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin) VALUES($1,'proof',$2,$3,false) RETURNING id",
    [`${marker}-admin@example.test`, `${marker} Admin`, companyA.rows[0].id],
  );
  const uploaderA = await pool.query<{ id: number }>(
    "INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin) VALUES($1,'proof',$2,$3,false) RETURNING id",
    [`${marker}-uploader-a@example.test`, `${marker} Uploader A`, companyA.rows[0].id],
  );
  const uploaderB = await pool.query<{ id: number }>(
    "INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin) VALUES($1,'proof',$2,$3,false) RETURNING id",
    [`${marker}-uploader-b@example.test`, `${marker} Uploader B`, companyB.rows[0].id],
  );
  const outsider = await pool.query<{ id: number }>(
    "INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin) VALUES($1,'proof',$2,$3,false) RETURNING id",
    [`${marker}-outsider@example.test`, `${marker} Outsider`, companyB.rows[0].id],
  );
  ids.users.push(admin.rows[0].id, uploaderA.rows[0].id, uploaderB.rows[0].id, outsider.rows[0].id);

  const project = await pool.query<{ id: number }>(
    "INSERT INTO projects(name,code,status,created_by_id) VALUES($1,$2,'active',$3) RETURNING id",
    [`${marker} Legacy Project`, marker, admin.rows[0].id],
  );
  ids.projects.push(project.rows[0].id);
  await pool.query("INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,'project_admin','active')", [project.rows[0].id, admin.rows[0].id]);

  const fileRows = await pool.query<{ id: number }>(
    `INSERT INTO files(project_id,file_name,file_size,file_type,status,uploaded_by_id)
     VALUES
       ($1,$2,10,'application/pdf','rejected',$3),
       ($1,$4,10,'application/pdf','rejected',$5),
       ($1,$6,10,'application/pdf','rejected',$5),
       ($1,$7,10,'application/pdf','approved',$3)
     RETURNING id`,
    [
      project.rows[0].id,
      `${marker}-alpha-rejected.pdf`,
      uploaderA.rows[0].id,
      `${marker}-beta-rejected-1.pdf`,
      uploaderB.rows[0].id,
      `${marker}-beta-rejected-2.pdf`,
      `${marker}-alpha-approved.pdf`,
    ],
  );
  ids.files.push(...fileRows.rows.map((row) => row.id));

  const bindingCheck = await pool.query("SELECT count(*)::int AS count FROM project_company_binding_versions WHERE project_id=$1", [project.rows[0].id]);
  assert.equal(Number(bindingCheck.rows[0].count), 0);

  const summary = await loadProjectInsightsSummary({
    userId: admin.rows[0].id,
    projectId: project.rows[0].id,
    timezone: "UTC",
  });
  assert.equal(summary.projectId, project.rows[0].id);
  assert.equal(summary.compliance.totalFiles, 4);
  assert.equal(summary.compliance.rejectedFiles, 3);
  assert.equal(summary.compliance.validFiles, 1);
  assert.deepEqual(
    summary.compliance.companies,
    [
      { company: `${marker} Beta`, rejected: 2 },
      { company: `${marker} Alpha`, rejected: 1 },
    ],
  );
  assert.equal(summary.operationalContext.links.actionable, `/projects/${project.rows[0].id}/command-center?ccView=all_actionable`);
  assert.equal(summary.operationalContext.links.overdue, `/projects/${project.rows[0].id}/command-center?ccView=overdue`);
  assert.equal(summary.operationalContext.links.blocked, `/projects/${project.rows[0].id}/command-center?ccPresentationStatus=action_required`);
  const mojibakeCodePoints = new Set([0x00c3, 0x00c2, 0xfffd]);
  assert.ok(
    summary.unavailable.every(
      (item) =>
        ![...item.reasonEs].some((character) =>
          mojibakeCodePoints.has(character.codePointAt(0) ?? 0),
        ),
    ),
  );
  check("runtime.legacy_admin_and_metrics", "real Project Insights summary authorized active legacy project_admin with no binding and returned rejected-file companies from uploader users");

  await assert.rejects(
    () =>
      loadProjectInsightsSummary({
        userId: outsider.rows[0].id,
        projectId: project.rows[0].id,
        timezone: "UTC",
      }),
    /Active project read access is required/,
  );
  check("runtime.tenant_isolation", "outsider from a different company without active project authority remains denied");

  const report = {
    suite: "project-insights-api-correction",
    database: { host: databaseUrl.hostname, port: databaseUrl.port, name: databaseUrl.pathname.slice(1) },
    marker,
    passed: results.length,
    failed: 0,
    checks: results,
  };
  const evidenceDir = process.argv[2];
  if (evidenceDir) {
    fs.mkdirSync(evidenceDir, { recursive: true });
    const reportPath = path.join(evidenceDir, "project-insights-api-correction-proof.json");
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    const digest = crypto.createHash("sha256").update(fs.readFileSync(reportPath)).digest("hex");
    fs.writeFileSync(path.join(evidenceDir, "project-insights-api-correction-proof.sha256"), `${digest}  project-insights-api-correction-proof.json\n`);
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await pool.query("DELETE FROM files WHERE id=ANY($1::int[])", [ids.files]);
  await pool.query("DELETE FROM project_members WHERE project_id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM projects WHERE id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM users WHERE id=ANY($1::int[])", [ids.users]);
  await pool.query("DELETE FROM companies WHERE id=ANY($1::int[])", [ids.companies]);
  await pool.end();
}
