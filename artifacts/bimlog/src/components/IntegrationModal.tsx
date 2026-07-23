import { FileCheck, LockKeyhole, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export interface IntegrationInfo {
  name: string;
  logoBg: string;
  logoColor: string;
  logoText: string;
}

export function ConnectModal({
  integration,
  onClose,
  projectId,
  onNavigate,
}: {
  integration: IntegrationInfo;
  onClose: () => void;
  projectId?: number;
  onNavigate?: (path: string) => void;
}) {
  const { lang } = useI18n();
  const tr = (en: string, es: string) => lang === "es" ? es : en;

  function navigate(path: string) {
    onClose();
    if (onNavigate) onNavigate(path);
    else window.location.assign(path);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 14, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: integration.logoBg, color: integration.logoColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800 }}>
              {integration.logoText}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "hsl(var(--foreground))" }}>
                {tr("Integration review", "Revisión de integración")}
              </div>
              <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{integration.name}</div>
            </div>
          </div>
          <button aria-label={tr("Close", "Cerrar")} onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "hsl(var(--secondary))", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 10, padding: 13, borderRadius: 9, background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1E40AF", fontSize: 12, lineHeight: 1.55 }}>
            <LockKeyhole style={{ width: 17, height: 17, flexShrink: 0, marginTop: 1 }} />
            <span>
              {tr(
                "Connections are enabled only after provider and customer approval. Never submit passwords, API keys, or access tokens in a request.",
                "Las conexiones se habilitan solo después de la aprobación del proveedor y del cliente. Nunca envíes contraseñas, claves API ni tokens de acceso en una solicitud.",
              )}
            </span>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
            {projectId && (
              <button onClick={() => navigate(`/projects/${projectId}/files`)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 7, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", cursor: "pointer", fontWeight: 700, fontSize: 11 }}>
                <FileCheck style={{ width: 14, height: 14 }} />
                {tr("Use file exchange", "Usar intercambio de archivos")}
              </button>
            )}
            <button onClick={() => navigate("/contact")} style={{ padding: "8px 12px", borderRadius: 7, border: "none", background: "#2563EB", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 11 }}>
              {tr("Request review", "Solicitar revisión")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
