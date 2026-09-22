import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BIMTECH_COORDINATION_STARTER_LIBRARY as seed } from "./bimtech-coordination-starter-library";
import { deterministicStarterId, starterSeedFingerprint } from "./coordination-knowledge-starter-seed";
import { CoordinationStarterLibraryImporter } from "./coordination-knowledge-starter-import";
import type { KnowledgeRepositoryPool } from "./coordination-knowledge-repository";

const fingerprint = starterSeedFingerprint(seed);
assert.match(fingerprint, /^[a-f0-9]{64}$/);
assert.equal(seed.conflictTypes.length, 24);
assert.equal(seed.rules.length, 8);
assert.equal(seed.resolutionMethods.length, 8);

const companyOneId = deterministicStarterId(`${seed.seedKey}.1`, "conflict_type", seed.conflictTypes[0]!.code);
const companyTwoId = deterministicStarterId(`${seed.seedKey}.2`, "conflict_type", seed.conflictTypes[0]!.code);
assert.notEqual(companyOneId, companyTwoId, "organization-scoped identities must differ");
assert.equal(companyOneId, deterministicStarterId(`${seed.seedKey}.1`, "conflict_type", seed.conflictTypes[0]!.code), "reimport identity must be stable");

const importer = readFileSync(new URL("./coordination-knowledge-starter-import.ts", import.meta.url), "utf8");
assert.match(importer, /status: "imported" \| "idempotent_noop"/);
assert.match(importer, /WHERE company_id=\$1 AND code=\$2/);
assert.match(importer, /'draft'/);
assert.match(importer, /starter_seed_reimport_noop/);
assert.match(importer, /professionalApproval: "not_reviewed"/);
assert.doesNotMatch(importer, /DROP\s+(TABLE|COLUMN)|TRUNCATE|DELETE\s+FROM/i);

const route = readFileSync(new URL("../routes/coordination-knowledge.ts", import.meta.url), "utf8");
assert.match(route, /expectedFingerprint/);
assert.match(route, /context\(req,"manage_taxonomy"\)/);

class ImportFixture {
  bases = new Map<string,string>();
  ruleRevisions = new Map<string,string>();
  client = {
    query: async (sql:string,params:unknown[]=[]):Promise<{rows:Array<Record<string,unknown>>}> => {
      const compact=sql.replace(/\s+/g," ").trim();
      if (/^(BEGIN|COMMIT|ROLLBACK|SELECT pg_advisory_xact_lock)/.test(compact)) return {rows:[]};
      const select=compact.match(/^SELECT id FROM (coordination_conflict_types|coordination_rules|coordination_resolution_methods) WHERE company_id=\$1 AND code=\$2/);
      if(select){const key=`${select[1]}:${params[0]}:${params[1]}`;const id=this.bases.get(key);return {rows:id?[{id}]:[]};}
      const insert=compact.match(/^INSERT INTO (coordination_conflict_types|coordination_rules|coordination_resolution_methods)\(id,company_id,code,created_by_id\)/);
      if(insert){this.bases.set(`${insert[1]}:${params[1]}:${params[2]}`,String(params[0]));return {rows:[]};}
      if(compact.startsWith("INSERT INTO coordination_rule_revisions")){this.ruleRevisions.set(`${params[2]}:${params[1]}`,String(params[0]));return {rows:[]};}
      if(compact.startsWith("SELECT id FROM coordination_rule_revisions")){const id=this.ruleRevisions.get(`${params[0]}:${params[1]}`);return {rows:id?[{id}]:[]};}
      return {rows:[]};
    },
    release:()=>undefined,
  };
  pool:KnowledgeRepositoryPool={query:(sql,params)=>this.client.query(sql,params),connect:async()=>this.client};
}

const fixture=new ImportFixture(), importerInstance=new CoordinationStarterLibraryImporter(fixture.pool);
const first=await importerInstance.import(41,7,seed);
assert.equal(first.status,"imported");
assert.deepEqual(first.created,{conflictTypes:24,rules:8,resolutionMethods:8});
const reimport=await importerInstance.import(41,7,seed);
assert.equal(reimport.status,"idempotent_noop");
assert.deepEqual(reimport.existing,{conflictTypes:24,rules:8,resolutionMethods:8});
const otherTenant=await importerInstance.import(42,8,seed);
assert.equal(otherTenant.status,"imported");
assert.notEqual(deterministicStarterId(`${seed.seedKey}.41`,"conflict_type",seed.conflictTypes[0]!.code),deterministicStarterId(`${seed.seedKey}.42`,"conflict_type",seed.conflictTypes[0]!.code));

console.log(`Build 270 BIMTECH review package verification: PASS (${fingerprint})`);
