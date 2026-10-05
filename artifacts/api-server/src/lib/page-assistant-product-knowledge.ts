export type AssistantKnowledgeEntry = { terms: string[]; en: string; es: string };

export const BIMLOG_PAGE_ASSISTANT_KNOWLEDGE: AssistantKnowledgeEntry[] = [
  { terms: ["perspective", "perspectiva"], en: "Perspective classifies the contract direction: Owner / prime contract is money owed to the service provider; Commitment / subcontract is money the project owes to a vendor, consultant, or subcontractor.", es: "Perspectiva clasifica la dirección del contrato: Contrato principal / cliente es dinero adeudado al proveedor del servicio; Compromiso / subcontrato es dinero que el proyecto debe a un proveedor, consultor o subcontratista." },
  { terms: ["counterparty", "contraparte"], en: "Counterparty is the other legal company signing or performing under this specific contract profile.", es: "Contraparte es la otra empresa legal que firma o cumple este perfil de contrato específico." },
  { terms: ["company engagement", "service relationship", "relación de servicio", "vínculo empresarial"], en: "Company Engagement records which company provides the service and which company hires it. In Job Intake it is optional and must be selected explicitly; BIMLog does not connect companies automatically.", es: "Company Engagement registra qué empresa presta el servicio y cuál la contrata. En Job Intake es opcional y debe seleccionarse explícitamente; BIMLog no conecta empresas automáticamente." },
  { terms: ["apu", "unit rate", "precio unitario"], en: "An APU is a controlled unit-price analysis. A Contract Item uses the explicitly linked compatible APU version or its saved editable unit rate; BIMLog must not substitute another project's APU.", es: "Un APU es un análisis controlado de precio unitario. Un Contract Item usa la versión compatible vinculada explícitamente o su precio unitario guardado; BIMLog no debe sustituir el APU de otro proyecto." },
];

export function relevantBimlogKnowledge(question: string, pageText: string[], language: "en" | "es"): string[] {
  const source = `${question} ${pageText.join(" ")}`.toLocaleLowerCase(language === "es" ? "es" : "en");
  return BIMLOG_PAGE_ASSISTANT_KNOWLEDGE
    .filter(entry => entry.terms.some(term => source.includes(term)))
    .slice(0, 5)
    .map(entry => language === "es" ? entry.es : entry.en);
}
