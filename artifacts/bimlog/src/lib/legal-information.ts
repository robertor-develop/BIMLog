export type LegalDocumentId = "terms" | "privacy" | "legal-notice";

export const LEGAL_EFFECTIVE_DATE = Object.freeze({
  iso: "2026-03-21",
  en: "March 21, 2026",
  es: "21 de marzo de 2026",
});

export const LEGAL_DOCUMENTS = Object.freeze([
  Object.freeze({ id: "terms" as const, href: "/terms", en: "Terms of Service", es: "Términos de Servicio" }),
  Object.freeze({ id: "privacy" as const, href: "/privacy", en: "Privacy Policy", es: "Política de Privacidad" }),
  Object.freeze({ id: "legal-notice" as const, href: "/legal-notice", en: "Legal Notice", es: "Aviso Legal" }),
]);

export function legalDocument(id: LegalDocumentId) {
  const document = LEGAL_DOCUMENTS.find((entry) => entry.id === id);
  if (!document) throw new Error(`Unknown legal document: ${id}`);
  return document;
}
