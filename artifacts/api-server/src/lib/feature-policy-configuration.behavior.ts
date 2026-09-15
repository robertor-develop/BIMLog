import assert from "node:assert/strict";
import { policyConfigurationDefinition } from "./feature-policy-configuration";

const fields = policyConfigurationDefinition("project.intake.configuration");
assert.deepEqual(fields.map((field) => field.key), ["delivery_method", "budget_governance_policy", "enforcement_mode"]);
assert.deepEqual(fields[0].options.map((item) => item.value), ["bim-submittal", "coordination-delivery", "document-control"]);
assert.deepEqual(fields[1].options.map((item) => item.value), ["standard", "pmo-controlled", "advisory"]);
assert.deepEqual(fields[2].options.map((item) => item.value), ["optional", "enforced"]);
assert.ok(fields.every((field) => field.label.en && field.label.es && field.description.en && field.description.es));
assert.deepEqual(policyConfigurationDefinition("rfi.core"), []);
console.log("feature-policy-configuration: PASS");
