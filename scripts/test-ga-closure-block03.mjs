import { runNodeGate } from "./lib/observable-gate-runner.mjs";

for (const file of [
  "scripts/test-ga-closure-build011-protected-custody.mjs",
  "scripts/test-ga-closure-build012-temp-project-dry-run.mjs",
  "scripts/test-ga-closure-build014-publication-cadence.mjs",
  "scripts/test-ga-closure-build015-dossier.mjs",
]) runNodeGate(file);

console.log("GA-CLOSURE-BLOCK03 PASS: Builds 11, 12, 14 and 15 contracts verified; Build 13 release suite is independently invoked by test:ga-closure-build013");
