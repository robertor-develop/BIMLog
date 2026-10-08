import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { activeIntakeConfirmationLabel, activeIntakeEditGuidance, activeIntakeNextActions } from "./job-intake-active-review";

const workspace = readFileSync(new URL("../pages/JobIntakeWorkspace.tsx", import.meta.url), "utf8");

assert.match(activeIntakeEditGuidance(true, "en"), /source evidence/);
assert.match(activeIntakeEditGuidance(false, "es"), /no vuelven a crear ni reemplazan/);
assert.equal(activeIntakeConfirmationLabel("es"), "Confirmaciones registradas al activar");
assert.deepEqual(activeIntakeNextActions(42, false).map(item => item.href), ["/projects/42/operations"]);
assert.deepEqual(activeIntakeNextActions(42, true).map(item => item.href), ["/projects/42/operations", "/projects/42/financial/contracts"]);
assert.match(workspace, /disabled=\{canonicalReadOnly\}/);
assert.match(workspace, /Continue active work/);
assert.match(workspace, /does not duplicate work items, tasks, staffing, or activation/);

console.log("Flow continuity block 09: active Intake evidence and next-action continuity PASS");
