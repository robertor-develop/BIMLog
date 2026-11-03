import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export function AutodeskToken() {
  const { token } = useAuthStore();
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const t = (en: string, es: string) => (lang === "es" ? es : en);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<"" | "available" | "unavailable">("");
  const [detail, setDetail] = useState("");

  async function verifyService() {
    if (!token) return;
    setChecking(true);
    setResult("");
    setDetail("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/autodesk/token`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setResult("unavailable");
        setDetail(String(body.code || body.error || `REQUEST_${response.status}`));
        return;
      }
      if (typeof body.access_token !== "string" || body.access_token.length === 0) {
        setResult("unavailable");
        setDetail(t("The provider response did not include a usable token.", "La respuesta del proveedor no incluyó un token utilizable."));
        return;
      }
      setResult("available");
      setDetail(
        t(
          `Service verified${typeof body.expires_in === "number" ? `; provider lease: ${body.expires_in} seconds` : ""}. The token was not displayed or stored.`,
          `Servicio verificado${typeof body.expires_in === "number" ? `; vigencia del proveedor: ${body.expires_in} segundos` : ""}. El token no se mostró ni se almacenó.`,
        ),
      );
    } catch (caught) {
      setResult("unavailable");
      setDetail(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setChecking(false);
    }
  }

  return (
    <main id="main-content" tabIndex={-1} style={{ maxWidth: 900, margin: "0 auto", padding: "28px clamp(16px,4vw,42px)" }}>
      <h1>{t("Autodesk Token Service", "Servicio de token de Autodesk")}</h1>
      <p>{t("Verify BIMLog's governed server-to-server Autodesk connection. BIMLog uses this service for authorized Autodesk operations; users never enter, view, copy, or manage the provider secret here.", "Verifique la conexión gobernada de servidor a servidor de Autodesk de BIMLog. BIMLog usa este servicio para operaciones autorizadas de Autodesk; los usuarios nunca ingresan, ven, copian ni administran el secreto del proveedor aquí.")}</p>
      <p>{t("Who can act: any authenticated BIMLog user may verify availability. Provider configuration remains restricted to authorized administrators and the deployment environment.", "Quién puede actuar: cualquier usuario autenticado de BIMLog puede verificar la disponibilidad. La configuración del proveedor permanece restringida a administradores autorizados y al entorno de despliegue.")}</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Button onClick={() => void verifyService()} disabled={checking}>
          {checking ? t("Verifying…", "Verificando…") : t("Verify token service", "Verificar servicio de token")}
        </Button>
        <Button variant="outline" onClick={() => setLocation("/autodesk/hubs")}>{t("Open Autodesk Hubs", "Abrir Hubs de Autodesk")}</Button>
        <Button variant="outline" onClick={() => setLocation("/ai-control/provider-connections")}>{t("Provider governance", "Gobernanza de proveedores")}</Button>
      </div>
      {checking && <p role="status">{t("Requesting a short-lived provider lease without displaying it…", "Solicitando una vigencia de proveedor de corta duración sin mostrarla…")}</p>}
      {result === "available" && <p role="status">{detail}</p>}
      {result === "unavailable" && <p role="alert">{t("Autodesk token service is unavailable: ", "El servicio de token de Autodesk no está disponible: ")}{detail} <button onClick={() => void verifyService()}>{t("Retry", "Reintentar")}</button></p>}
    </main>
  );
}

export default AutodeskToken;
