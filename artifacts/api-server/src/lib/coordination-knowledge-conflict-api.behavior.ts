import assert from "node:assert/strict";
import fs from "node:fs";
import { CoordinationKnowledgeRepository, CoordinationKnowledgeRepositoryError, type KnowledgeQueryClient, type KnowledgeRepositoryPool } from "./coordination-knowledge-repository";

const id = "00000001-1111-4111-8111-000000000001";
const calls: string[] = [];
const current = { revision: 2, status: "draft", name: "Duct vs beam", description: "A clash.", discipline_a: "HVAC", discipline_b: "Structural", element_type_a: "Duct", element_type_b: "Beam", conflict_category: "physical", coordination_stage: "coordination", tags: ["duct"] };
const pool: KnowledgeRepositoryPool = {
  async query() { return { rows: [] }; },
  async connect() {
    const client: KnowledgeQueryClient & { release(): void } = {
      async query(sql) {
        calls.push(sql);
        if (sql.includes("ORDER BY revision DESC LIMIT 1 FOR UPDATE")) return { rows: [current] };
        if (sql.includes("RETURNING *")) return { rows: [{ revision: 3, status: "under_review" }] };
        return { rows: [] };
      },
      release() { calls.push("RELEASE"); },
    };
    return client;
  },
};
const repository = new CoordinationKnowledgeRepository(pool);
const submitted = await repository.appendConflictTypeRevision({ companyId: 42, conflictTypeId: id, expectedRevision: 2, actorId: 7, action: "submit_for_review" });
assert.deepEqual(submitted, { revision: 3, status: "under_review" });
assert.ok(calls.some(sql => sql.includes("INSERT INTO coordination_knowledge_events")));
assert.ok(calls.includes("COMMIT"));

await assert.rejects(
  repository.appendConflictTypeRevision({ companyId: 42, conflictTypeId: id, expectedRevision: 1, actorId: 7, action: "submit_for_review" }),
  (error: unknown) => error instanceof CoordinationKnowledgeRepositoryError && error.code === "KNOWLEDGE_VERSION_CONFLICT" && error.status === 409,
);
assert.ok(calls.includes("ROLLBACK"));

const route = fs.readFileSync(new URL("../routes/coordination-knowledge.ts", import.meta.url), "utf8");
assert.match(route, /authMiddleware/);
assert.match(route, /resolveKnowledgeAuthorizationContext\(pool, req\.user!\.userId\)/);
assert.doesNotMatch(route, /req\.body\?\.companyId|req\.query\.companyId/);
for (const operation of ["conflict-types", "submit_for_review", "approve", "revise", "retire", "history"]) assert.match(route, new RegExp(operation));
assert.match(route, /action\.replaceAll\("_", "-"\)/);

console.log("Coordination Knowledge Build 232 Conflict Type API: append-only lifecycle, concurrency, audit and server scope passed");
