export function workflowApprovalError(code: string, spanish: boolean): string {
  if (code === "WORKFLOW_PREVIEW_CONTEXT_INVALID" || code === "DELIVERY_WORKFLOW_NOT_FOUND") return spanish
    ? "No se pudo verificar la versión seleccionada en esta empresa. Recargue la lista y seleccione nuevamente el flujo."
    : "The selected version could not be verified in this company. Reload the list and select the workflow again.";
  const changes: Record<string, [string, string]> = {
    WORKFLOW_POLICY_EDIT_PHASES_FORBIDDEN: ["fases, transiciones o reglas de reapertura", "phases, transitions or reopening rules"],
    WORKFLOW_POLICY_EDIT_TASKS_ROLES_FORBIDDEN: ["tareas o roles", "tasks or roles"],
    WORKFLOW_POLICY_CHANGE_APU_FORBIDDEN: ["la versión APU asociada", "the associated APU version"],
    WORKFLOW_POLICY_EDIT_ALLOCATION_FORBIDDEN: ["la asignación económica", "economic allocation"],
  };
  if (changes[code]) return spanish
    ? `La política de gobernanza publicada no permite cambiar ${changes[code][0]} respecto de la versión anterior. Corrija el borrador o solicite una revisión autorizada de la política. La versión publicada sigue vigente.`
    : `The published Governance Policy does not allow changes to ${changes[code][1]} relative to the previous version. Correct the draft or request an authorized policy review. The published version remains in effect.`;
  if (code === "DELIVERY_WORKFLOW_INDEPENDENT_CHECKER_REQUIRED") {
    return spanish
      ? "La persona que creó o editó esta versión no puede aprobarla. Otro administrador PMO de la empresa debe revisarla."
      : "The person who created or edited this version cannot approve it. Another company PMO administrator must review it.";
  }
  if (code === "DELIVERY_WORKFLOW_FINANCE_CHECKER_REQUIRED") {
    return spanish
      ? "La asignación económica requiere un aprobador financiero distinto de quien creó o editó esta versión."
      : "Economic allocation requires a Finance approver other than the person who created or edited this version.";
  }
  if (code === "WORKFLOW_POLICY_FINAL_APPROVAL_REQUIRED") {
    return spanish
      ? "La política de gobernanza publicada exige aprobación final. Agregue aprobación a la última fase en una nueva versión y solicite una nueva revisión antes de publicar."
      : "The published Governance Policy requires final approval. Add approval to the last phase in a new version and request another review before publishing.";
  }
  if (code === "WORKFLOW_POLICY_PHASE_REVIEW_REQUIRED") {
    return spanish
      ? "La política de gobernanza publicada exige revisión de calidad en cada fase. Corrija una nueva versión y solicite otra revisión antes de publicar."
      : "The published Governance Policy requires quality review in every phase. Correct a new version and request another review before publishing.";
  }
  if (code === "WORKFLOW_POLICY_DOCUMENT_REQUIRED") {
    return spanish
      ? "La política de gobernanza publicada exige un documento requerido por fase. Corrija una nueva versión y solicite otra revisión antes de publicar."
      : "The published Governance Policy requires a document in each phase. Correct a new version and request another review before publishing.";
  }
  if (code === "WORKFLOW_POLICY_FINGERPRINT_MISMATCH" || code === "WORKFLOW_POLICY_AMBIGUOUS") {
    return spanish
      ? "Las políticas de gobernanza publicadas están en conflicto o fallaron la verificación. Un administrador PMO debe resolverlas antes de publicar."
      : "Published Governance Policies conflict or failed integrity verification. A PMO administrator must resolve them before publishing.";
  }
  return code;
}
