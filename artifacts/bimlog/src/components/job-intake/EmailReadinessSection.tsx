import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { emailReadinessCopy, resolveEmailReadiness, type SafeConnection } from "@/lib/email-readiness";
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export function EmailReadinessSection({ projectId, tt }: { projectId: number; tt: (en: string, es: string) => string }) {
  const [, navigate] = useLocation();
  const [connection, setConnection] = useState<SafeConnection | null>();
  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
    fetch(`${API_BASE}/api/v1/me/connections`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => response.ok ? response.json() : Promise.reject(new Error("load failed")))
      .then((rows: SafeConnection[]) => setConnection(rows.find(row => row.provider === "sendgrid") ?? null))
      .catch(() => setConnection({ provider: "sendgrid", status: "error", lastError: "unavailable" }));
  }, []);
  const state = resolveEmailReadiness(connection);
  const copy = emailReadinessCopy(state);
  const configure = () => navigate(`/profile?section=email-sending&returnTo=${encodeURIComponent(`/projects/${projectId}/intake?stage=delivery`)}`);
  return <section className="ji-card" id="ji-email-readiness" aria-labelledby="ji-email-readiness-title">
    <h2 id="ji-email-readiness-title">{tt("Email readiness", "Preparación de correo")}</h2>
    <p>{tt("Optional. Configure direct email delivery without blocking the rest of full setup.", "Opcional. Configure la entrega directa por correo sin bloquear el resto de la configuración completa.")}</p>
    {connection === undefined ? <p role="status">{tt("Checking email readiness...", "Verificando preparación de correo...")}</p> : <div className={state === "error" ? "ji-error" : state === "ready" ? "ji-ok" : "ji-guide"} role="status"><strong>{copy.label}</strong><p>{copy.detail}</p>{connection?.accountLabel && <p>{tt("Sender", "Remitente")}: {connection.accountLabel}</p>}</div>}
    <div className="ji-actions"><button type="button" onClick={configure}>{state === "not_configured" ? tt("Configure SendGrid", "Configurar SendGrid") : tt("Review email configuration", "Revisar configuración de correo")}</button><span className="ji-small">{tt("You can continue setup without email.", "Puede continuar la configuración sin correo.")}</span></div>
  </section>;
}
