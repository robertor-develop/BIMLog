export function workflowApprovalError(code: string, spanish: boolean): string {
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
  return code;
}
