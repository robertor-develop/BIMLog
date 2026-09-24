export function workflowPolicyErrorMessage(
  code: unknown,
  spanish: boolean,
): string {
  const messages: Record<string, [string, string]> = {
    WORKFLOW_POLICY_INDEPENDENT_CHECKER_REQUIRED: [
      "A different company PMO administrator must review this draft. Its creator and latest editor cannot approve it.",
      "Otro administrador PMO de la empresa debe revisar este borrador. Quien lo creó o editó por última vez no puede aprobarlo.",
    ],
    WORKFLOW_POLICY_FINANCE_CHECKER_REQUIRED: [
      "The reviewer also needs an active company Finance cost-approver grant.",
      "El revisor también necesita un permiso activo de Finanzas para aprobar costos de la empresa.",
    ],
    WORKFLOW_POLICY_NOT_DRAFT_OR_STALE: [
      "This draft changed or is no longer editable. Reload it before continuing.",
      "El borrador cambió o ya no se puede editar. Recárguelo antes de continuar.",
    ],
    WORKFLOW_POLICY_NOT_APPROVED_OR_STALE: [
      "This version changed or is no longer approved. Reload it before publishing.",
      "Esta versión cambió o ya no está aprobada. Recárguela antes de publicarla.",
    ],
    WORKFLOW_POLICY_SCOPE_OVERLAP: [
      "Another published policy already covers this Delivery Workflow. Retire or revise the conflicting policy first.",
      "Otra política publicada ya cubre este flujo de entrega. Retire o revise la política en conflicto primero.",
    ],
    WORKFLOW_POLICY_SCOPE_INVALID: [
      "Select a Delivery Workflow belonging to this company.",
      "Seleccione un flujo de entrega de esta empresa.",
    ],
    WORKFLOW_POLICY_SOURCE_CHANGED: [
      "The approved source changed. Create and review a new version before publishing.",
      "La fuente aprobada cambió. Cree y revise una nueva versión antes de publicarla.",
    ],
    WORKFLOW_POLICY_REASON_REQUIRED: [
      "Enter an audit reason of 5 to 500 characters before retiring this version.",
      "Escriba un motivo de auditoría de 5 a 500 caracteres antes de retirar esta versión.",
    ],
    WORKFLOW_POLICY_PMO_REQUIRED: [
      "Your account needs company PMO administration access to change this policy.",
      "Su cuenta necesita acceso de administración PMO de la empresa para cambiar esta política.",
    ],
    WORKFLOW_POLICY_INVALID: [
      "Review the policy fields, roles, thresholds and required validations before saving.",
      "Revise los campos, roles, umbrales y validaciones obligatorias de la política antes de guardar.",
    ],
  };
  const pair = typeof code === "string" ? messages[code] : undefined;
  return pair?.[spanish ? 1 : 0] ?? (spanish
    ? "No se pudo completar la acción de gobernanza. Recargue la política y vuelva a intentarlo."
    : "The Governance action could not be completed. Reload the policy and try again.");
}
