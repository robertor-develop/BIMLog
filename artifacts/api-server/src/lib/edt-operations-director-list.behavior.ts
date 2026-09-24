import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { listEdtOperationsDirectorAssignments } from "./edt-engine-operations-director";
import type { EdtTransactionHost } from "./edt-engine-transaction";

const route = readFileSync(new URL("../routes/edt-engine.ts", import.meta.url), "utf8");
assert.match(route, /router\.get\("\/projects\/:projectId\/edt-engine\/operations-director-grants"/);
assert.match(route, /listEdtOperationsDirectorAssignments\(/);

let administrator = false;
let sameCompanyProject = false;
const host: EdtTransactionHost = { async connect() { return {
  async query<Row>(sql: string) {
    const rows: unknown[] = sql.includes("is_super_admin=true") ? administrator ? [{ id: 1 }] : []
      : sql.includes("SELECT p.id FROM projects") ? sameCompanyProject ? [{ id: 11 }] : []
      : sql.includes("FROM project_members pm JOIN users u") ? [
        { user_id: 2, full_name: "Test reviewer", email: "reviewer@example.test", project_role: "member", active: true },
      ] : [];
    return { rows: rows as Row[], rowCount: rows.length };
  }, release() {},
}; } };
const input = { actorUserId: 1, actorCompanyId: 7, projectId: 11 };
await assert.rejects(() => listEdtOperationsDirectorAssignments(input, host),
  (error: unknown) => error instanceof Error && "code" in error && error.code === "EDT_DIRECTOR_ADMIN_REQUIRED");
administrator = true;
await assert.rejects(() => listEdtOperationsDirectorAssignments(input, host),
  (error: unknown) => error instanceof Error && "code" in error && error.code === "PROJECT_COMPANY_MISMATCH");
sameCompanyProject = true;
assert.deepEqual(await listEdtOperationsDirectorAssignments(input, host), [
  { userId: 2, fullName: "Test reviewer", email: "reviewer@example.test", projectRole: "member", active: true },
]);
console.log("EDT_OPERATIONS_DIRECTOR_LIST_RESULT=PASS admin and project scope, active membership");
