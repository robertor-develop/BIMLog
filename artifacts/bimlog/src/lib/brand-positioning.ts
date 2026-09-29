export const BIMLOG_BRAND = {
  product: "BIMLog",
  parent: "IgniteSmart",
  relationship: "BIMLog by IgniteSmart",
  audience: {
    en: "BIM coordinators, BIM managers, project administrators, and delivery teams",
    es: "Coordinadores BIM, gerentes BIM, administradores de proyecto y equipos de entrega",
  },
  promise: {
    en: "One connected record from job intake through coordinated delivery.",
    es: "Un registro conectado desde el ingreso del trabajo hasta la entrega coordinada.",
  },
  voice: {
    en: "Clear, accountable, and specific about what happens next.",
    es: "Claro, responsable y específico sobre lo que sigue.",
  },
} as const;

export function brandLabel(language: "en" | "es") {
  return `${BIMLOG_BRAND.relationship} · ${BIMLOG_BRAND.promise[language]}`;
}
