import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeJobIntakeData } from "./job-intake-contract";

const here = path.dirname(fileURLToPath(import.meta.url));
const intakeUi = fs.readFileSync(
  path.resolve(here, "../../../bimlog/src/pages/JobIntakeWorkspace.tsx"),
  "utf8",
);
const contract = fs.readFileSync(path.resolve(here, "./job-intake-contract.ts"), "utf8");

const emptyIntake = normalizeJobIntakeData({});
assert.equal(
  emptyIntake.delivery.workflowTemplate,
  "bim-submittal",
  "a new Intake must receive a usable BIMLog delivery default without a prerequisite library",
);

assert.match(intakeUi, /Delivery method/);
assert.match(intakeUi, /Método de entrega/);
assert.match(intakeUi, /ready-to-use delivery methods/);
assert.match(intakeUi, /configuraciones administradas por la empresa son opcionales/);
assert.match(intakeUi, /value="bim-submittal"/);
assert.match(intakeUi, /value="coordination-delivery"/);
assert.match(intakeUi, /value="document-control"/);

assert.match(contract, /\|\| DEFAULT_DELIVERY_METHOD/);
assert.doesNotMatch(contract, /template library.*required/i);
assert.doesNotMatch(intakeUi, /configure.*before.*intake/i);

console.log(JSON.stringify({
  status: "PASS",
  contract: "BIMLog defaults first; optional company configuration; no mandatory template prerequisite",
}));
