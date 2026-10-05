import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./Terms.tsx", import.meta.url), "utf8");
for (const required of [
  'legalDocument("terms").en',
  'legalDocument("terms").es',
  "Subscription and Payment",
  "Suscripción y Pago",
  "Governing Law",
  "Ley Aplicable",
  "Changes to These Terms",
  "Cambios a Estos Términos",
  '<LegalDocumentNav current="terms" />',
  '<main id="main-content"',
  '<article aria-labelledby="terms-title"',
]) assert.ok(source.includes(required), `Terms public contract includes ${required}`);
assert.equal((source.match(/info@ignitesmart\.ai/g) ?? []).length >= 2, true);
console.log("B307 complete bilingual public Terms path: PASS");
