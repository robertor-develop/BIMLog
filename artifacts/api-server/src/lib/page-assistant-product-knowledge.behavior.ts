import assert from "node:assert/strict";
import { groundedAssistantAnswer, relevantBimlogKnowledge } from "./page-assistant-product-knowledge";

assert.match(relevantBimlogKnowledge("What is perspective?", ["Commitment / subcontract"], "en")[0], /contract direction/);
assert.match(relevantBimlogKnowledge("¿Qué es contraparte?", ["Contrato"], "es")[0], /otra empresa legal/);
assert.match(relevantBimlogKnowledge("Explain Company Engagement", [], "en")[0], /provides the service/);
assert.deepEqual(relevantBimlogKnowledge("Where is the save button?", ["Save now"], "en"), []);
assert.deepEqual(groundedAssistantAnswer("What is Counterparty?", ["Counterparty", "Perspective"], [], "en", "explain", null), {
  answer: "Counterparty is the other legal company signing or performing under this specific contract profile. Use the visible “Counterparty” control to review or change this value.",
  highlightLabels: ["Counterparty"],
  grounding: "canonical-product-knowledge",
});
assert.match(groundedAssistantAnswer("What is missing?", [], ["6 required item(s) remaining", "Enter a positive unit rate for every scope item."], "en", "missing", null)?.answer || "", /Enter a positive unit rate/);
assert.doesNotMatch(groundedAssistantAnswer("What is missing?", [], ["Perspective", "Commitment \/ subcontract"], "en", "missing", null)?.answer || "", /Perspective/);
console.log("PASS BIMLog contextual product knowledge");
