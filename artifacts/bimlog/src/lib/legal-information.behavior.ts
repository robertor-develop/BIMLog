import assert from "node:assert/strict";
import fs from "node:fs";
import { LEGAL_DOCUMENTS, LEGAL_EFFECTIVE_DATE, legalDocument } from "./legal-information";

assert.deepEqual(LEGAL_DOCUMENTS.map(({ id, href }) => ({ id, href })), [
  { id: "terms", href: "/terms" },
  { id: "privacy", href: "/privacy" },
  { id: "legal-notice", href: "/legal-notice" },
]);
assert.equal(new Set(LEGAL_DOCUMENTS.map((entry) => entry.href)).size, 3);
assert.equal(legalDocument("legal-notice").es, "Aviso Legal");
assert.equal(LEGAL_EFFECTIVE_DATE.iso, "2026-03-21");
const nav = fs.readFileSync(new URL("../components/legal/LegalDocumentNav.tsx", import.meta.url), "utf8");
assert.match(nav, /aria-current="page"/);
assert.match(nav, /Legal documents/);
assert.match(nav, /Documentos legales/);
console.log("B306 governed public legal-information navigation: PASS");
