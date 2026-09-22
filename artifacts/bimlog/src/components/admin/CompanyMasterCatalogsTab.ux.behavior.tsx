import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./CompanyMasterCatalogsTab.tsx", import.meta.url), "utf8");
assert.match(source, /selectedKind/);
assert.match(source, /aria-pressed=\{selectedKind === kind\}/);
assert.match(source, /Company catalog sections/);
assert.match(source, /position: "sticky"/);
assert.match(source, /kinds\.filter\(kind => kind === selectedKind\)/);
assert.match(source, /View usage/);
assert.match(source, /intakeCount/);
assert.match(source, /workPackageCount/);
assert.match(source, /role="alert"/);

console.log("EDT_ENGINE_BUILD284_RESULT=PASS");
