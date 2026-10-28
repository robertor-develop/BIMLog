import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const authority = JSON.parse(fs.readFileSync(path.join(root, "contracts/company-selector-authority.json"), "utf8"));
assert.equal(authority.schemaVersion, "bimlog-company-selector-authority-v1");
assert.equal(authority.canonicalCompanyId, 31);
assert.deepEqual(authority.retiredAliases, [{ companyId: 35, retiredIntoCompanyId: 31 }]);
assert.deepEqual(authority.unresolvedCompanies, [{ companyId: 38, rule: "identity_evidence_required_before_merge" }]);
assert.equal(authority.selectionRules.operationalLists, "exclude_retired_aliases");
assert.equal(authority.selectionRules.membership, "never_inferred_from_alias_or_name");
assert.equal(authority.selectionRules.newCompany, "allow_distinct_identity_reject_collision_with_join_guidance");
assert.equal(new Set(authority.negativeNameVariants).size, 5);

const identitySource = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/company-identity.ts"), "utf8");
assert.match(identitySource, /depth < 16/);
assert.match(identitySource, /COMPANY_IDENTITY_MISSING/);
assert.match(identitySource, /COMPANY_IDENTITY_DEPTH_EXCEEDED/);
assert.match(identitySource, /COMPANY_JOIN_REQUIRED/);
assert.match(identitySource, /Distinct New Company|assertNewCompanyName/);
const routes = ["company-master-catalogs.ts", "master-catalogs.ts"]
  .map(name => fs.readFileSync(path.join(root, "artifacts/api-server/src/routes", name), "utf8"))
  .join("\n");
assert.match(routes, /retired_into_company_id/);
console.log("BLOCK01_BUILD003=PASS aliases=1 unresolved=1 negative_variants=5 genuine_new_company=allowed");
