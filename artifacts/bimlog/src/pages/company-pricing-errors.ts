export function pricingErrorMessage(payload: { code?: unknown; field?: unknown }, es: boolean, status?: number): string {
  if (payload.code === "PRICING_TEMPLATE_MAKER_CHECKER_REQUIRED")
    return es ? "Otro usuario PMO de esta empresa con aprobación financiera debe publicar o retirar esta versión; su autor no puede aprobarla." : "A different PMO user in this company with Finance approval must publish or retire this version; its author cannot approve it.";
  if (payload.code === "PRICING_TEMPLATE_FINANCE_APPROVER_REQUIRED")
    return es ? "Esta acción requiere autorización financiera vigente de la empresa. Solicite la revisión de un aprobador autorizado." : "This action requires current company Finance approval authority. Request review by an authorized approver.";
  if (payload.code === "PRICING_TEMPLATE_PMO_REQUIRED")
    return es ? "Se requiere permiso PMO de esta empresa para administrar sus plantillas de precios." : "Company PMO permission is required to manage its pricing templates.";
  if (status === 403)
    return es ? "No tiene autorización para esta acción sobre la plantilla de precios." : "You are not authorized to perform this pricing-template action.";
  const field = typeof payload.field === "string" ? payload.field : "";
  if (typeof payload.code === "string" && payload.code.startsWith("PRICING_TEMPLATE_POOL"))
    return es ? "Asigne cada componente a un solo fondo y conserve al menos uno en producción directa con sus fases." : "Assign every component to exactly one pool and keep at least one direct-production component with its phases.";
  if (payload.code === "PRICING_TEMPLATE_TEXT_INVALID" && field === "name")
    return es ? "Escriba un nombre para la plantilla antes de continuar." : "Enter a template name before continuing.";
  if (payload.code === "PRICING_TEMPLATE_TEXT_INVALID")
    return es ? "Complete los campos de texto obligatorios de la plantilla." : "Complete the required template text fields.";
  if (payload.code === "PRICING_TEMPLATE_CURRENCY_INVALID")
    return es ? "Use un código de moneda ISO de tres letras." : "Use a three-letter ISO currency code.";
  if (typeof payload.code === "string" && payload.code.startsWith("PRICING_TEMPLATE_"))
    return es ? "Revise los datos de la plantilla y vuelva a intentarlo." : "Review the template details and try again.";
  return es ? "La solicitud falló. Vuelva a intentarlo." : "Request failed. Please try again.";
}
