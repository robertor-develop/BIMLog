import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { FileInput, FolderOpen, LockKeyhole, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { logClientError } from "@/lib/client-log";

interface IntegrationsTabProps {
  projectId: number;
}

interface CatalogProvider {
  key: string;
  label: { en: string; es: string };
  description: { en: string; es: string };
  category: "file_source" | "open_format" | "first_party" | "governed";
  availability: "available" | "setup_required" | "review_required";
  oauthParam: string | null;
  route: string | null;
}

interface SafeConnection {
  provider: string;
  status: string;
}

export function IntegrationsTab({ projectId }: IntegrationsTabProps) {
  const { lang } = useI18n();
  const tr = (en: string, es: string) => lang === "es" ? es : en;
  const { token } = useAuthStore();
  const [, navigate] = useLocation();
  const [providers, setProviders] = useState<CatalogProvider[]>([]);
  const [connections, setConnections] = useState<SafeConnection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch("/api/v1/me/provider-catalog", {
        headers: { Authorization: `Bearer ${token}` },
      }).then(async (response) => {
        if (!response.ok) throw new Error(`provider catalog ${response.status}`);
        return response.json() as Promise<{ providers: CatalogProvider[] }>;
      }),
      fetch("/api/v1/me/connections", {
        headers: { Authorization: `Bearer ${token}` },
      }).then(async (response) => {
        if (!response.ok) throw new Error(`connections ${response.status}`);
        return response.json() as Promise<SafeConnection[]>;
      }),
    ])
      .then(([catalog, current]) => {
        setProviders(catalog.providers);
        setConnections(current);
      })
      .catch((error) => logClientError("governed provider catalog load", error))
      .finally(() => setLoading(false));
  }, [token]);

  const connected = (key: string) =>
    connections.some((connection) => connection.provider === key && connection.status === "connected");

  function openProvider(provider: CatalogProvider) {
    if (provider.route) {
      navigate(`/projects/${projectId}/${provider.route}`);
      return;
    }
    if (provider.oauthParam && provider.availability === "available") {
      navigate("/profile");
      return;
    }
    navigate("/contact");
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1120 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: "hsl(var(--foreground))" }}>
            {tr("Integrations and file exchange", "Integraciones e intercambio de archivos")}
          </h1>
          <p style={{ margin: "7px 0 0", maxWidth: 720, color: "hsl(var(--muted-foreground))", fontSize: 13, lineHeight: 1.6 }}>
            {tr(
              "Only approved, accurately available connections appear here. Private providers require a customer-specific review and entitlement before they can be shown or used.",
              "Aquí solo aparecen conexiones aprobadas y realmente disponibles. Los proveedores privados requieren revisión y habilitación específica para el cliente antes de mostrarse o usarse.",
            )}
          </p>
        </div>
        <button
          onClick={() => navigate("/contact")}
          style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))", fontWeight: 700, cursor: "pointer" }}
        >
          {tr("Request an integration review", "Solicitar revisión de integración")}
        </button>
      </div>

      <div style={{ padding: "12px 14px", border: "1px solid #BFDBFE", background: "#EFF6FF", borderRadius: 9, color: "#1E40AF", fontSize: 12, lineHeight: 1.55, marginBottom: 20 }}>
        <LockKeyhole style={{ width: 15, height: 15, verticalAlign: "middle", marginRight: 7 }} />
        {tr(
          "Never send passwords, API keys, or access tokens in an integration request.",
          "Nunca envíes contraseñas, claves API ni tokens de acceso en una solicitud de integración.",
        )}
      </div>

      {loading ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>
          <RefreshCw style={{ width: 15, height: 15 }} />
          {tr("Loading approved capabilities…", "Cargando capacidades aprobadas…")}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {providers.map((provider) => {
            const isConnected = connected(provider.key);
            const label = lang === "es" ? provider.label.es : provider.label.en;
            const description = lang === "es" ? provider.description.es : provider.description.en;
            const available = provider.availability === "available";
            const status = isConnected
              ? tr("Connected", "Conectado")
              : available
                ? tr("Available", "Disponible")
                : provider.availability === "setup_required"
                  ? tr("Setup required", "Configuración requerida")
                  : tr("Review required", "Revisión requerida");
            const Icon = provider.category === "file_source" ? FolderOpen : FileInput;
            return (
              <article key={provider.key} style={{ border: "1px solid hsl(var(--border))", borderRadius: 11, background: "hsl(var(--card))", padding: 17 }}>
                <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon style={{ width: 17, height: 17 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 750, fontSize: 14, color: "hsl(var(--foreground))" }}>{label}</div>
                    <div style={{ marginTop: 4, minHeight: 35, fontSize: 11, lineHeight: 1.55, color: "hsl(var(--muted-foreground))" }}>{description}</div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                  <span style={{ fontSize: 10, fontWeight: 750, color: isConnected ? "#15803D" : available ? "#1D4ED8" : "#92400E" }}>{status}</span>
                  <button
                    onClick={() => openProvider(provider)}
                    style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "hsl(var(--foreground))", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                  >
                    {provider.route
                      ? tr("Open", "Abrir")
                      : available
                        ? tr("Manage", "Administrar")
                        : tr("Request review", "Solicitar revisión")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
