import assert from "node:assert/strict";
import { relevantBimlogKnowledge } from "./page-assistant-product-knowledge";

assert.match(relevantBimlogKnowledge("What is perspective?", ["Commitment / subcontract"], "en")[0], /contract direction/);
assert.match(relevantBimlogKnowledge("¿Qué es contraparte?", ["Contrato"], "es")[0], /otra empresa legal/);
assert.match(relevantBimlogKnowledge("Explain Company Engagement", [], "en")[0], /provides the service/);
assert.deepEqual(relevantBimlogKnowledge("Where is the save button?", ["Save now"], "en"), []);
console.log("PASS BIMLog contextual product knowledge");
