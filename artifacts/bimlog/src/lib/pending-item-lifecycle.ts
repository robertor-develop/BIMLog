export type PendingLifecycleType = "rfis" | "submittals" | "files";
export type PendingLifecycleLanguage = "en" | "es";

export interface PendingLifecycleInput {
  status?: string;
  dueDate?: string | null;
  title?: string;
}

export interface PendingLifecycleVisibility {
  state: string;
  missing: string;
  actor: string;
  nextAction: string;
  result: string;
}

export function pendingItemLifecycle(type: PendingLifecycleType, item: PendingLifecycleInput, lang: PendingLifecycleLanguage): PendingLifecycleVisibility {
  const es = lang === "es";
  const state = item.status?.replace(/_/g, " ") || (es ? "requiere revisión" : "needs review");
  const missingParts: string[] = [];
  if (!item.status) missingParts.push(es ? "estado" : "status");
  if (!item.dueDate && type !== "files") missingParts.push(es ? "fecha límite" : "due date");
  if (!item.title) missingParts.push(es ? "título" : "title");
  const missing = missingParts.length ? missingParts.join(", ") : (es ? "Nada requerido para abrir" : "Nothing required to open");
  if (type === "rfis") return { state, missing, actor: es ? "Respondedor o revisor RFI autorizado" : "Authorized RFI responder or reviewer", nextAction: es ? "Abrir, responder o derivar el RFI" : "Open, answer, or route the RFI", result: es ? "Registro RFI del proyecto y rastro de respuesta" : "Project RFI register and response trail" };
  if (type === "submittals") return { state, missing, actor: es ? "Revisor de submittal autorizado" : "Authorized submittal reviewer", nextAction: es ? "Abrir el paquete y registrar la decisión" : "Open the package and record the decision", result: es ? "Registro de submittals y evidencia de revisión" : "Submittal register and review evidence" };
  return { state, missing, actor: es ? "Participante autorizado de documentos" : "Authorized document participant", nextAction: es ? "Abrir el archivo y corregir o revisar" : "Open the file and correct or review", result: es ? "Registro de archivos y evidencia CVR" : "File register and CVR evidence" };
}
