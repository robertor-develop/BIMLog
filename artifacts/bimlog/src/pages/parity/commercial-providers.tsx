import { CommercialWorkspace } from "@/pages/CommercialWorkspace";
import { useI18n } from "@/lib/i18n";
import { Link } from "wouter";

export function CommercialProviders() {
  const { tt } = useI18n();
  return <>
    <section aria-label={tt("Payment confirmation", "Confirmación de pago")} style={{padding:"16px clamp(16px,4vw,42px)"}}>
      <h1>{tt("Payment Confirmation and Provider Status", "Confirmación de pago y estado del proveedor")}</h1>
      <p>{tt("Stripe sends signed payment confirmations directly to BIMLog. This connection is provider-only: users cannot submit or replay payment confirmations. Returning from checkout does not activate paid access by itself. BIMLog verifies the signature, company order, amount and payment state before updating the subscription.", "Stripe envía confirmaciones de pago firmadas directamente a BIMLog. Esta conexión es exclusiva del proveedor: los usuarios no pueden enviar ni repetir confirmaciones de pago. Regresar del pago no activa por sí solo el acceso pagado. BIMLog verifica la firma, la orden de empresa, el monto y el estado del pago antes de actualizar la suscripción.")}</p>
      <p>{tt("Use Refresh status below to reload your company's subscription and payment evidence. Billing administrators can inspect billing history and statements. If confirmation is pending or the payment service is unavailable, retain the order reference and contact support from Billing & Support.", "Use Actualizar estado a continuación para volver a cargar la suscripción y evidencia de pago de su empresa. Los administradores de facturación pueden consultar el historial y los estados. Si la confirmación está pendiente o el servicio no está disponible, conserve la referencia de orden y contacte a soporte desde Facturación y Soporte.")}</p>
      <Link href="/commercial/checkout">{tt("Review subscription checkout", "Revisar pago de suscripción")}</Link>
    </section>
    <CommercialWorkspace />
  </>;
}
export default CommercialProviders;
