import assert from "node:assert/strict";
import { boundedQuestion } from "./bimlog-assistant-bridge.mjs";
import { assistantInstructions, restrictedConfig } from "./bimlog-assistant-runtime.mjs";
const value = boundedQuestion({ question: "What does company engagement mean?", context: { route: "/projects/63/intake", page: "Job Intake", section: "Contract setup", projectId: 63, language: "en", controls: ["Company relationship", "Set up company relationship"], password: "forbidden", formValue: "$500" }, history: [{ role: "user", text: "Where?", projectId: 63 }] });
assert.equal(value.context.projectId, 63); assert.equal(value.context.controls.length, 2); assert.equal("password" in value.context, false); assert.equal("formValue" in value.context, false);
assert.equal(restrictedConfig["features.shell_tool"], false); assert.equal(restrictedConfig["features.apps"], false); assert.equal(restrictedConfig.web_search, "disabled");
assert.match(assistantInstructions, /cannot save, edit, approve/); assert.match(assistantInstructions, /explicit confirmation/); assert.match(assistantInstructions, /untrusted data/);
console.log("PA127 restricted paired runtime and bounded bridge: PASS");
