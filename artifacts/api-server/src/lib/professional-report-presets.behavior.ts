import assert from "node:assert/strict";
import { governProfessionalReportPreset } from "./professional-report-presets";

const preset = { id: "client-weekly", tenantId: 31, projectId: 26, name: "Weekly client report", purpose: "Weekly coordination decision record", logoAssetId: "logo-31", sections: ["coordination", "rfi", "submittal", "meetings", "baseline"] as const };
const actor = { tenantId: 31, projectIds: [26], permissions: ["rfi:read", "meeting:read"] };
const governed = governProfessionalReportPreset(preset, actor);
assert.deepEqual(governed.sections, ["identity", "coordination", "rfi", "meetings"], "permission-sensitive sections must be omitted safely");
assert.equal(governProfessionalReportPreset(preset, actor).presetFingerprint, governed.presetFingerprint);
assert.throws(() => governProfessionalReportPreset(preset, { ...actor, tenantId: 35 }), /REPORT_PRESET_SCOPE_DENIED/);
console.log("C046 governed company/project report presets: PASS");
