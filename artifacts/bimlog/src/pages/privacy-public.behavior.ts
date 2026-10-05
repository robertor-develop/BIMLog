import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./Privacy.tsx", import.meta.url), "utf8");
for (const required of [
  'legalDocument("privacy").en',
  'legalDocument("privacy").es',
  "What Data We Collect",
  "Qué Datos Recopilamos",
  "Project File Storage",
  "Almacenamiento de Archivos de Proyecto",
  "Your Rights",
  "Sus Derechos",
  "Third Party Services",
  "Servicios de Terceros",
  '<LegalDocumentNav current="privacy" />',
  '<article aria-labelledby="privacy-title"',
]) assert.ok(source.includes(required), `Privacy public contract includes ${required}`);
assert.match(source, /We do not sell your data to any third party/);
assert.match(source, /No vendemos sus datos a ningún tercero bajo ninguna circunstancia/);
console.log("B308 complete bilingual public Privacy path: PASS");
