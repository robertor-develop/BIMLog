import assert from "node:assert/strict";
import { buildMigrationCatalog, readMigrationCatalog } from "./migration-catalog-truth.mjs";

const safe = buildMigrationCatalog({ files: [{ name: "alpha-migration.ts", source: "CREATE TABLE IF NOT EXISTS alpha" }], startupSource: "import './lib/alpha-migration'" });
assert.deepEqual(safe.missingStartupReferences, []);
assert.deepEqual(safe.destructiveMigrations, []);
assert.deepEqual(buildMigrationCatalog({ files: [{ name: "alpha-migration.ts", source: "DROP TABLE alpha" }], startupSource: "" }).destructiveMigrations, ["alpha-migration.ts"]);
const actual = readMigrationCatalog(new URL("..", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)));
assert.ok(actual.migrations.length >= 10);
assert.deepEqual(actual.destructiveMigrations, []);
assert.deepEqual(actual.missingStartupReferences, []);
console.log(`MIGRATION_CATALOG_TRUTH=PASS migrations=${actual.migrations.length} catalog=${actual.catalogSha256}`);
