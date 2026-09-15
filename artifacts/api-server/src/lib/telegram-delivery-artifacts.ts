export type DeliveryArtifactType =
  | "project_file"
  | "rfi_pdf"
  | "rfi_complete_pdf"
  | "rfi_docx"
  | "rfi_audit_pdf"
  | "submittal_pdf"
  | "submittal_docx"
  | "submittal_audit_pdf"
  | "change_order_pdf";

export const TELEGRAM_DELIVERY_ARTIFACTS: Record<Exclude<DeliveryArtifactType, "project_file">, { route: string; suffix: string; contentType: string }> = {
  rfi_pdf: { route: "/projects/{projectId}/rfis/{entityId}/export", suffix: "-Request-for-Information.pdf", contentType: "application/pdf" },
  rfi_complete_pdf: { route: "/projects/{projectId}/rfis/{entityId}/export-complete", suffix: "-Complete-RFI-Package.pdf", contentType: "application/pdf" },
  rfi_docx: { route: "/projects/{projectId}/rfis/{entityId}/export-word", suffix: "-Request-for-Information.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  rfi_audit_pdf: { route: "/projects/{projectId}/rfis/{entityId}/audit-certificate", suffix: "-RFI-Audit.pdf", contentType: "application/pdf" },
  submittal_pdf: { route: "/projects/{projectId}/submittals/{entityId}/export", suffix: "-Submittal.pdf", contentType: "application/pdf" },
  submittal_docx: { route: "/projects/{projectId}/submittals/{entityId}/export-word", suffix: "-Submittal.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  submittal_audit_pdf: { route: "/projects/{projectId}/submittals/{entityId}/audit-certificate", suffix: "-Submittal-Audit.pdf", contentType: "application/pdf" },
  change_order_pdf: { route: "/projects/{projectId}/change-orders/{entityId}/export", suffix: "-Change-Order.pdf", contentType: "application/pdf" },
};
