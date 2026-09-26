const messages: Record<string, [string,string]> = {
  WORKFLOW_POLICY_ROLE_REQUIRED: ["The next approval requires a different authorized role.","La próxima aprobación requiere otro rol autorizado."],
  WORKFLOW_POLICY_COMPANY_REQUIRED: ["This action requires membership in the project's company.","Esta acción requiere pertenecer a la empresa del proyecto."],
  WORKFLOW_POLICY_PROJECT_MEMBER_REQUIRED: ["Active project membership is required.","Se requiere pertenencia activa al proyecto."],
  WORKFLOW_POLICY_AMOUNT_REQUIRED: ["The frozen contract-item amount is missing; the threshold cannot be evaluated.","Falta el importe congelado del elemento contractual; no se puede evaluar el umbral."],
  WORKFLOW_POLICY_AMOUNT_MISMATCH: ["The frozen economic snapshot failed verification.","La instantánea económica congelada no superó la verificación."],
  WORKFLOW_POLICY_CURRENCY_MISMATCH: ["The contract and policy currencies differ; automatic conversion is not allowed.","Las monedas del contrato y la política difieren; no se permite conversión automática."],
  WORKFLOW_POLICY_CHANGE_FORBIDDEN: ["The frozen policy prohibits changes to approved work.","La política congelada prohíbe cambiar el trabajo aprobado."],
  WORKFLOW_POLICY_NEW_VERSION_REQUIRED: ["A new governed version is required; this activated record cannot be rewritten.","Se requiere una nueva versión gobernada; este registro activado no se puede reescribir."],
  DELIVERY_WORKFLOW_INDEPENDENT_REVIEW_REQUIRED: ["Another reviewer must approve your work or evidence.","Otro revisor debe aprobar su trabajo o evidencia."],
  DELIVERY_WORKFLOW_TASKS_INCOMPLETE: ["Complete all phase checkpoints first.","Complete primero todos los puntos de control de la fase."],
  DELIVERY_WORKFLOW_DOCUMENT_REQUIRED: ["Link all required evidence before approval.","Vincule toda la evidencia requerida antes de aprobar."],
  DELIVERY_WORKFLOW_QC_REQUIRED: ["QC approval is required first.","Primero se requiere la aprobación de control de calidad."],
  DELIVERY_WORKFLOW_ALREADY_APPROVED: ["The required approvals are recorded.","Las aprobaciones requeridas están registradas."],
  DELIVERY_WORKFLOW_ALREADY_COMPLETE: ["This workflow is complete.","Este flujo está completado."],
  DELIVERY_WORKFLOW_APPROVAL_NOT_REQUIRED: ["No additional phase approval is required.","No se requiere aprobación adicional de la fase."],
};
export function governanceDecisionMessage(code: string, tt: (en:string,es:string)=>string): string {
  const text = messages[code];
  return text ? tt(...text) : tt("This action is unavailable. Review the policy and current role.","Esta acción no está disponible. Revise la política y el rol actual.");
}
