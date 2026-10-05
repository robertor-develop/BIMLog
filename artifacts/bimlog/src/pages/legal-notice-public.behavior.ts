import assert from "node:assert/strict";
import fs from "node:fs";

const notice = fs.readFileSync(new URL("./Disclaimer.tsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const footer = fs.readFileSync(new URL("../components/layout/Footer.tsx", import.meta.url), "utf8");
for (const required of [
  'legalDocument("legal-notice").en',
  'legalDocument("legal-notice").es',
  "BIMLog Is Not a Legal Authority",
  "BIMLog No Es una Autoridad Legal",
  "Informational Records Only",
  "Solo Registros Informativos",
  "Use in Legal Proceedings",
  "Uso en Procedimientos Legales",
  '<LegalDocumentNav current="legal-notice" />',
]) assert.ok(notice.includes(required), `Legal Notice public contract includes ${required}`);
assert.match(app, /path="\/legal-notice" component=\{Disclaimer\}/);
assert.match(app, /path="\/disclaimer" component=\{Disclaimer\}/, "legacy URL remains readable");
assert.match(footer, /hoverLink\("\/legal-notice"/);
console.log("B309 canonical bilingual public Legal Notice path: PASS");
