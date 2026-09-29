export type RfiWorkflowInput = {
  recordState: "new" | "draft" | "sent" | "closed" | "reopened" | "revised";
  submittedBy: string;
  submittedTo: string;
  dueDate?: string;
  canRespond: boolean;
  canClose: boolean;
  canReopen: boolean;
  canEdit: boolean;
};

export function rfiWorkflowSummary(input: RfiWorkflowInput, lang: string) {
  const es = lang === "es";
  if (input.recordState === "closed") return {
    nextActor: es ? "Sin accion pendiente" : "No pending actor",
    primaryAction: input.canReopen ? (es ? "Reabrir RFI" : "Reopen RFI") : (es ? "Revisar historial" : "Review history"),
  };
  if (input.canRespond) return {
    nextActor: input.submittedTo || (es ? "Destinatario sin asignar" : "Recipient not assigned"),
    primaryAction: es ? "Guardar respuesta" : "Save response",
  };
  if (input.canClose) return {
    nextActor: input.submittedBy || (es ? "Administrador del proyecto" : "Project administrator"),
    primaryAction: es ? "Revisar respuesta y cerrar" : "Review response and close",
  };
  return {
    nextActor: input.submittedBy || (es ? "Autor del borrador" : "Draft author"),
    primaryAction: input.canEdit ? (es ? "Completar borrador" : "Complete draft") : (es ? "Revisar RFI" : "Review RFI"),
  };
}
