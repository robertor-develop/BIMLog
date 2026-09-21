import type { Rfi } from "@workspace/api-client-react";

export type RfiUiMode = "create" | "view" | "edit";
export type RfiRecordState = "new" | "draft" | "sent" | "closed" | "reopened" | "revised";
export type RfiActionKey =
  | "back" | "submit" | "cancel" | "save-rfi" | "export-pdf" | "export-complete-pdf"
  | "export-docx" | "export-audit-pdf" | "viewed-by" | "edit" | "close" | "reopen"
  | "raise-change-order" | "jump-viewpoint" | "revise" | "save-response";

export type RfiActionDefinition = {
  key: RfiActionKey;
  label: string;
  variant: "primary" | "secondary" | "danger";
};

export type RfiCanonicalPermissions = {
  canEdit: boolean;
  canRespond: boolean;
  canClose: boolean;
  canReopen: boolean;
  canExport: boolean;
  canRaiseChangeOrder: boolean;
  canJumpViewpoint: boolean;
};

const label = (en: string, es: string, lang: string) => lang === "es" ? es : en;

function createActions(hasViewpoint: boolean, lang: string): RfiActionDefinition[] {
  const actions: RfiActionDefinition[] = [
    { key: "submit", label: label("Submit RFI", "Enviar RFI", lang), variant: "primary" },
    { key: "cancel", label: label("Cancel", "Cancelar", lang), variant: "secondary" },
  ];
  if (hasViewpoint) actions.push({ key: "jump-viewpoint", label: label("Jump to Viewpoint", "Ir al Punto de Vista", lang), variant: "secondary" });
  return actions;
}

export function getRfiCanonicalActionMatrix(params: { mode: RfiUiMode; recordState: RfiRecordState; permissions: RfiCanonicalPermissions; lang: string }): RfiActionDefinition[] {
  const { mode, recordState, permissions, lang } = params;
  if (recordState === "new") return createActions(permissions.canJumpViewpoint, lang);
  if (mode === "edit") {
    const actions: RfiActionDefinition[] = [
      { key: "save-rfi", label: label("Save RFI", "Guardar RFI", lang), variant: "primary" },
      { key: "cancel", label: label("Cancel", "Cancelar", lang), variant: "secondary" },
    ];
    if (permissions.canRespond) actions.push({ key: "save-response", label: label("Save Response", "Guardar Respuesta", lang), variant: "primary" });
    if (recordState === "closed" && permissions.canReopen) actions.push({ key: "reopen", label: label("Reopen RFI", "Reabrir RFI", lang), variant: "secondary" });
    return actions;
  }
  const actions: RfiActionDefinition[] = [];
  if (permissions.canEdit) actions.push({ key: "edit", label: label("Edit RFI", "Editar RFI", lang), variant: "secondary" });
  if (permissions.canExport) actions.push(
    { key: "export-pdf", label: "RFI PDF", variant: "secondary" },
    { key: "export-complete-pdf", label: label("Complete RFI PDF", "PDF Completo RFI", lang), variant: "secondary" },
    { key: "export-docx", label: "RFI DOCX", variant: "secondary" },
    { key: "export-audit-pdf", label: label("RFI Audit PDF", "PDF Auditoria RFI", lang), variant: "secondary" },
  );
  if (recordState === "closed") {
    if (permissions.canReopen) actions.push({ key: "reopen", label: label("Reopen RFI", "Reabrir RFI", lang), variant: "secondary" });
  } else if (permissions.canClose) actions.push({ key: "close", label: label("Close RFI", "Cerrar RFI", lang), variant: "danger" });
  if (permissions.canRespond) actions.push({ key: "save-response", label: label("Save Response", "Guardar Respuesta", lang), variant: "primary" });
  if (permissions.canJumpViewpoint) actions.push({ key: "jump-viewpoint", label: label("Jump to Viewpoint", "Ir al Punto de Vista", lang), variant: "secondary" });
  if (permissions.canRaiseChangeOrder) actions.push({ key: "raise-change-order", label: label("Raise Change Order", "Crear Orden de Cambio", lang), variant: "secondary" });
  return actions;
}

export function getSavedRfiActionMatrix(params: { rfi: Rfi; canWrite: boolean; isProjectAdmin: boolean; hasViewpoint: boolean; isEditing: boolean; lang: string }): RfiActionDefinition[] {
  const { rfi, canWrite, isProjectAdmin, hasViewpoint, isEditing, lang } = params;
  if (canWrite && isEditing) return [
    { key: "save-rfi", label: label("Save RFI", "Guardar RFI", lang), variant: "primary" },
    { key: "cancel", label: label("Cancel", "Cancelar", lang), variant: "secondary" },
  ];
  const actions: RfiActionDefinition[] = [
    { key: "back", label: label("Back to RFI Log", "Volver al Registro RFI", lang), variant: "secondary" },
    { key: "export-pdf", label: "RFI PDF", variant: "secondary" },
    { key: "export-complete-pdf", label: label("Complete RFI PDF", "PDF Completo RFI", lang), variant: "secondary" },
    { key: "export-docx", label: "RFI DOCX", variant: "secondary" },
    { key: "export-audit-pdf", label: label("RFI Audit PDF", "PDF Auditoria RFI", lang), variant: "secondary" },
    { key: "viewed-by", label: label("Viewed By", "Visto Por", lang), variant: "secondary" },
  ];
  if (canWrite && !isEditing) actions.push({ key: "edit", label: label("Edit RFI", "Editar RFI", lang), variant: "secondary" }, { key: "revise", label: label("Create Revision", "Crear Revision", lang), variant: "secondary" });
  if (rfi.status === "closed") {
    if (canWrite) actions.push({ key: "reopen", label: label("Reopen RFI", "Reabrir RFI", lang), variant: "secondary" });
  } else if (isProjectAdmin) actions.push({ key: "close", label: label("Close RFI", "Cerrar RFI", lang), variant: "danger" });
  if (canWrite) actions.push({ key: "raise-change-order", label: label("Raise Change Order", "Crear Orden de Cambio", lang), variant: "secondary" });
  if (hasViewpoint) actions.push({ key: "jump-viewpoint", label: label("Jump to Viewpoint", "Ir al Punto de Vista", lang), variant: "secondary" });
  return actions;
}
