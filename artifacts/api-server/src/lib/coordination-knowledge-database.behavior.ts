import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { ensureCoordinationKnowledgeSchema } from "./coordination-knowledge-migration";

type PgResult<T extends Record<string, unknown>> = { rows: T[]; rowCount: number | null };
type PgClient = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<PgResult<T>>;
  release(): void;
};
type PgPool = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<PgResult<T>>;
  connect(): Promise<PgClient>;
  end(): Promise<void>;
};
const requireApi = createRequire(import.meta.url);
const { Pool } = requireApi("pg") as { Pool: new (options: { connectionString: string; max: number }) => PgPool };

const url = process.env.BIMLOG_COORDINATION_KNOWLEDGE_TEST_DATABASE_URL;
assert.ok(url, "BIMLOG_COORDINATION_KNOWLEDGE_TEST_DATABASE_URL is required");
const target = new URL(url);
assert.ok(["127.0.0.1", "localhost", "::1"].includes(target.hostname), "database test is loopback-only");
assert.equal(target.pathname, "/bimlog_rfi_test", "database test must target the restored bimlog_rfi_test fixture");

const pool = new Pool({ connectionString: url, max: 2 });
const knowledgeTables = [
  "coordination_conflict_types",
  "coordination_conflict_type_revisions",
  "coordination_rules",
  "coordination_rule_revisions",
  "coordination_resolution_methods",
  "coordination_resolution_method_revisions",
  "coordination_resolution_method_conflict_types",
  "coordination_resolution_method_rules",
  "coordination_project_cases",
  "coordination_lesson_proposals",
  "coordination_knowledge_evidence",
  "coordination_knowledge_events",
] as const;

try {
  const coreBefore = await pool.query<{ projects: string; viewpoints: string }>(
    "SELECT (SELECT count(*) FROM projects)::text AS projects,(SELECT count(*) FROM lens_viewpoints)::text AS viewpoints",
  );
  await ensureCoordinationKnowledgeSchema(pool);
  await ensureCoordinationKnowledgeSchema(pool);

  const inventory = await pool.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1::text[]) ORDER BY table_name",
    [knowledgeTables],
  );
  assert.deepEqual(inventory.rows.map(row => row.table_name), [...knowledgeTables].sort());

  const expectedTriggers = [
    "coord_conflict_type_revision_immutable",
    "coord_knowledge_events_immutable",
    "coord_knowledge_evidence_immutable",
    "coord_resolution_revision_immutable",
    "coord_rule_revision_immutable",
  ];
  const triggers = await pool.query<{ tgname: string }>(
    "SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgname = ANY($1::text[]) ORDER BY tgname",
    [expectedTriggers],
  );
  assert.deepEqual(triggers.rows.map(row => row.tgname), expectedTriggers, "all immutable-history triggers must exist exactly once");

  const coreAfter = await pool.query<{ projects: string; viewpoints: string }>(
    "SELECT (SELECT count(*) FROM projects)::text AS projects,(SELECT count(*) FROM lens_viewpoints)::text AS viewpoints",
  );
  assert.deepEqual(coreAfter.rows[0], coreBefore.rows[0], "additive migration must not change canonical project or Lens issue rows");

  const rootId = randomUUID();
  const revisionId = randomUUID();
  const marker = `DBTEST-${randomUUID().slice(0, 8).toUpperCase()}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let actor = await client.query<{ company_id: number; user_id: number }>(
      `SELECT c.id AS company_id,u.id AS user_id
         FROM companies c
         JOIN users u ON u.company_id=c.id
        ORDER BY c.id,u.id
        LIMIT 1`,
    );
    if (!actor.rowCount) {
      const company = await client.query<{ id: number }>("INSERT INTO companies(name) VALUES($1) RETURNING id", [`Knowledge fixture ${marker}`]);
      const user = await client.query<{ id: number }>(
        "INSERT INTO users(email,password_hash,full_name,company_id) VALUES($1,$2,$3,$4) RETURNING id",
        [`${marker.toLowerCase()}@fixture.invalid`, "fixture-not-a-credential", "Knowledge Fixture", company.rows[0].id],
      );
      actor = { rows: [{ company_id: company.rows[0].id, user_id: user.rows[0].id }], rowCount: 1 };
    }
    const { company_id: companyId, user_id: userId } = actor.rows[0];
    await client.query(
      "INSERT INTO coordination_conflict_types(id,company_id,code,created_by_id) VALUES($1,$2,$3,$4)",
      [rootId, companyId, marker, userId],
    );
    await client.query(
      `INSERT INTO coordination_conflict_type_revisions
       (id,conflict_type_id,company_id,revision,status,name,description,discipline_a,discipline_b,element_type_a,element_type_b,conflict_category,coordination_stage,tags,authored_by_id)
       VALUES($1,$2,$3,1,'draft','Database proof','Restored fixture proof','HVAC','Structural','Duct','Beam','physical','coordination','[]'::jsonb,$4)`,
      [revisionId, rootId, companyId, userId],
    );
    await client.query("SAVEPOINT immutable_check");
    await assert.rejects(
      client.query("UPDATE coordination_conflict_type_revisions SET name='mutated' WHERE id=$1", [revisionId]),
      /immutable/i,
    );
    await client.query("ROLLBACK TO SAVEPOINT immutable_check");
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
  const residue = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM coordination_conflict_types WHERE id=$1", [rootId]);
  assert.equal(residue.rows[0].count, "0", "behavior proof must leave no test row behind");

  console.log("Coordination Knowledge Build 230 restored-database proof: additive repeat migration, canonical-row preservation and immutable revisions passed");
} finally {
  await pool.end();
}
