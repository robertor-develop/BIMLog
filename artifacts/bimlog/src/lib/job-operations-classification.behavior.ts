import assert from "node:assert/strict";
import fs from "node:fs";
import {
  emptyOperationsClassificationFilters,
  matchesOperationsClassification,
  operationsClassificationOptions,
} from "./job-operations-classification";

const records = [
  {
    disciplineId: "D-MECH",
    disciplineCode: "MECH",
    disciplineName: "Mechanical",
    serviceId: "S-SHOP",
    serviceCode: "SHOP",
    serviceName: "Shop Drawing",
    phaseId: "P-COORD",
    phaseCode: "COORD",
    phaseName: "Coordination",
  },
  {
    disciplineId: "D-MECH",
    disciplineCode: "MECH",
    disciplineName: "Mechanical",
    serviceId: "S-SLEEVE",
    serviceCode: "SLEEVE",
    serviceName: "Sleeves",
    phaseId: "P-PRELIM",
    phaseCode: "PRE",
    phaseName: "Preliminary",
  },
];

assert.deepEqual(operationsClassificationOptions(records, "discipline"), [
  { id: "D-MECH", code: "MECH", name: "Mechanical" },
]);
assert.equal(
  matchesOperationsClassification(records[0], {
    discipline: "D-MECH",
    service: "S-SHOP",
    phase: "P-COORD",
  }),
  true,
);
assert.equal(
  matchesOperationsClassification(records[0], {
    discipline: "D-MECH",
    service: "S-SLEEVE",
    phase: "",
  }),
  false,
);
assert.equal(
  matchesOperationsClassification(
    records[1],
    emptyOperationsClassificationFilters(),
  ),
  true,
);
const workspace = fs.readFileSync(
  new URL("../pages/JobOperationsWorkspace.tsx", import.meta.url),
  "utf8",
);
assert.match(workspace, /Filter operational work/);
assert.match(workspace, /classificationChips\(pkg\)/);
assert.match(workspace, /classificationChips\(task\)/);
assert.match(workspace, /classificationSummary\(task\)/);
assert.match(workspace, /classificationSummary\(pkg\)/);
console.log("Job Operations classification visibility and filtering: PASS");
