import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
// @ts-expect-error Runtime pg dependency is installed; isolated SQL proof does not require optional declarations.
import pg from "pg";
import { changeEdtOperationsDirectorGrant, listEdtOperationsDirectorAssignments } from "./edt-engine-operations-director";
import { edtRoleFromCurrentAuthority, edtRouteActorSql } from "./edt-engine-route-context";
import type { EdtTransactionHost } from "./edt-engine-transaction";

const rawUrl = process.env.EDT_ISOLATED_DATABASE_URL;
if (!rawUrl) throw new Error("EDT_ISOLATED_DATABASE_URL is required");
const target = new URL(rawUrl);
if (!["127.0.0.1", "localhost", "::1"].includes(target.hostname) || target.pathname !== "/bimlog_rfi_test")
  throw new Error("Operations Director proof requires the isolated localhost bimlog_rfi_test database");
const client = new pg.Client({ connectionString: rawUrl });
await client.connect();
await client.query("BEGIN");
const host: EdtTransactionHost = { async connect() { return {
  async query<Row>(sql: string, values?: readonly unknown[]) {
    if (sql.startsWith("BEGIN ISOLATION LEVEL")) return client.query("SAVEPOINT edt_service") as Promise<{ rows: Row[]; rowCount: number }>;
    if (sql === "COMMIT") return client.query("RELEASE SAVEPOINT edt_service") as Promise<{ rows: Row[]; rowCount: number }>;
    if (sql === "ROLLBACK") return client.query("ROLLBACK TO SAVEPOINT edt_service") as Promise<{ rows: Row[]; rowCount: number }>;
    return client.query(sql, values) as Promise<{ rows: Row[]; rowCount: number }>;
  }, release() {},
}; } };
try {
  const suffix = randomUUID();
  const company = (await client.query("INSERT INTO companies(name) VALUES($1) RETURNING id", [`EDT isolated ${suffix}`])).rows[0].id as number;
  const admin = (await client.query("INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin) VALUES($1,'test-only','EDT Test Admin',$2,true) RETURNING id",
    [`admin-${suffix}@example.test`, company])).rows[0].id as number;
  const reviewer = (await client.query("INSERT INTO users(email,password_hash,full_name,company_id) VALUES($1,'test-only','EDT Test Reviewer',$2) RETURNING id",
    [`reviewer-${suffix}@example.test`, company])).rows[0].id as number;
  const project = (await client.query("INSERT INTO projects(name,code,status,created_by_id) VALUES($1,$2,'active',$3) RETURNING id",
    ["EDT isolated project", `EDT-${suffix.slice(0, 8)}`, admin])).rows[0].id as number;
  await client.query("INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,'member','active')", [project, reviewer]);
  const input = { actorUserId: admin, actorCompanyId: company, projectId: project, targetUserId: reviewer,
    reason: "Independent isolated EDT review" };
  assert.deepEqual((await listEdtOperationsDirectorAssignments(input, host)).map(row => row.active), [false]);
  const first = await changeEdtOperationsDirectorGrant({ ...input, action: "grant" }, host);
  assert.equal(first.active, true);
  assert.equal((await changeEdtOperationsDirectorGrant({ ...input, action: "grant" }, host)).idempotent, true);
  assert.deepEqual((await listEdtOperationsDirectorAssignments(input, host)).map(row => row.active), [true]);
  const role = (await client.query(edtRouteActorSql, [reviewer, project])).rows[0];
  assert.equal(edtRoleFromCurrentAuthority({ isOperationsDirector: role.is_operations_director, projectRole: role.project_role,
    isSuperAdmin: role.is_super_admin, isCompanyPmo: role.is_company_pmo }), "OPERATIONS_DIRECTOR");
  await changeEdtOperationsDirectorGrant({ ...input, action: "revoke" }, host);
  assert.deepEqual((await listEdtOperationsDirectorAssignments(input, host)).map(row => row.active), [false]);
  const revokedRole = (await client.query(edtRouteActorSql, [reviewer, project])).rows[0];
  assert.equal(edtRoleFromCurrentAuthority({ isOperationsDirector: revokedRole.is_operations_director, projectRole: revokedRole.project_role,
    isSuperAdmin: revokedRole.is_super_admin, isCompanyPmo: revokedRole.is_company_pmo }), "DRAFTER");
  await assert.rejects(() => changeEdtOperationsDirectorGrant({ ...input, targetUserId: admin, action: "grant" }, host),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "SELF_GRANT_PROHIBITED");
  console.log("EDT_OPERATIONS_DIRECTOR_LIVE_DB_RESULT=PASS grant, list, role, revoke, self-denial, rollback");
} finally {
  await client.query("ROLLBACK");
  await client.end();
}
