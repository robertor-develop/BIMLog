import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./CompanyMasterCatalogsTab.tsx", import.meta.url), "utf8");
assert.match(source, /Where related setup belongs/);
assert.match(source, /href="\/company-workflows"/);
assert.match(source, /href="\/company-workflow-governance"/);
assert.match(source, /href="\/company-pricing-templates"/);
assert.match(source, /Directory & administration → Convention Builder/);
assert.match(source, /Document types, locations, metadata, and naming/);
assert.match(source, /versioned in each project's Convention Builder/);

console.log("GAUNTLET_COMPANY_CATALOG_BUILD94_RESULT=PASS");
