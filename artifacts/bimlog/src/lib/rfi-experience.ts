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

export function rfiTimingPresentation(input: {
  status: string;
  createdAt: string | Date;
  dueDate?: string | Date | null;
  sentAt?: string | Date | null;
  sendStatus?: string | null;
}, lang: string, now = new Date()) {
  const es = lang === "es";
  const ageDays = Math.max(0, Math.floor((now.getTime() - new Date(input.createdAt).getTime()) / 86_400_000));
  if (input.status === "closed") return { kind: "closed" as const, isOverdue: false, ageDays, label: es ? "Cerrado" : "Closed" };
  const issued = input.sendStatus === "sent" || Boolean(input.sentAt);
  if (!issued) return { kind: "draft" as const, isOverdue: false, ageDays, label: es ? `Borrador · ${ageDays} d` : `Draft · ${ageDays}d` };
  if (!input.dueDate) return { kind: "age" as const, isOverdue: false, ageDays, label: es ? `Emitido · ${ageDays} d · sin vencimiento` : `Issued · ${ageDays}d · no due date` };
  const due = new Date(input.dueDate);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const delta = Math.round((dueDay - today) / 86_400_000);
  if (delta < 0) return { kind: "overdue" as const, isOverdue: true, ageDays, label: es ? `Vencido · ${Math.abs(delta)} d` : `Overdue · ${Math.abs(delta)}d` };
  if (delta === 0) return { kind: "due" as const, isOverdue: false, ageDays, label: es ? "Vence hoy" : "Due today" };
  return { kind: "due" as const, isOverdue: false, ageDays, label: es ? `Vence en ${delta} d` : `Due in ${delta}d` };
}

export function safeRfiReturnTarget(projectId: number, value: string | null | undefined) {
  if (!value) return null;
  const prefix = `/projects/${projectId}/`;
  if (!value.startsWith(prefix) || value.startsWith("//") || value.includes("\\")) return null;
  return value;
}
