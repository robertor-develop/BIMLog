import assert from "node:assert/strict";
import { COORDINATION_KNOWLEDGE_SCHEMA_SQL, COORDINATION_KNOWLEDGE_SCHEMA_VERSION } from "./coordination-knowledge-migration";
import { normalizeTaxonomyTerm } from "./coordination-knowledge-taxonomy";
import { readFileSync } from "node:fs";

assert.equal(COORDINATION_KNOWLEDGE_SCHEMA_VERSION, 3);
assert.match(COORDINATION_KNOWLEDGE_SCHEMA_SQL, /UNIQUE\(company_id,kind,normalized_key\)/);
assert.match(COORDINATION_KNOWLEDGE_SCHEMA_SQL, /taxonomy_term_revisions[\s\S]*revision integer NOT NULL/);
assert.match(COORDINATION_KNOWLEDGE_SCHEMA_SQL, /coord_knowledge_taxonomy_revision_immutable/);
assert.doesNotMatch(COORDINATION_KNOWLEDGE_SCHEMA_SQL, /DROP\s+(TABLE|COLUMN)|TRUNCATE/i);

assert.deepEqual(normalizeTaxonomyTerm({ kind: "discipline", code: " hvac ", label: "  Mechanical   HVAC  " }), { kind: "discipline", code: "HVAC", label: "Mechanical HVAC", normalizedKey: "mechanical hvac" });
assert.throws(() => normalizeTaxonomyTerm({ kind: "unknown", code: "BAD", label: "Bad" }), error => (error as { code?: string }).code === "KNOWLEDGE_TAXONOMY_INVALID");
assert.throws(() => normalizeTaxonomyTerm({ kind: "tag", code: "bad code", label: "Bad" }), error => (error as { code?: string }).code === "KNOWLEDGE_TAXONOMY_INVALID");

const route = readFileSync(new URL("../routes/coordination-knowledge.ts", import.meta.url), "utf8");
assert.match(route, /context\(req,"manage_taxonomy"\)/);
assert.match(route, /context\(req,"retire"\)/);
assert.match(route, /taxonomyRepository\.list\(resolved\.companyId/);
assert.doesNotMatch(route, /coordination-knowledge\/taxonomy[\s\S]{0,100}router\.delete/);

console.log("Build 269 governed taxonomy administration: PASS");
