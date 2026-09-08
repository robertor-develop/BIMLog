import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("./JobIntakeWorkspace.tsx", import.meta.url),
  "utf8",
);

assert.match(source, /bimlog:job-intake-active-stage:\$\{projectId\}/);
assert.match(source, /stages\.includes\(saved as IntakeStage\)/);
assert.match(source, /useState<IntakeStage>\(\(\) =>\s*readActiveStage\(projectId\)/);
assert.match(source, /preserveActiveStage\(projectId, key\)/);
assert.match(source, /if \(!intake\) return;\s*const restored = readActiveStage\(projectId\)/);
assert.match(source, /getElementById\(`ji-\$\{restored\}`\)/);
assert.doesNotMatch(source, /setActive\(key\);\s*document/);

console.log(
  "job-intake-navigation.behavior: PASS project-scoped refresh and return restoration",
);
