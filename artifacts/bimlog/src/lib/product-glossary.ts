export type ProductLanguage = "en" | "es";

export const productGlossary = Object.freeze({
  headquarters: { en: "Headquarters", es: "Sede", detail: "Cross-project overview and administration." },
  jobIntake: { en: "Project setup", es: "Configuración del proyecto", detail: "Resumable setup before operational activation." },
  companiesAgreements: { en: "Companies and agreements", es: "Empresas y acuerdos", detail: "Who hires whom, who delivers, and which contract applies." },
  deliveryWorkflow: { en: "Delivery workflow", es: "Flujo de entregas", detail: "The governed statuses and handoffs for a deliverable." },
  pricingLibrary: { en: "Pricing library", es: "Biblioteca de precios", detail: "Published reusable APU and pricing versions." },
  workPlan: { en: "Work plan", es: "Plan de trabajo", detail: "Scope, deliverables, hours, cost plan, and schedule." },
  operations: { en: "Operations", es: "Operaciones", detail: "Active-job execution and controlled changes." },
  technicalDetails: { en: "Technical details", es: "Detalles técnicos", detail: "Diagnostic identifiers used for support." },
} satisfies Record<string, { en: string; es: string; detail: string }>);

export type ProductTerm = keyof typeof productGlossary;

export function productLabel(term: ProductTerm, language: ProductLanguage) {
  return productGlossary[term][language];
}

export function readableTechnicalCode(code: string) {
  return code.trim().replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, letter => letter.toUpperCase());
}
