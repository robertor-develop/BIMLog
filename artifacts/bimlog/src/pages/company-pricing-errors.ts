export function pricingErrorMessage(payload: { code?: unknown; field?: unknown }, es: boolean): string {
  const field = typeof payload.field === "string" ? payload.field : "";
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
