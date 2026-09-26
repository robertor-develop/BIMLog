export const SUBMITTAL_STATUS_BADGES: Record<string, { bg: string; color: string; label: string; labelEs: string }> = {
  pending: { bg: "#F3F4F6", color: "#6B7280", label: "Pending", labelEs: "Pendiente" },
  submitted: { bg: "#EFF6FF", color: "#1D4ED8", label: "Submitted", labelEs: "Enviado" },
  under_review: { bg: "#FFFBEB", color: "#B45309", label: "Under Review", labelEs: "En Revisión" },
  approved: { bg: "#F0FDF4", color: "#15803D", label: "Approved", labelEs: "Aprobado" },
  approved_as_noted: { bg: "#EFF6FF", color: "#1D4ED8", label: "Approved as Noted", labelEs: "Aprobado con Notas" },
  rejected: { bg: "#FFF1F2", color: "#DC2626", label: "Rejected", labelEs: "Rechazado" },
  revise_resubmit: { bg: "#FFF7ED", color: "#EA580C", label: "Revise & Resubmit", labelEs: "Revisar y Reenviar" },
};

export function submittalStatusLabel(status: string, lang: string) {
  const presentation = SUBMITTAL_STATUS_BADGES[status];
  if (presentation) return lang === "es" ? presentation.labelEs : presentation.label;
  if (status === "draft") return lang === "es" ? "Borrador" : "Draft";
  if (status === "closed") return lang === "es" ? "Cerrado" : "Closed";
  return status; // Unknown historical states are never relabeled as approved or pending.
}
