export type EmailReadinessState = "not_configured" | "configured" | "unverified" | "ready" | "error";
export type SafeConnection = { provider: string; status: string; accountLabel?: string | null; lastError?: string | null };

export function resolveEmailReadiness(connection?: SafeConnection | null): EmailReadinessState {
  if (!connection) return "not_configured";
  if (connection.status === "ready" || connection.status === "verified") return "ready";
  if (connection.status === "connected") return "unverified";
  if (connection.status === "error" || connection.lastError) return "error";
  return "configured";
}

export function emailReadinessCopy(state: EmailReadinessState) {
  return {
    not_configured: { label: { en: "Not configured", es: "No configurado" }, detail: { en: "Email is optional for setup. Configure it now or continue and send later.", es: "El correo es opcional durante la configuración. Configúrelo ahora o continúe y envíe más tarde." } },
    configured: { label: { en: "Configured", es: "Configurado" }, detail: { en: "Connection details are saved, but sending readiness has not been verified.", es: "Los datos de conexión están guardados, pero aún no se ha verificado la capacidad de envío." } },
    unverified: { label: { en: "Connected, sender unverified", es: "Conectado, remitente sin verificar" }, detail: { en: "The API key is accepted. Verify the sender before relying on direct delivery.", es: "La clave API fue aceptada. Verifique el remitente antes de depender del envío directo." } },
    ready: { label: { en: "Ready", es: "Listo" }, detail: { en: "The current sender and provider are verified for direct BIMLog delivery.", es: "El remitente y el proveedor actuales están verificados para el envío directo de BIMLog." } },
    error: { label: { en: "Needs attention", es: "Requiere atención" }, detail: { en: "The provider could not verify this connection. Reconnect it before sending.", es: "El proveedor no pudo verificar esta conexión. Vuelva a conectarla antes de enviar." } },
  }[state];
}
