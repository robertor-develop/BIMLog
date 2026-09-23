import assert from "node:assert/strict";
// @ts-expect-error Runtime pg dependency is installed; isolated SQL proof does not require optional declarations.
import pg from "pg";
import { edtRouteActorSql } from "./edt-engine-route-context";
import { activatedEdtProjectSql } from "./edt-engine-source-service";

const connectionString = process.env.BIMLOG_COORDINATION_KNOWLEDGE_TEST_DATABASE_URL;
assert.ok(connectionString, "An isolated test database is required to validate EDT read SQL against the actual schema.");
const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query("BEGIN READ ONLY");
  await client.query(`EXPLAIN ${edtRouteActorSql}`, [0, 0]);
  await client.query(`EXPLAIN ${activatedEdtProjectSql}`, [0, 0]);
  console.log("EDT_ENGINE_READ_SQL_RESULT=PASS route authority and project source compile against isolated database schema");
} finally {
  await client.query("ROLLBACK");
  await client.end();
}
