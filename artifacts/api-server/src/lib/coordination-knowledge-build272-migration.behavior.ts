import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  COORDINATION_KNOWLEDGE_SCHEMA_SQL,
  COORDINATION_KNOWLEDGE_SCHEMA_VERSION,
  ensureCoordinationKnowledgeSchema,
  type CoordinationKnowledgeMigrationPool,
} from "./coordination-knowledge-migration";

const tables = [...COORDINATION_KNOWLEDGE_SCHEMA_SQL.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z0-9_]+)/g)].map(match => match[1]!);
const indexes = [...COORDINATION_KNOWLEDGE_SCHEMA_SQL.matchAll(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS ([a-z0-9_]+)/g)].map(match => match[1]!);
const triggers = [...COORDINATION_KNOWLEDGE_SCHEMA_SQL.matchAll(/CREATE TRIGGER ([a-z0-9_]+)/g)].map(match => match[1]!);
assert.equal(COORDINATION_KNOWLEDGE_SCHEMA_VERSION, 3);
assert.equal(tables.length, 16);
assert.equal(new Set(tables).size, tables.length);
assert.equal(indexes.length, 9);
assert.equal(triggers.length, 7);
assert.doesNotMatch(COORDINATION_KNOWLEDGE_SCHEMA_SQL, /\b(?:DROP|TRUNCATE|DELETE\s+FROM|ALTER\s+TABLE\s+\S+\s+RENAME)\b/i);

const successful: string[] = [];
let released = 0;
const repeatPool: CoordinationKnowledgeMigrationPool = {
  async connect() {
    return {
      async query(sql: string) { successful.push(sql); return {}; },
      release() { released += 1; },
    };
  },
};
await ensureCoordinationKnowledgeSchema(repeatPool);
await ensureCoordinationKnowledgeSchema(repeatPool);
assert.equal(successful.filter(sql => sql === COORDINATION_KNOWLEDGE_SCHEMA_SQL).length, 2, "clean and repeated upgrade use one exact idempotent definition");
assert.equal(successful.filter(sql => sql === "COMMIT").length, 2);
assert.equal(released, 2);

const failed: string[] = [];
await assert.rejects(ensureCoordinationKnowledgeSchema({
  async connect() {
    return {
      async query(sql: string) {
        failed.push(sql);
        if (sql === COORDINATION_KNOWLEDGE_SCHEMA_SQL) throw new Error("simulated partial migration");
        return {};
      },
      release() { failed.push("RELEASE"); },
    };
  },
}));
assert.ok(failed.includes("ROLLBACK"), "partial migration must roll back");
assert.ok(failed.includes("RELEASE"), "failed migration must release its client");

const rawUrl = process.env.BIMLOG_COORDINATION_KNOWLEDGE_TEST_DATABASE_URL;
assert.ok(rawUrl, "BIMLOG_COORDINATION_KNOWLEDGE_TEST_DATABASE_URL is required for Build 272");
const identity = new URL(rawUrl);
assert.ok(["127.0.0.1", "localhost", "::1"].includes(identity.hostname));
assert.equal(identity.pathname, "/bimlog_rfi_test");
const requireApi = createRequire(import.meta.url);
const { Pool } = requireApi("pg") as { Pool: new (options: { connectionString: string; max: number }) => CoordinationKnowledgeMigrationPool & {
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  end(): Promise<void>;
} };
const pool = new Pool({ connectionString: rawUrl, max: 2 });
try {
  const before = await pool.query<{ projects: string; viewpoints: string; revisions: string }>(`SELECT
    (SELECT count(*)::text FROM projects) projects,
    (SELECT count(*)::text FROM lens_viewpoints) viewpoints,
    ((SELECT count(*) FROM coordination_conflict_type_revisions)+(SELECT count(*) FROM coordination_rule_revisions)+(SELECT count(*) FROM coordination_resolution_method_revisions)+(SELECT count(*) FROM coordination_resolution_record_revisions))::text revisions`);
  await ensureCoordinationKnowledgeSchema(pool);
  await ensureCoordinationKnowledgeSchema(pool);
  const after = await pool.query<{ projects: string; viewpoints: string; revisions: string }>(`SELECT
    (SELECT count(*)::text FROM projects) projects,
    (SELECT count(*)::text FROM lens_viewpoints) viewpoints,
    ((SELECT count(*) FROM coordination_conflict_type_revisions)+(SELECT count(*) FROM coordination_rule_revisions)+(SELECT count(*) FROM coordination_resolution_method_revisions)+(SELECT count(*) FROM coordination_resolution_record_revisions))::text revisions`);
  assert.deepEqual(after.rows[0], before.rows[0], "repeat migration must preserve canonical issues and all historical revisions");
  const inventory = await pool.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[]) ORDER BY table_name", [tables]);
  assert.deepEqual(inventory.rows.map(row => row.table_name), [...tables].sort());
  const integrity = await pool.query<{ orphans: string }>(`SELECT (
    (SELECT count(*) FROM coordination_conflict_type_revisions r LEFT JOIN coordination_conflict_types b ON b.id=r.conflict_type_id AND b.company_id=r.company_id WHERE b.id IS NULL)+
    (SELECT count(*) FROM coordination_rule_revisions r LEFT JOIN coordination_rules b ON b.id=r.rule_id AND b.company_id=r.company_id WHERE b.id IS NULL)+
    (SELECT count(*) FROM coordination_resolution_method_revisions r LEFT JOIN coordination_resolution_methods b ON b.id=r.resolution_method_id AND b.company_id=r.company_id WHERE b.id IS NULL)+
    (SELECT count(*) FROM coordination_resolution_record_revisions r LEFT JOIN coordination_resolution_records b ON b.id=r.resolution_record_id AND b.company_id=r.company_id AND b.project_id=r.project_id WHERE b.id IS NULL)+
    (SELECT count(*) FROM coordination_knowledge_taxonomy_term_revisions r LEFT JOIN coordination_knowledge_taxonomy_terms b ON b.id=r.term_id AND b.company_id=r.company_id WHERE b.id IS NULL)
  )::text orphans`);
  assert.equal(integrity.rows[0]!.orphans, "0");
  const runtime = await pool.query<{ encoding: string; data_dir: string }>("SELECT current_setting('server_encoding') encoding,current_setting('data_directory') data_dir");
  assert.equal(runtime.rows[0]!.encoding, "UTF8");
  assert.match(runtime.rows[0]!.data_dir.replaceAll("/", "\\"), /^F:\\BIMLog\\TestProof\\/i, "restore fixture must remain F-rooted");
  console.log(`Build 272 Coordination Knowledge migration: PASS schema=v${COORDINATION_KNOWLEDGE_SCHEMA_VERSION} tables=${tables.length} indexes=${indexes.length} triggers=${triggers.length} orphans=0 repeat=PASS rollback=PASS projects=${after.rows[0]!.projects} viewpoints=${after.rows[0]!.viewpoints} revisions=${after.rows[0]!.revisions}`);
} finally {
  await pool.end();
}
