import assert from "node:assert/strict";
import { productGlossary, productLabel, readableTechnicalCode } from "./product-glossary";

assert.equal(productLabel("jobIntake", "en"), "Project setup");
assert.equal(productLabel("jobIntake", "es"), "Configuración del proyecto");
assert.equal(productLabel("companiesAgreements", "en"), "Companies and agreements");
assert.equal(readableTechnicalCode("ACCESS_PROFILE_UNAVAILABLE"), "Access Profile Unavailable");
for (const term of Object.values(productGlossary)) {
  assert.ok(term.en.length > 2 && term.es.length > 2 && term.detail.length > 10);
}
console.log("post120 Build 187 bilingual product glossary: PASS");
