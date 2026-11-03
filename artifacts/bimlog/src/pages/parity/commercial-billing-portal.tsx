import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { CommercialHostedDestinationError, requestCommercialHostedDestination } from "@/lib/commercial-workspace-client";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

export function CommercialBillingPortal() {
  const { token } = useAuthStore();
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const t = (en: string, es: string) => (lang === "es" ? es : en);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function openPortal() {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const destination = await requestCommercialHostedDestination({ token, action: "billing-portal" });
      window.location.assign(destination.url);
    } catch (caught) {
      const code = caught instanceof CommercialHostedDestinationError ? caught.code : caught instanceof Error ? caught.message : String(caught);
      setError(code);
      setBusy(false);
    }
  }

  return <main id="main-content" tabIndex={-1} style={{ maxWidth: 850, margin: "0 auto", padding: "28px clamp(16px,4vw,42px)" }}>
    <h1>{t("Billing Self-Service", "Autoservicio de facturación")}</h1>
    <p>{t("Billing administrators can securely continue to the payment provider to manage the company's eligible subscription, invoices, or payment method. BIMLog creates a short-lived, company-scoped portal session; payment credentials are entered only on the provider's HTTPS site.", "Los administradores de facturación pueden continuar de forma segura al proveedor de pagos para administrar la suscripción elegible, las facturas o el método de pago de la empresa. BIMLog crea una sesión de portal de corta duración y limitada a la empresa; las credenciales de pago se ingresan únicamente en el sitio HTTPS del proveedor.")}</p>
    <p>{t("Prerequisites: billing-administrator authority, an active provider customer, and an eligible subscription lifecycle. If something is missing, BIMLog will leave billing unchanged and explain the next step.", "Requisitos: autoridad de administrador de facturación, un cliente activo del proveedor y un ciclo de suscripción elegible. Si falta algo, BIMLog dejará la facturación sin cambios y explicará el siguiente paso.")}</p>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <Button onClick={() => void openPortal()} disabled={busy}>{busy ? t("Opening secure portal…", "Abriendo portal seguro…") : t("Open billing portal", "Abrir portal de facturación")}</Button>
      <Button variant="outline" onClick={() => setLocation("/settings/billing-support")}>{t("Review billing status", "Revisar estado de facturación")}</Button>
      <Button variant="outline" onClick={() => setLocation("/commercial/billing-identity")}>{t("Billing identity", "Identidad de facturación")}</Button>
    </div>
    {busy && <p role="status">{t("Creating a short-lived company billing session…", "Creando una sesión de facturación de empresa de corta duración…")}</p>}
    {error && <p role="alert">{t("Billing portal could not be opened: ", "No se pudo abrir el portal de facturación: ")}{error} <button onClick={() => void openPortal()}>{t("Retry", "Reintentar")}</button></p>}
  </main>;
}

export default CommercialBillingPortal;
