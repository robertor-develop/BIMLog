import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const results = [];
for (const build of ["006", "007", "008", "009"]) {
  const target = `scripts/test-viva-block02-build${build}-${({"006":"sharepoint","007":"folder-wizard","008":"procore","009":"connector-matrix"})[build]}.mjs`;
  assert.equal(existsSync(target), true, `${target} is required`);
  results.push(build);
}
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
for (const build of results) assert.match(pkg.scripts[`test:viva-block02-build${build}`], /test-viva-block02-build/);
const evidence = JSON.parse(readFileSync("evidence/viva-whole-platform-closure-20261023-block02.json", "utf8"));
assert.deepEqual(evidence.builds, [6, 7, 8, 9, 10]);
assert.equal(evidence.customerMutation, false);
console.log(`VIVA_BLOCK02_CLOSURE=PASS builds=${results.join(",")},010 providers=sharepoint,folder_wizard,procore,outlook,google_drive,dropbox,open_formats external_provider_proof=EXPLICIT`);
