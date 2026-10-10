import assert from "node:assert/strict";
import fs from "node:fs";

for (const page of ["Terms.tsx", "Privacy.tsx", "Disclaimer.tsx"]) {
  const source = fs.readFileSync(new URL(`./${page}`, import.meta.url), "utf8");
  assert.match(source, /import \{ LegalSupplierIdentity \}/, `${page} imports the shared identity`);
  assert.match(source, /<LegalSupplierIdentity \/>/, `${page} renders the shared identity`);
}
const component = fs.readFileSync(new URL("../components/legal/LegalSupplierIdentity.tsx", import.meta.url), "utf8");
assert.match(component, /role="alert"/);
assert.match(component, /mailto:/);
assert.match(component, /Jurisdiction/);
assert.match(component, /Public contact/);
console.log("LR009 bilingual legal-page supplier identity continuity: PASS");
