import assert from "node:assert/strict";
import { groundedAssistantAnswer, relevantBimlogKnowledge } from "./page-assistant-product-knowledge";

assert.match(relevantBimlogKnowledge("What is perspective?", ["Commitment / subcontract"], "en")[0], /contract direction/);
assert.match(relevantBimlogKnowledge("¿Qué es contraparte?", ["Contrato"], "es")[0], /otro lado de este contrato/);
assert.match(relevantBimlogKnowledge("Explain Company Engagement", [], "en")[0], /provides the service/);
assert.deepEqual(relevantBimlogKnowledge("Where is the save button?", ["Save now"], "en"), []);
assert.deepEqual(groundedAssistantAnswer("What is Counterparty?", ["Counterparty", "Perspective"], [], "en", "explain", null), {
  answer: "Counterparty means the company on the other side of this contract. Example: if your company is hired by Blis, choose Blis. This field is required for each contract profile. Use the visible “Counterparty” control to review or change this value.",
  highlightLabels: ["Counterparty"],
  grounding: "canonical-product-knowledge",
});
assert.match(groundedAssistantAnswer("What is missing?", [], ["6 required item(s) remaining", "Enter a positive unit rate for every scope item."], "en", "missing", null)?.answer || "", /Enter a positive unit rate/);
const highlightedMissing = groundedAssistantAnswer("What is missing?", ["Submittal strategy"], ["1 required item(s) remaining", "Describe the Submittal delivery strategy."], "en", "missing", null);
assert.deepEqual(highlightedMissing?.highlightLabels, ["Submittal strategy"]);
assert.match(groundedAssistantAnswer("What is missing?", [], ["Setup readiness 100 %", "Draft ready to activate", "Optional items remaining 4"], "en", "missing", null)?.answer || "", /No required setup is missing/);
assert.match(groundedAssistantAnswer("¿Qué falta completar en esta página?", ["Submittal strategy"], ["Borrador listo para activar", "Describe la estrategia de entrega de Submittals."], "es", "missing", null)?.answer || "", /No faltan requisitos obligatorios/);
const compactReadinessAnswer = groundedAssistantAnswer("What is missing?", [], [
  "6 required item(s) remaining",
  "Enter the negotiated number for every contract profile.",
  "Assign at least one Contract Item to every contract profile.",
  "Describe the Submittal delivery strategy.",
], "en", "missing", null)?.answer || "";
assert.doesNotMatch(compactReadinessAnswer, /Give each scope item a name, positive quantity and positive planned labor hours\./);
assert.match(compactReadinessAnswer, /inconsistent count/);
const spanishCompactReadinessAnswer = groundedAssistantAnswer("¿Qué falta?", [], [
  "6 required item(s) remaining",
  "Enter the negotiated number for every contract profile.",
], "es", "missing", null)?.answer || "";
assert.match(spanishCompactReadinessAnswer, /^6 elemento\(s\) obligatorio\(s\) pendiente\(s\)\./);
assert.doesNotMatch(spanishCompactReadinessAnswer, /required item\(s\) remaining/);
assert.match(spanishCompactReadinessAnswer, /conteo inconsistente/);
const mixedLanguageReadinessAnswer = groundedAssistantAnswer("What is missing?", [], [
  "6 elemento(s) obligatorio(s) pendiente(s)",
  "Describe the Submittal delivery strategy.",
], "en", "missing", null)?.answer || "";
assert.match(mixedLanguageReadinessAnswer, /^6 required item\(s\) remaining\./);
assert.match(mixedLanguageReadinessAnswer, /Describe the Submittal delivery strategy\./);
assert.match(mixedLanguageReadinessAnswer, /inconsistent count/);
assert.doesNotMatch(groundedAssistantAnswer("What is missing?", [], ["Perspective", "Commitment \/ subcontract"], "en", "missing", null)?.answer || "", /Perspective/);
const readinessAnswer = groundedAssistantAnswer("What is missing?", [], [
  "6 required item(s) remaining",
  "What remains for this section Enter the negotiated number for every contract profile. Assign at least one Contract Item to every contract profile.",
  "Enter the negotiated number for every contract profile.",
  "Assign at least one Contract Item to every contract profile.",
  "Give each scope item a name, positive quantity and positive planned labor hours.",
  "Enter a positive unit rate for every scope item.",
  "Describe the Submittal delivery strategy.",
  "Complete the required final confirmations.",
], "en", "missing", null)?.answer || "";
for (const requirement of [
  "Give each scope item a name, positive quantity and positive planned labor hours.",
  "Enter a positive unit rate for every scope item.",
  "Enter the negotiated number for every contract profile.",
  "Assign at least one Contract Item to every contract profile.",
  "Describe the Submittal delivery strategy.",
  "Complete the required final confirmations.",
]) assert.equal(readinessAnswer.split(requirement).length - 1, 1, `expected one canonical readiness item: ${requirement}`);
console.log("PASS BIMLog contextual product knowledge");
