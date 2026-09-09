import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ENTERPRISE_IDENTITY_MIGRATION_SQL,
  ensureEnterpriseIdentitySchema,
} from "./enterprise-identity-migration";

const ddl = ENTERPRISE_IDENTITY_MIGRATION_SQL;

for (const table of [
  "enterprise_contacts",
  "project_company_relationships",
  "project_contact_relationships",
  "enterprise_trades",
  "company_trade_relationships",
  "contract_party_relationships",
]) {
  assert.match(ddl, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
}

assert.match(ddl, /relationship_type IN \('client','owner','general_contractor','service_provider','trade_contractor','consultant','vendor','partner','authority','other'\)/);
assert.match(ddl, /project_contact_relationship_contact_company_fk FOREIGN KEY\(contact_id,company_id\)/);
assert.match(ddl, /company_trade_relationship_project_company_fk FOREIGN KEY\(project_company_relationship_id,project_id,company_id\)/);
assert.match(ddl, /contract_party_relationship_contract_project_fk FOREIGN KEY\(contract_id,project_id\)/);

for (const constraint of [
  "files_parent_same_project_fk",
  "files_superseded_same_project_fk",
  "rfis_parent_same_project_fk",
  "rfis_revision_same_project_fk",
  "submittals_parent_same_project_fk",
]) {
  assert.match(ddl, new RegExp(`${constraint}[\\s\\S]+NOT VALID`));
}

assert.doesNotMatch(ddl, /DROP\s+(TABLE|COLUMN|CONSTRAINT)|TRUNCATE|DELETE\s+FROM/i);

const executed: string[] = [];
let released = false;
await ensureEnterpriseIdentitySchema({
  connect: async () => ({
    query: async (sql: string) => { executed.push(sql); },
    release: () => { released = true; },
  }),
});
assert.equal(executed[0], "BEGIN");
assert.match(executed[1] ?? "", /pg_advisory_xact_lock/);
assert.equal(executed[2], ddl);
assert.equal(executed[3], "COMMIT");
assert.equal(released, true);

const failed: string[] = [];
let failureReleased = false;
await assert.rejects(() => ensureEnterpriseIdentitySchema({
  connect: async () => ({
    query: async (sql: string) => {
      failed.push(sql);
      if (sql === ddl) throw new Error("forced migration failure");
    },
    release: () => { failureReleased = true; },
  }),
}));
assert.equal(failed.at(-1), "ROLLBACK");
assert.equal(failureReleased, true);

const schemaRoot = new URL("../../../../lib/db/src/schema/", import.meta.url);
const filesSchema = readFileSync(new URL("files.ts", schemaRoot), "utf8");
const rfiSchema = readFileSync(new URL("rfis.ts", schemaRoot), "utf8");
const submittalSchema = readFileSync(new URL("submittals.ts", schemaRoot), "utf8");
assert.match(filesSchema, /files_parent_same_project_fk/);
assert.match(filesSchema, /files_superseded_same_project_fk/);
assert.match(rfiSchema, /rfis_parent_same_project_fk/);
assert.match(rfiSchema, /rfis_revision_same_project_fk/);
assert.match(submittalSchema, /submittals_parent_same_project_fk/);

console.log("enterprise identity migration behavior: PASS");
