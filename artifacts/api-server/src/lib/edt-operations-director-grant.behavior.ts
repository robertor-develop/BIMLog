import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { changeEdtOperationsDirectorGrant } from "./edt-engine-operations-director";
import type { EdtTransactionHost } from "./edt-engine-transaction";

const route = readFileSync(new URL("../routes/edt-engine.ts", import.meta.url), "utf8");
assert.match(route, /operations-director-grants/);
assert.match(route, /changeEdtOperationsDirectorGrant/);
let admin = true;
let member = true;
let activeGrant: string | null = null;
const history: string[] = [];
const host: EdtTransactionHost = { async connect() { return {
  async query<Row>(sql: string) {
    const rows: unknown[] = sql.includes("FROM users WHERE id=$1 AND is_super_admin=true")
      ? admin ? [{ id: 1 }] : []
      : sql.includes("FROM users u JOIN project_members") ? member ? [{ id: 2 }] : []
      : sql.includes("FROM edt_operations_director_grants g") ? activeGrant ? [{ id: activeGrant }] : []
      : [];
    if (sql.includes("INSERT INTO edt_operations_director_grants")) { activeGrant = "grant-1"; history.push("grant"); }
    if (sql.includes("INSERT INTO edt_operations_director_revocations")) { activeGrant = null; history.push("revoke"); }
    return { rows: rows as Row[], rowCount: rows.length };
  }, release() {},
}; } };
const input = { actorUserId: 1, actorCompanyId: 7, projectId: 11, targetUserId: 2,
  action: "grant" as const, reason: "Independent EDT approval assignment" };
await assert.rejects(() => changeEdtOperationsDirectorGrant({ ...input, targetUserId: 1 }, host),
  (e: unknown) => e instanceof Error && "code" in e && e.code === "SELF_GRANT_PROHIBITED");
admin = false;
await assert.rejects(() => changeEdtOperationsDirectorGrant(input, host),
  (e: unknown) => e instanceof Error && "code" in e && e.code === "EDT_DIRECTOR_ADMIN_REQUIRED");
admin = true; member = false;
await assert.rejects(() => changeEdtOperationsDirectorGrant(input, host),
  (e: unknown) => e instanceof Error && "code" in e && e.code === "EDT_DIRECTOR_SCOPE_REQUIRED");
member = true;
assert.equal((await changeEdtOperationsDirectorGrant(input, host)).active, true);
assert.equal((await changeEdtOperationsDirectorGrant(input, host)).idempotent, true);
assert.equal((await changeEdtOperationsDirectorGrant({ ...input, action: "revoke" }, host)).active, false);
assert.deepEqual(history, ["grant", "revoke"]);
for (const code of ["40001", "40P01", "23505"]) {
  let rolledBack=false,released=false;
  const collisionHost:EdtTransactionHost={async connect(){return {async query<Row>(sql:string){
    if(sql.startsWith("SELECT pg_advisory"))throw Object.assign(new Error("fixture collision"),{code});
    if(sql==="ROLLBACK")rolledBack=true;return {rows:[] as Row[]};
  },release(){released=true;}};}};
  await assert.rejects(()=>changeEdtOperationsDirectorGrant(input,collisionHost),
    (e:unknown)=>e instanceof Error&&"code" in e&&e.code==="EDT_DIRECTOR_CONCURRENT_CHANGE");
  assert.equal(rolledBack,true);assert.equal(released,true);
}
console.log("EDT_OPERATIONS_DIRECTOR_GRANT_RESULT=PASS scoped assignment, duplicate, self-grant, revoke");
