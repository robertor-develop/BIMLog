import assert from "node:assert/strict";
// @ts-expect-error Runtime pg dependency is installed; isolated SQL proof does not require optional declarations.
import pg from "pg";
import { EDT_RESOLVED_REQUEST_INSERT_SQL, EDT_RESOLVED_NODE_INSERT_SQL,
  EDT_RESOLVED_WORK_ITEM_UPDATE_SQL, EDT_RESOLVED_DECISION_INSERT_SQL } from "./edt-engine-resolved-activation";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Build 345 requires the isolated PostgreSQL DATABASE_URL.");
const target = new URL(databaseUrl);
if (!["127.0.0.1", "localhost", "::1"].includes(target.hostname) || !target.pathname.endsWith("/bimlog_rfi_test"))
  throw new Error("Build 345 refuses a non-isolated database target.");
const fingerprint = "a".repeat(64);
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
const checks: Array<[string, string, unknown[]]> = [
  ["activation request", EDT_RESOLVED_REQUEST_INSERT_SQL,
    ["request-1", 1, 1, "intake-1", 1, "governance-1", "pricing-1", "[]", fingerprint,
      "intake-1-edt", 1, "PROJECT_LEADER", "reviewed"]],
  ["EDT node", EDT_RESOLVED_NODE_INSERT_SQL,
    ["node-1", 1, 1, "intake-1", null, "project", "project:1", "P1", "Project", 1, "{}", fingerprint, 1]],
  ["Work Item identity", EDT_RESOLVED_WORK_ITEM_UPDATE_SQL,
    ["wi-1", "node-1", "location:wi-1", "{}", "trade-1", "{}", "deliverable-1", "{}",
      "WI-P1-C1-D1-L1-T1-0123456789", fingerprint, 1, "intake-1"]],
  ["immutable decision", EDT_RESOLVED_DECISION_INSERT_SQL,
    ["decision-1", "request-1", 1, 1, fingerprint, 1, "OPERATIONS_DIRECTOR", "reviewed", "{}"]],
];
try {
  await client.query("BEGIN READ ONLY");
  for (const [name, sql, values] of checks) {
    const plan = await client.query(`EXPLAIN ${sql}`, values);
    assert.ok(plan.rows.length > 0, `${name} must compile against the real isolated schema`);
  }
  console.log("EDT_ENGINE_BUILD345_RESULT=PASS four production write statements compile on isolated PostgreSQL without execution");
} finally {
  await client.query("ROLLBACK");
  await client.end();
}
