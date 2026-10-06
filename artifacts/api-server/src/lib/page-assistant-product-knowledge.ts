export type AssistantKnowledgeEntry = { terms: string[]; en: string; es: string };
export type GroundedAssistantAnswer = { answer: string; highlightLabels: string[]; grounding: "canonical-product-knowledge" | "visible-page-readiness" };

export const BIMLOG_PAGE_ASSISTANT_KNOWLEDGE: AssistantKnowledgeEntry[] = [
  { terms: ["perspective", "perspectiva"], en: "Perspective classifies the contract direction: Owner / prime contract is money owed to the service provider; Commitment / subcontract is money the project owes to a vendor, consultant, or subcontractor.", es: "Perspectiva clasifica la dirección del contrato: Contrato principal / cliente es dinero adeudado al proveedor del servicio; Compromiso / subcontrato es dinero que el proyecto debe a un proveedor, consultor o subcontratista." },
  { terms: ["counterparty", "contraparte"], en: "Counterparty means the company on the other side of this contract. Example: if your company is hired by Blis, choose Blis. This field is required for each contract profile.", es: "Contraparte significa la empresa que está al otro lado de este contrato. Ejemplo: si Blis contrata a su empresa, seleccione Blis. Este campo es obligatorio para cada perfil de contrato." },
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
  { patterns: [/scope item.*positive quantity.*planned labor hours/i, /elemento.*alcance.*cantidad positiva.*horas/i], labels: ["Contract Item Name row 1", "Quantity row 1", "Planned labor hours row 1"], en: "Give each scope item a name, positive quantity and positive planned labor hours.", es: "Asigna a cada elemento de alcance un nombre, una cantidad positiva y horas de trabajo planificadas positivas." },
  { patterns: [/positive unit rate.*scope item/i, /precio unitario positivo/i], labels: ["Unit rate row 1"], en: "Enter a positive unit rate for every scope item.", es: "Ingresa un precio unitario positivo para cada elemento de alcance." },
  { patterns: [/negotiated number.*contract profile/i, /n[uú]mero negociado.*perfil/i], labels: ["Contract / PO number", "Quotation number"], en: "Enter the negotiated number for every contract profile.", es: "Ingresa el número negociado para cada perfil de contrato." },
  { patterns: [/assign at least one contract item.*contract profile/i, /asign.*contract item.*perfil/i], labels: ["Authoritative agreement", "Contract Item agreement assignment"], en: "Assign at least one Contract Item to every contract profile.", es: "Asigna al menos un Contract Item a cada perfil de contrato." },
  { patterns: [/describe the submittal delivery strategy/i, /estrategia.*submittal/i], labels: ["Submittal strategy"], en: "Describe the Submittal delivery strategy.", es: "Describe la estrategia de entrega de Submittals." },
  { patterns: [/complete the required final confirmations/i, /confirmaciones finales requeridas/i], labels: ["Scope and planned hours are correct.", "APU references and Contract Item unit rates are correct.", "Contract terms and budget mappings are correct.", "Delivery workflow is correct."], en: "Complete the required final confirmations.", es: "Completa las confirmaciones finales requeridas." },
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
    // The canonical page readiness state outranks instructional copy elsewhere
    // on the page. A ready Intake can still display labels and explanatory
    // sentences for completed fields; those must never be reclassified as
    // missing requirements.
    const ready = pageText.some(line => /draft ready to activate|borrador listo para activar/i.test(line))
      || pageText.some(line => /setup readiness\s*100\s*%|preparaci[oó]n de configuraci[oó]n\s*100\s*%/i.test(line));
    if (ready) {
      return {
        answer: spanish
          ? "No faltan requisitos obligatorios. La configuración está lista para activar; los elementos que aún aparecen están marcados como opcionales."
          : "No required setup is missing. The job is ready to activate; the remaining items shown on the page are optional.",
        highlightLabels: [],
        grounding: "visible-page-readiness",
      };
    }
    const matchedRequirements = readinessRequirements
      .filter(requirement => pageText.some(line => requirement.patterns.some(pattern => pattern.test(line))));
    const matched = matchedRequirements.map(requirement => spanish ? requirement.es : requirement.en);
    // Language switching can briefly produce a mixed-language context because
    // the assistant and page translate in separate React render passes. Accept
    // both of BIMLog's canonical Spanish adjectives so the authoritative count
    // is never lost during that transition.
    const count = pageText.find(line => /\d+ required item\(s\) remaining|\d+ elemento\(s\) (?:obligatorio|requerido)/i.test(line));
    const requiredCount = count ? Number(count.match(/\d+/)?.[0] || 0) : 0;
    // The count is presentation evidence, not permission to invent omitted
    // requirements. Only repeat requirements actually present in the page.
    const remaining = matched;
    if (!remaining.length && !count) return null;
    const intro = spanish ? "La página muestra estos requisitos pendientes:" : "The page shows these requirements still pending:";
    const details = remaining.length ? remaining.map(line => `• ${line}`).join(" ") : (spanish ? "Revisa la lista visible «Pendiente» en esta página." : "Review the visible “Still required” list on this page.");
    const countLabel = requiredCount
      ? (spanish ? `${requiredCount} elemento(s) obligatorio(s) pendiente(s)` : `${requiredCount} required item(s) remaining`)
      : "";
    const mismatch = requiredCount && requiredCount !== remaining.length
      ? (spanish
        ? ` La página muestra un conteo inconsistente (${requiredCount}) pero expone ${remaining.length} requisito(s); esto es un defecto de la página.`
        : ` The page shows an inconsistent count (${requiredCount}) but exposes ${remaining.length} requirement(s); this is a page defect.`)
      : "";
    const highlightLabels = matchedRequirements
      .flatMap(requirement => requirement.labels)
      .filter(label => controls.some(control => control === label || control.includes(label)));
    return { answer: `${countLabel ? `${countLabel}. ` : ""}${intro} ${details}${mismatch}`, highlightLabels, grounding: "visible-page-readiness" };
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
