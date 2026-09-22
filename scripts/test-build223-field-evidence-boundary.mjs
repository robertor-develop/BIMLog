import assert from "node:assert/strict";
import fs from "node:fs";

const open = JSON.parse(fs.readFileSync("living-brief/OPEN_LOOP_DISPOSITIONS.json", "utf8"));
const field = JSON.parse(fs.readFileSync("evidence/stabilization-program-20260919/LENS_NEXT_FIELD_EVIDENCE.json", "utf8"));
const current = open.items.filter((item) => item.currentAuthority && item.classification === "ACTIVE");
const currentField = current.filter((item) => item.workClass === "FIELD_EVIDENCE");
const currentProvider = current.filter((item) => item.workClass === "PROVIDER_EVIDENCE");

assert.equal(currentField.length, 1);
assert.match(currentField[0].statement, /Navisworks 2025/);
assert.match(currentField[0].statement, /Ruben/);
assert.equal(currentProvider.length, 1);
assert.match(currentProvider[0].statement,/Build 265/);
assert.equal(field.installed2021.retiredDirectLoad.state, "REMOVED_WITH_ROLLBACK_EVIDENCE");
assert.equal(field.installed2021.retiredDirectLoad.activeAfterCutover, false);
assert.equal(field.workflowAndRollback.physical2021InstalledTopology, "PASS_PULSE_AND_LENS_NEXT_ONLY");
assert.equal(field.rubenPhysical2025.status, "DEFERRED_TO_RUBEN");
assert.equal(field.rubenPhysical2025.reopensBuild119, false);
assert.equal(field.rubenPhysical2025.blocksPlatformPublication, false);

console.log(`BUILD223_FIELD_EVIDENCE_BOUNDARY=PASS currentOpen=${current.length} currentProvider=${currentProvider.length} currentField=1 physical2021=PASS physical2025=DEFERRED_TO_RUBEN`);
