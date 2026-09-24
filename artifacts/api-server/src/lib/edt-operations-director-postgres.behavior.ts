import assert from "node:assert/strict";
// @ts-expect-error Runtime pg dependency is installed; isolated SQL proof does not require optional declarations.
import pg from "pg";
import { EDT_ENGINE_GOVERNANCE_SQL } from "./edt-engine-migration";

const url = process.env.EDT_ISOLATED_DATABASE_URL;
if (!url || !/^postgres(?:ql)?:\/\/[^/]+@(?:127\.0\.0\.1|localhost):\d+\//.test(url)) {
  throw new Error("EDT_ISOLATED_DATABASE_URL must point to an explicit localhost test database");
}
const pool = new pg.Pool({ connectionString: url });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(EDT_ENGINE_GOVERNANCE_SQL);
  const tables = await client.query(
    `SELECT table_name AS name FROM information_schema.tables
     WHERE table_schema='public' AND table_name IN ('edt_operations_director_grants','edt_operations_director_revocations') ORDER BY table_name`,
  );
  assert.deepEqual(tables.rows.map((row: { name: string }) => row.name), ["edt_operations_director_grants", "edt_operations_director_revocations"]);
  const triggers = await client.query(
    `SELECT tgname AS name FROM pg_trigger WHERE tgname IN
     ('edt_operations_director_grant_immutable','edt_operations_director_revocation_immutable') ORDER BY tgname`,
  );
  assert.deepEqual(triggers.rows.map((row: { name: string }) => row.name), ["edt_operations_director_grant_immutable", "edt_operations_director_revocation_immutable"]);
  await client.query("ROLLBACK");
  console.log("EDT_OPERATIONS_DIRECTOR_POSTGRES_RESULT=PASS localhost DDL and append-only triggers");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
