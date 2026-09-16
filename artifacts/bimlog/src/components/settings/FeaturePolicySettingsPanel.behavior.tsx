import assert from "node:assert/strict";
import fs from "node:fs";
import { updatePolicyConfiguration } from "./feature-policy-configuration-ui";

assert.deepEqual(updatePolicyConfiguration({ delivery_method: "bim-submittal" }, "enforcement_mode", "enforced"), { delivery_method: "bim-submittal", enforcement_mode: "enforced" });
assert.deepEqual(updatePolicyConfiguration({ delivery_method: "bim-submittal", enforcement_mode: "enforced" }, "enforcement_mode", ""), { delivery_method: "bim-submittal" });
const source=fs.readFileSync(new URL("./FeaturePolicySettingsPanel.tsx",import.meta.url),"utf8");
assert.match(source,/Inherit company \/ BIMLog default/);
assert.match(source,/Use BIMLog default/);
assert.match(source,/Saving did not activate or run the project/);
assert.doesNotMatch(source,/configuration:\{\}/);
console.log("FeaturePolicySettingsPanel.behavior: PASS");
