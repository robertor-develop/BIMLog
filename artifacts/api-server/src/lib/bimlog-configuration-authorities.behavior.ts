import assert from "node:assert/strict";
import { BIMLOG_CONFIGURATION_AUTHORITIES, configurationAuthority } from "./bimlog-configuration-authorities";
import { MASTER_CATALOG_AUTHORITY } from "./master-catalog-authority";

assert.equal(configurationAuthority("client").source, MASTER_CATALOG_AUTHORITY.client.source);
assert.equal(configurationAuthority("discipline").source, MASTER_CATALOG_AUTHORITY.discipline.source);
assert.equal(configurationAuthority("service").source, MASTER_CATALOG_AUTHORITY.service.source);
assert.equal(configurationAuthority("phase").source, MASTER_CATALOG_AUTHORITY.phase.source);
assert.equal(configurationAuthority("pricing").scope, "contract");
assert.equal(configurationAuthority("pricing").intakeRole, "reference");
assert.equal(configurationAuthority("budgetGovernance").intakeRole, "reference_and_snapshot");
assert.equal(Object.keys(BIMLOG_CONFIGURATION_AUTHORITIES).length, 7);

const sources = Object.values(BIMLOG_CONFIGURATION_AUTHORITIES).map((entry) => entry.source);
assert.equal(new Set(sources).size, sources.length, "each concept must retain one explicit authority");

console.log("BIMLog configuration authority inventory: PASS");
