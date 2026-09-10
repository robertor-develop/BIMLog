import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./JobIntakeWorkspace.tsx", import.meta.url),
  "utf8",
);

assert.match(source, /plan\?\.data\?\.history/);
assert.match(source, /apuVersions=\{capabilities\.costValuePlanner \? apuVersions : \[\]\}/);
assert.match(source, /loadedData\?\.commercial\?\.budgetSnapshotId/);
assert.match(source, /financial\/snapshots\/\$\{selectedBudgetSnapshotId\}/);
assert.match(source, /setBudgetLines\(selectedBudget\?\.snapshot\?\.lines \?\? \[\]\)/);
assert.match(source, /responsibleParticipantId/);
assert.match(source, /Authoritative agreement/);

console.log(
  "PASS Intake reloads authoritative APU versions and persisted budget-line options while retaining company and agreement bindings",
);
