import assert from "node:assert/strict";
import { COMPANY_CATALOG_GUIDANCE, summarizeCompanyCatalog } from "./company-catalog-guidance";

assert.deepEqual(Object.keys(COMPANY_CATALOG_GUIDANCE), ["client", "discipline", "service", "phase"]);
for (const guidance of Object.values(COMPANY_CATALOG_GUIDANCE)) {
  assert.ok(guidance.purpose.en && guidance.purpose.es);
  assert.ok(guidance.usedBy.en && guidance.usedBy.es);
}
assert.deepEqual(summarizeCompanyCatalog([
  { state: "active" }, { state: "active" }, { state: "inactive" }, { state: "retired" },
]), { active: 2, inactive: 1, retired: 1, total: 4 });

console.log("GAUNTLET_COMPANY_CATALOG_BUILD91_RESULT=PASS");
