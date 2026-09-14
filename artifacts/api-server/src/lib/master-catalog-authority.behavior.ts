import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MASTER_CATALOG_AUTHORITY, masterCatalogAuthority } from "./master-catalog-authority";

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.resolve(here, "../../../../lib/db/src/schema/enterprise-identity.ts"), "utf8");

assert.equal(masterCatalogAuthority("client").source, "companies");
assert.equal(masterCatalogAuthority("discipline").source, "enterprise_trades");
assert.match(schema, /export const projectCompanyRelationshipsTable/);
assert.match(schema, /relationshipType[^\n]+notNull/);
assert.match(schema, /export const enterpriseTradesTable/);
assert.equal(new Set(Object.values(MASTER_CATALOG_AUTHORITY).map((entry) => entry.source)).size, 4);

console.log("master catalog authority reconciliation: PASS");
