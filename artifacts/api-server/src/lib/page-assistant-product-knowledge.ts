export type AssistantKnowledgeEntry = { terms: string[]; en: string; es: string };
export type GroundedAssistantAnswer = { answer: string; highlightLabels: string[]; grounding: "canonical-product-knowledge" | "visible-page-readiness" };

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

const readinessRequirements = [
  { patterns: [/scope item.*positive quantity.*planned labor hours/i, /elemento.*alcance.*cantidad positiva.*horas/i], en: "Give each scope item a name, positive quantity and positive planned labor hours.", es: "Asigna a cada elemento de alcance un nombre, una cantidad positiva y horas de trabajo planificadas positivas." },
  { patterns: [/positive unit rate.*scope item/i, /precio unitario positivo/i], en: "Enter a positive unit rate for every scope item.", es: "Ingresa un precio unitario positivo para cada elemento de alcance." },
  { patterns: [/negotiated number.*contract profile/i, /n[uú]mero negociado.*perfil/i], en: "Enter the negotiated number for every contract profile.", es: "Ingresa el número negociado para cada perfil de contrato." },
  { patterns: [/assign at least one contract item.*contract profile/i, /asign.*contract item.*perfil/i], en: "Assign at least one Contract Item to every contract profile.", es: "Asigna al menos un Contract Item a cada perfil de contrato." },
  { patterns: [/describe the submittal delivery strategy/i, /estrategia.*submittal/i], en: "Describe the Submittal delivery strategy.", es: "Describe la estrategia de entrega de Submittals." },
  { patterns: [/complete the required final confirmations/i, /confirmaciones finales requeridas/i], en: "Complete the required final confirmations.", es: "Completa las confirmaciones finales requeridas." },
];

export function groundedAssistantAnswer(
  question: string,
  controls: string[],
  pageText: string[],
  language: "en" | "es",
  requestedAction: "explain" | "locate" | "missing",
  locatedControl: string | null,
): GroundedAssistantAnswer | null {
  const spanish = language === "es";
  if (requestedAction === "missing") {
    const remaining = readinessRequirements
      .filter(requirement => pageText.some(line => requirement.patterns.some(pattern => pattern.test(line))))
      .map(requirement => spanish ? requirement.es : requirement.en);
    const count = pageText.find(line => /\d+ required item\(s\) remaining|\d+ elemento\(s\) requerido/i.test(line));
    if (!remaining.length && !count) return null;
    const intro = spanish ? "La página muestra estos requisitos pendientes:" : "The page shows these requirements still pending:";
    const details = remaining.length ? remaining.map(line => `• ${line}`).join(" ") : (spanish ? "Revisa la lista visible «Pendiente» en esta página." : "Review the visible “Still required” list on this page.");
    return { answer: `${count ? `${count}. ` : ""}${intro} ${details}`, highlightLabels: [], grounding: "visible-page-readiness" };
  }

  const normalized = question.toLocaleLowerCase(spanish ? "es" : "en");
  const entry = BIMLOG_PAGE_ASSISTANT_KNOWLEDGE.find(item => item.terms.some(term => normalized.includes(term)));
  if (!entry) return null;
  const explanation = spanish ? entry.es : entry.en;
  const exactControl = locatedControl || controls.find(label => entry.terms.some(term => label.toLocaleLowerCase(spanish ? "es" : "en").includes(term))) || null;
  const next = exactControl
    ? (spanish ? `Usa el control visible «${exactControl}» para revisar o cambiar este valor.` : `Use the visible “${exactControl}” control to review or change this value.`)
    : (spanish ? "No hay un control visible con ese nombre en la sección actual." : "There is no visible control with that name in the current section.");
  return { answer: `${explanation} ${next}`, highlightLabels: exactControl ? [exactControl] : [], grounding: "canonical-product-knowledge" };
}
