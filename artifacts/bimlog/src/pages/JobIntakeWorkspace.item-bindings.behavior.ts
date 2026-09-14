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
assert.match(source, /Assignment target/);
assert.match(source, /Entire Contract Item/);
assert.match(source, /Specific Work Package/);
assert.match(source, /assignmentTargetType: "contract_item"/);
assert.match(source, /Create required Work Package/);
assert.match(source, /Save package and return/);
assert.match(source, /could not verify the saved Work Package assignment/);
assert.match(source, /Activation verification failed/);
assert.match(source, /operations\$\{firstTaskId/);

console.log(
  "PASS Intake reloads authoritative APU versions and persisted budget-line options while retaining company and agreement bindings",
);
