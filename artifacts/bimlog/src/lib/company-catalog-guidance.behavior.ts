import assert from "node:assert/strict";
import { COMPANY_CATALOG_GUIDANCE, filterCompanyCatalogEntries, summarizeCompanyCatalog, validateCompanyCatalogDraft } from "./company-catalog-guidance";

assert.deepEqual(Object.keys(COMPANY_CATALOG_GUIDANCE), ["client", "discipline", "service", "phase"]);
for (const guidance of Object.values(COMPANY_CATALOG_GUIDANCE)) {
  assert.ok(guidance.purpose.en && guidance.purpose.es);
  assert.ok(guidance.usedBy.en && guidance.usedBy.es);
}
assert.deepEqual(summarizeCompanyCatalog([
  { state: "active" }, { state: "active" }, { state: "inactive" }, { state: "retired" },
]), { active: 2, inactive: 1, retired: 1, total: 4 });
const entries = [
  { code: "ARC", name: "Architecture", aliases: ["Architectural"], state: "active" as const },
  { code: "MEP", name: "Building services", aliases: ["Mechanical"], state: "inactive" as const },
];
assert.deepEqual(filterCompanyCatalogEntries(entries, "mechanical", "all"), [entries[1]]);
assert.deepEqual(filterCompanyCatalogEntries(entries, "", "active"), [entries[0]]);
assert.deepEqual(filterCompanyCatalogEntries(entries, "missing", "all"), []);
assert.equal(validateCompanyCatalogDraft({ code: "", name: "Valid", aliases: "" }), "code_required");
assert.equal(validateCompanyCatalogDraft({ code: "BAD CODE", name: "Valid", aliases: "" }), "code_format");
assert.equal(validateCompanyCatalogDraft({ code: "ARC", name: "", aliases: "" }), "name_required");
assert.equal(validateCompanyCatalogDraft({ code: "ARC", name: "Architecture", aliases: "Architectural, Design" }), null);
assert.equal(validateCompanyCatalogDraft({ code: "ARC", name: "Architecture", aliases: Array.from({ length: 21 }, (_, index) => `Alias ${index}`).join(",") }), "aliases_limit");

console.log("GAUNTLET_COMPANY_CATALOG_BUILD91_RESULT=PASS");
