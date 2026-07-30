import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { FileInput, FolderOpen, LockKeyhole, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { logClientError } from "@/lib/client-log";
import { downloadGovernedCurrentViewPdf, PrintPdfButton } from "@/components/PrintPdfButton";

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
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [connection, setConnection] = useState("all");
  const [exporting, setExporting] = useState(false);

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
  const visibleProviders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return providers.filter((provider) => {
      const isConnected = connected(provider.key);
      if (category !== "all" && provider.category !== category) return false;
      if (availability !== "all" && provider.availability !== availability) return false;
      if (connection === "connected" && !isConnected) return false;
      if (connection === "not_connected" && isConnected) return false;
      const label = lang === "es" ? provider.label.es : provider.label.en;
      const description = lang === "es" ? provider.description.es : provider.description.en;
      return !query || `${label} ${description}`.toLowerCase().includes(query);
    });
  }, [availability, category, connection, connections, lang, providers, search]);

  const exportCurrentView = async () => {
    if (!token) return;
    setExporting(true);
    try {
      await downloadGovernedCurrentViewPdf(projectId, token, {
        surface: "integrations",
        lang,
        context: [
          `${tr("Search", "Busqueda")}: ${search.trim() || tr("None", "Ninguna")}`,
          `${tr("Category", "Categoria")}: ${category}`,
          `${tr("Availability", "Disponibilidad")}: ${availability}`,
          `${tr("Connection", "Conexion")}: ${connection}`,
          `${tr("Visible", "Visibles")}: ${visibleProviders.length}/${providers.length}`,
        ],
        columns: [
          tr("Integration", "Integracion"),
          tr("Category", "Categoria"),
          tr("Availability", "Disponibilidad"),
          tr("Connection", "Conexion"),
        ],
        rows: visibleProviders.map((provider) => [
          lang === "es" ? provider.label.es : provider.label.en,
          provider.category.replace(/_/g, " "),
          provider.availability.replace(/_/g, " "),
          connected(provider.key) ? tr("Connected", "Conectado") : tr("Not connected", "No conectado"),
        ]),
        emptyMessage: tr("No approved integrations match the current filters.", "Ninguna integracion aprobada coincide con los filtros actuales."),
      }, "integrations-current-view.pdf");
    } catch (error) {
      logClientError("integrations current-view PDF", error);
    } finally {
      setExporting(false);
    }
  };

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
    <div id="integrations-current-view" className="px-4 py-5 sm:px-8 sm:py-7" style={{ maxWidth: 1120 }}>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-5">
        <div className="min-w-0">
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
        <div className="flex min-w-0 flex-wrap items-start gap-2 sm:flex-nowrap sm:justify-end">
          <PrintPdfButton
            lang={lang}
            onClick={() => void exportCurrentView()}
            disabled={loading}
            loading={exporting}
            currentViewSummary={[
              `${tr("Search", "Busqueda")}: ${search.trim() || tr("None", "Ninguna")}`,
              `${tr("Category", "Categoria")}: ${category}`,
              `${tr("Availability", "Disponibilidad")}: ${availability}`,
              `${tr("Connection", "Conexion")}: ${connection}`,
              `${tr("Visible", "Visibles")}: ${visibleProviders.length}/${providers.length}`,
            ]}
          />
          <button
            className="min-w-0 flex-[1_1_180px] whitespace-normal sm:flex-none"
            onClick={() => navigate("/contact")}
            style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))", fontWeight: 700, cursor: "pointer" }}
          >
            {tr("Request an integration review", "Solicitar revisión de integración")}
          </button>
        </div>
      </div>

      <div style={{ padding: "12px 14px", border: "1px solid #BFDBFE", background: "#EFF6FF", borderRadius: 9, color: "#1E40AF", fontSize: 12, lineHeight: 1.55, marginBottom: 20 }}>
        <LockKeyhole style={{ width: 15, height: 15, verticalAlign: "middle", marginRight: 7 }} />
        {tr(
          "Never send passwords, API keys, or access tokens in an integration request.",
          "Nunca envíes contraseñas, claves API ni tokens de acceso en una solicitud de integración.",
        )}
      </div>

      <section data-current-view-filter-panel="integrations" aria-label={tr("Current view filters", "Filtros de vista actual")} style={{ padding: 14, marginBottom: 20, border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--card))" }}>
        <strong style={{ display: "block", marginBottom: 4, fontSize: 13 }}>{tr("Current view filters", "Filtros de vista actual")}</strong>
        <p style={{ margin: "0 0 10px", color: "hsl(var(--muted-foreground))", fontSize: 11 }}>{tr("Filters govern the visible approved catalog and Print PDF. Credentials and provider internals are never included.", "Los filtros controlan el catalogo aprobado visible y el PDF. Nunca se incluyen credenciales ni datos internos del proveedor.")}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 9 }}>
          <label style={{ display: "grid", gap: 4, fontSize: 11 }}>{tr("Search", "Busqueda")}<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr("Name or capability", "Nombre o capacidad")} /></label>
          <label style={{ display: "grid", gap: 4, fontSize: 11 }}>{tr("Category", "Categoria")}<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">{tr("All categories", "Todas")}</option><option value="file_source">{tr("File source", "Fuente de archivos")}</option><option value="open_format">{tr("Open format", "Formato abierto")}</option><option value="first_party">{tr("First party", "Primera parte")}</option><option value="governed">{tr("Governed", "Gobernada")}</option></select></label>
          <label style={{ display: "grid", gap: 4, fontSize: 11 }}>{tr("Availability", "Disponibilidad")}<select value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="all">{tr("All availability", "Toda")}</option><option value="available">{tr("Available", "Disponible")}</option><option value="setup_required">{tr("Setup required", "Configuracion requerida")}</option><option value="review_required">{tr("Review required", "Revision requerida")}</option></select></label>
          <label style={{ display: "grid", gap: 4, fontSize: 11 }}>{tr("Connection", "Conexion")}<select value={connection} onChange={(event) => setConnection(event.target.value)}><option value="all">{tr("All connection states", "Todos")}</option><option value="connected">{tr("Connected", "Conectado")}</option><option value="not_connected">{tr("Not connected", "No conectado")}</option></select></label>
        </div>
        <div style={{ marginTop: 9, fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>{tr("Visible", "Visibles")}: {visibleProviders.length}/{providers.length}</div>
      </section>

      {loading ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>
          <RefreshCw style={{ width: 15, height: 15 }} />
          {tr("Loading approved capabilities…", "Cargando capacidades aprobadas…")}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {visibleProviders.map((provider) => {
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
          {visibleProviders.length === 0 && <div style={{ gridColumn: "1 / -1", padding: 28, textAlign: "center", border: "1px dashed hsl(var(--border))", borderRadius: 10, color: "hsl(var(--muted-foreground))" }}>{tr("No accessible integrations match the current filters.", "Ninguna integracion accesible coincide con los filtros actuales.")}</div>}
        </div>
      )}
    </div>
  );
}
