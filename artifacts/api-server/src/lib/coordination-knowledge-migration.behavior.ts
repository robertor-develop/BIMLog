import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { COORDINATION_KNOWLEDGE_SCHEMA_SQL, COORDINATION_KNOWLEDGE_SCHEMA_VERSION, ensureCoordinationKnowledgeSchema, type CoordinationKnowledgeMigrationPool } from "./coordination-knowledge-migration";

assert.equal(COORDINATION_KNOWLEDGE_SCHEMA_VERSION, 3);
assert.doesNotMatch(COORDINATION_KNOWLEDGE_SCHEMA_SQL, /\b(?:DROP|TRUNCATE|ALTER\s+TABLE\s+\S+\s+RENAME|DELETE\s+FROM)\b/i, "migration must remain strictly additive");
for (const table of [
  "coordination_conflict_types",
  "coordination_conflict_type_revisions",
  "coordination_rules",
  "coordination_rule_revisions",
  "coordination_resolution_methods",
  "coordination_resolution_method_revisions",
  "coordination_resolution_method_conflict_types",
  "coordination_resolution_method_rules",
  "coordination_project_cases",
  "coordination_resolution_records",
  "coordination_resolution_record_revisions",
  "coordination_lesson_proposals",
  "coordination_knowledge_evidence",
  "coordination_knowledge_events",
  "coordination_knowledge_taxonomy_terms",
  "coordination_knowledge_taxonomy_term_revisions",
]) assert.match(COORDINATION_KNOWLEDGE_SCHEMA_SQL, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
assert.match(COORDINATION_KNOWLEDGE_SCHEMA_SQL, /REFERENCES lens_viewpoints\(id\)/, "project cases must reference the canonical Lens issue instead of duplicating it");
assert.match(COORDINATION_KNOWLEDGE_SCHEMA_SQL, /coord_lesson_proposal_case_scope_fk/, "lesson proposals must remain linked to their exact project case");
assert.match(COORDINATION_KNOWLEDGE_SCHEMA_SQL, /coord_resolution_method_conflict_types_pk/, "method/conflict relationships must be many-to-many");
assert.match(COORDINATION_KNOWLEDGE_SCHEMA_SQL, /status IN \('draft','under_review','approved','retired'\)/, "knowledge lifecycle must be explicit");
assert.match(COORDINATION_KNOWLEDGE_SCHEMA_SQL, /Coordination Knowledge revisions and evidence are immutable/, "historical revisions and evidence must be immutable");

const drizzleSource = await readFile(new URL("../../../../lib/db/src/schema/coordination-knowledge.ts", import.meta.url), "utf8");
const explicitDrizzleNames = [...drizzleSource.matchAll(/(?:check|unique|index)\("([^"]+)"|name:\s*"([^"]+)"/g)]
  .map(match => match[1] || match[2]);
for (const name of explicitDrizzleNames) {
  assert.match(COORDINATION_KNOWLEDGE_SCHEMA_SQL, new RegExp(`\\b${name}\\b`), `startup migration must mirror Drizzle object ${name}`);
}
assert.doesNotMatch(COORDINATION_KNOWLEDGE_SCHEMA_SQL, /\b(?:text|integer|jsonb)\s+NOT NULL(?:\s+DEFAULT\s+[^,\n]+)?\s+CHECK\s*\(/i, "startup checks must be explicitly named to preserve schema correspondence");

const successfulQueries: string[] = [];
let releases = 0;
const fake: CoordinationKnowledgeMigrationPool = {
  async connect() {
    return {
      async query(sql: string) { successfulQueries.push(sql); return {}; },
      release() { releases += 1; },
    };
  },
};
await ensureCoordinationKnowledgeSchema(fake);
await ensureCoordinationKnowledgeSchema(fake);
assert.equal(successfulQueries.filter(sql => sql === COORDINATION_KNOWLEDGE_SCHEMA_SQL).length, 2, "clean and upgraded/restored executions must run the same idempotent definition");
assert.equal(successfulQueries.filter(sql => sql === "COMMIT").length, 2);
assert.equal(releases, 2);

const failedQueries: string[] = [];
let failedReleased = false;
await assert.rejects(ensureCoordinationKnowledgeSchema({
  async connect() {
    return {
      async query(sql: string) {
        failedQueries.push(sql);
        if (sql === COORDINATION_KNOWLEDGE_SCHEMA_SQL) throw new Error("forced restored-database migration failure");
        return {};
      },
      release() { failedReleased = true; },
    };
  },
}));
assert.ok(failedQueries.includes("ROLLBACK"), "a failed restored-database upgrade must roll back");
assert.equal(failedReleased, true);
console.log("Coordination Knowledge Build 230 migration: additive inventory, repeat execution and rollback behavior passed");
