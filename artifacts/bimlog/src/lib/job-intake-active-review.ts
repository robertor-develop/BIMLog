export function activeIntakeEditGuidance(readOnly: boolean, language: string) {
  const es = language === "es";
  if (readOnly) return es
    ? "Esta configuración activada es evidencia de origen. Continúe la entrega y el personal en Operaciones del Trabajo."
    : "This activated setup is source evidence. Continue delivery and staffing in Job Operations.";
  return es
    ? "Los cambios guardados aquí actualizan la configuración de origen; no vuelven a crear ni reemplazan el trabajo activo."
    : "Changes saved here update the source setup; they do not recreate or replace the active job.";
}

export function activeIntakeConfirmationLabel(language: string) {
  return language === "es" ? "Confirmaciones registradas al activar" : "Confirmations recorded at activation";
}

export function activeIntakeNextActions(projectId: number, contractsEnabled: boolean) {
  return [
    { key: "delivery", href: withActiveIntakeReturn(`/projects/${projectId}/operations`, projectId), en: "Manage delivery and staffing", es: "Gestionar entrega y personal" },
    ...(contractsEnabled ? [{ key: "commercial", href: withActiveIntakeReturn(`/projects/${projectId}/financial/contracts`, projectId), en: "Review controlled contracts", es: "Revisar contratos controlados" }] : []),
  ];
}
import { withActiveIntakeReturn } from "./active-intake-roundtrip";
