import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

type Usage = { mode: string; provider: string; providerLabel: string; providerConnected: boolean; internalUser: boolean; platformConfigured: boolean; includedUsed: number; includedLimit: number; includedRemaining: number };
const modes = ["platform_internal", "user_key", "included_platform", "setup_required", "limit_reached"];
export function MyAiUsage() {
  const { token } = useAuthStore(); const { tt } = useI18n();
  const [usage, setUsage] = useState<Usage | null>(null), [error, setError] = useState(false), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0), [loadedAt, setLoadedAt] = useState("");
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController(); setUsage(null); setError(false); setBusy(true); setLoadedAt("");
    fetch("/api/v1/me/ai-usage", { signal: controller.signal, headers: { Authorization: `Bearer ${token}` } }).then(async response => {
      if (!response.ok) throw new Error("Usage unavailable");
      const data = await response.json();
      if (!modes.includes(data.mode) || typeof data.provider !== "string" || typeof data.providerLabel !== "string" || ![data.providerConnected,data.internalUser,data.platformConfigured].every(value=>typeof value === "boolean") || ![data.includedUsed,data.includedLimit,data.includedRemaining].every(value=>typeof value === "number" && Number.isFinite(value) && value >= 0)) throw new Error("Invalid usage response");
      if (!controller.signal.aborted) { setUsage(data); setLoadedAt(new Date().toISOString()); }
    }).catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [token,retry]);
  const label = (mode: string) => ({ platform_internal:tt("Internal platform access","Acceso interno de plataforma"),user_key:tt("Your connected provider","Su proveedor conectado"),included_platform:tt("Included platform credits","Créditos incluidos de plataforma"),setup_required:tt("Setup required","Configuración requerida"),limit_reached:tt("Monthly included limit reached","Límite mensual incluido alcanzado") }[mode] ?? mode);
  return <main style={{ maxWidth: 900, margin: "24px auto", padding: 18, minWidth: 0, overflowWrap: "anywhere" }}>
    <Link href="/all-tools">{tt("All Tools","Todas las herramientas")}</Link><h1>{tt("My AI Usage","Mi uso de IA")}</h1>
    <p>{tt("Inspect your current account's AI access and included usage for the current UTC calendar month. Reload retrieves saved server evidence; this page does not call an AI provider, purchase credits or connect an account.","Inspeccione el acceso a IA y uso incluido de su cuenta para el mes calendario UTC actual. Recargar obtiene evidencia guardada del servidor; esta página no llama a un proveedor de IA, compra créditos ni conecta una cuenta.")}</p>
    <button disabled={busy} onClick={()=>setRetry(value=>value+1)}>{tt("Reload my usage","Recargar mi uso")}</button>
    {busy && <p role="status">{tt("Loading your saved AI usage…","Cargando su uso guardado de IA…")}</p>}
    {error && <p role="alert">{tt("Your AI usage could not be verified. Reload to retry; no AI request was made.","No se pudo verificar su uso de IA. Recargue para reintentar; no se realizó una solicitud de IA.")}</p>}
    {usage && <><h2>{label(usage.mode)}</h2><dl style={{ display:"grid",gap:10 }}>
      <div><dt>{tt("Included used","Uso incluido")}</dt><dd>{usage.includedUsed}</dd></div><div><dt>{tt("Monthly included limit","Límite mensual incluido")}</dt><dd>{usage.includedLimit}</dd></div><div><dt>{tt("Included remaining","Incluido restante")}</dt><dd>{usage.includedRemaining}</dd></div>
      <div><dt>{tt("Provider","Proveedor")}</dt><dd>{usage.providerLabel} ({usage.provider})</dd></div><div><dt>{tt("Own provider connection","Conexión de proveedor propio")}</dt><dd>{usage.providerConnected?tt("Connected","Conectado"):tt("Not connected","No conectado")}</dd></div><div><dt>{tt("Platform AI configuration","Configuración de IA de plataforma")}</dt><dd>{usage.platformConfigured?tt("Configured","Configurada"):tt("Not configured","No configurada")}</dd></div><div><dt>{tt("Internal account eligibility","Elegibilidad de cuenta interna")}</dt><dd>{usage.internalUser?tt("Eligible","Elegible"):tt("Standard account","Cuenta estándar")}</dd></div><div><dt>{tt("Retrieved at","Consultado el")}</dt><dd><time dateTime={loadedAt}>{loadedAt}</time></dd></div>
    </dl><p>{usage.mode==="limit_reached"?tt("Included usage is exhausted. Review an authorized provider connection before making another AI request.","El uso incluido se agotó. Revise una conexión de proveedor autorizada antes de otra solicitud de IA."):usage.mode==="setup_required"?tt("Review provider setup or ask your platform administrator about AI availability.","Revise la configuración del proveedor o consulte al administrador sobre disponibilidad de IA."):tt("Usage is attributed to your authenticated account. Included counters do not represent a payment invoice.","El uso corresponde a su cuenta autenticada. Los contadores incluidos no representan una factura de pago.")}</p></>}
    <Link href="/ai-control/provider-connections">{tt("Review provider connections","Revisar conexiones de proveedores")}</Link>
  </main>;
}
