import assert from "node:assert/strict";
import { classifyAssistantAction, locateVisibleControl } from "./page-assistant-actions";

assert.equal(classifyAssistantAction("Show me where Perspective is"), "locate");
assert.equal(classifyAssistantAction("What is missing?"), "missing");
assert.equal(classifyAssistantAction("What is Counterparty?"), "explain");
assert.equal(locateVisibleControl("Show me where Perspective is", ["Counterparty", "Perspective", "Contract type"], null), "Perspective");
assert.equal(locateVisibleControl("Muéstrame dónde está Contraparte", ["Contraparte", "Perspectiva"], null), "Contraparte");
assert.equal(locateVisibleControl("Show me where", ["Perspective"], null), null);
console.log("PASS contextual assistant action resolution");
