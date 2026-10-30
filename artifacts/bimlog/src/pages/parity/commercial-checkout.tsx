import { CommercialWorkspace } from "@/pages/CommercialWorkspace";
import { useI18n } from "@/lib/i18n";

export function CommercialCheckout() {
  const { tt } = useI18n();
  return <>
    <section aria-label={tt("Secure checkout guidance", "Guía de pago seguro")} style={{padding:"16px clamp(16px,4vw,42px)"}}>
      <h1>{tt("Company Subscription Checkout", "Pago de suscripción de empresa")}</h1>
      <p>{tt("Review your company and offer below. A billing administrator completes the billing identity, prepares the subscription, and starts secure checkout when all prerequisites pass. Payment details are entered on Stripe. After returning, payment remains pending until BIMLog receives the signed provider confirmation.", "Revise su empresa y oferta a continuación. Un administrador de facturación completa la identidad, prepara la suscripción e inicia el pago seguro cuando se cumplen los requisitos. Los datos de pago se ingresan en Stripe. Al regresar, el pago permanece pendiente hasta que BIMLog recibe la confirmación firmada del proveedor.")}</p>
    </section>
    <CommercialWorkspace />
  </>;
}
export default CommercialCheckout;
