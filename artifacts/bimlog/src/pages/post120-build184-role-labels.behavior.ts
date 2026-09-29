import assert from "node:assert/strict";
import { effectiveRoleLabel } from "./settings-experience";
assert.deepEqual(effectiveRoleLabel("project_admin"), { effective: "Project administrator", legacy: null });
assert.deepEqual(effectiveRoleLabel("legacy_bim_lead"), { effective: "Project member", legacy: "legacy_bim_lead" });
assert.equal(effectiveRoleLabel("super_admin").effective, "Global super administrator");
assert.equal(effectiveRoleLabel(null).effective, "Project member");
console.log("post120 Build 184 effective role labels: PASS");
