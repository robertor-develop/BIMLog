import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Clock,
  Download,
  ExternalLink,
  FileBarChart2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

interface AnalyticsTabProps {
  projectId: number;
}

type InsightSummary = {
  generatedAt: string;
  title: { en: string; es: string };
  metricAuthority: {
    source: string;
    timezone: string;
    partial: boolean;
    definitions: Array<{ key: string; definition: string }>;
    sources: Array<{ module: string; status: string; count: number | null; code?: string }>;
  };
  operationalContext: {
    actionable: number;
    overdue: number;
    dueSoon: number;
    blocked: number;
    links: Record<string, string>;
  };
  compliance: {
    totalFiles: number;
    validFiles: number;
    rejectedFiles: number;
    complianceRate: number | null;
    unavailable: boolean;
    companies: Array<{ company: string; rejected: number }>;
    links: { source: string; report: string };
  };
  rfiPerformance: {
    total: number;
    byStatus: Record<string, number>;
    open: number;
    agingOver7Days: number;
    averageOpenAgeDays: number | null;
    links: { open: string; aging: string; report: string };
  };
  team: { members: number; companies: number; link: string };
  unavailable: Array<{ key: string; reason: string; reasonEs: string }>;
  removedFromInsights: string[];
  linksGrantAuthority: false;
  aiUsed: false;
};

const statusLabel = (status: string) =>
  status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function MetricCard({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number | string;
  tone?: "danger" | "warning" | "ok";
  onClick?: () => void;
}) {
  const color =
    tone === "danger" ? "#DC2626" : tone === "warning" ? "#D97706" : "#0F172A";
  return (
    <button
      type="button"
      className="kpi-card"
      onClick={onClick}
      style={{
        textAlign: "left",
        cursor: onClick ? "pointer" : "default",
        border: "1px solid hsl(var(--border))",
      }}
    >
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color }}>
        {value}
      </div>
    </button>
  );
}

export function AnalyticsTab({ projectId }: AnalyticsTabProps) {
  const { token } = useAuthStore();
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const tr = (en: string, es: string) => (lang === "es" ? es : en);
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );
  const [data, setData] = useState<InsightSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(
      `/api/v1/projects/${projectId}/project-insights?timezone=${encodeURIComponent(timezone)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            lang === "es"
              ? body.messageEs || "No se pudieron cargar los informes."
              : body.message || "Project insights could not be loaded.",
          );
        return body as InsightSummary;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, token, timezone, lang, retryKey]);

  if (loading) {
    return (
      <section className="ccc-shell" aria-busy="true">
        <div className="card-padded">
          <RefreshCw className="animate-spin" size={18} />
          <span style={{ marginLeft: 8 }}>
            {tr("Loading Project Insights & Reports…", "Cargando Perspectivas e Informes del Proyecto…")}
          </span>
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="ccc-shell">
        <div className="card-padded" role="alert">
          <div className="section-title">
            {tr("Project Insights unavailable", "Perspectivas no disponibles")}
          </div>
          <div className="section-sub" style={{ margin: "8px 0 14px" }}>
            {error || tr("No response was returned.", "No se recibió respuesta.")}
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => setRetryKey((n) => n + 1)}>
            <RefreshCw size={14} /> {tr("Retry", "Reintentar")}
          </button>
        </div>
      </section>
    );
  }

  const complianceRate =
    data.compliance.complianceRate == null ? "—" : `${data.compliance.complianceRate}%`;
  const maxCompany = Math.max(1, ...data.compliance.companies.map((row) => row.rejected));
  const rfiStatuses = Object.entries(data.rfiPerformance.byStatus).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <section className="ccc-shell project-insights" aria-labelledby="project-insights-title">
      <header className="ccc-hero">
        <div className="ccc-hero-copy">
          <div className="ccc-eyebrow">
            <BarChart3 size={14} /> {tr("Understand and report", "Comprender e informar")}
          </div>
          <h1 id="project-insights-title">
            {tr("Project Insights & Reports", "Perspectivas e Informes del Proyecto")}
          </h1>
          <p>
            {tr(
              "Analytics, bottlenecks, compliance and governed exports live here. Actionable work stays in the Coordinator Command Center.",
              "La analítica, los cuellos de botella, el cumplimiento y las exportaciones gobernadas viven aquí. El trabajo accionable permanece en el Centro de Control de Coordinación.",
            )}
          </p>
        </div>
        <div className="ccc-trust-card">
          <ShieldCheck size={17} />
          <div>
            <strong>{tr("Shared metric authority", "Autoridad métrica compartida")}</strong>
            <span>
              {tr(
                "Counts, date boundaries and permissions come from the Coordinator metric definitions.",
                "Los conteos, fechas límite y permisos vienen de las definiciones métricas del Coordinador.",
              )}
            </span>
          </div>
        </div>
      </header>

      {data.metricAuthority.partial && (
        <div className="ccc-partial" role="alert">
          <AlertTriangle size={18} />
          <div>
            <strong>{tr("Partial source data", "Datos parciales")}</strong>
            <span>
              {tr(
                "One or more authorized sources could not report. Missing sources are not counted as zero.",
                "Una o más fuentes autorizadas no pudieron reportar. Las fuentes faltantes no se cuentan como cero.",
              )}
            </span>
          </div>
        </div>
      )}

      <div className="ccc-kpis" aria-label={tr("Operational context", "Contexto operativo")}>
        <MetricCard
          label={tr("Actionable", "Accionables")}
          value={data.operationalContext.actionable}
          onClick={() => setLocation(data.operationalContext.links.actionable)}
        />
        <MetricCard
          label={tr("Overdue", "Vencidas")}
          value={data.operationalContext.overdue}
          tone={data.operationalContext.overdue > 0 ? "danger" : "ok"}
          onClick={() => setLocation(data.operationalContext.links.overdue)}
        />
        <MetricCard
          label={tr("Due soon", "Vencen pronto")}
          value={data.operationalContext.dueSoon}
          tone={data.operationalContext.dueSoon > 0 ? "warning" : "ok"}
          onClick={() => setLocation(data.operationalContext.links.dueSoon)}
        />
        <MetricCard
          label={tr("Blocked", "Bloqueadas")}
          value={data.operationalContext.blocked}
          tone={data.operationalContext.blocked > 0 ? "danger" : "ok"}
          onClick={() => setLocation(data.operationalContext.links.blocked)}
        />
      </div>

      <div className="col-3" style={{ marginBottom: 18 }}>
        <article className="card-padded">
          <div className="section-header">
            <div>
              <div className="section-title">
                {tr("Naming compliance", "Cumplimiento de nombres")}
              </div>
              <div className="section-sub">
                {tr(
                  "Current file compliance; detailed file lists remain in Files.",
                  "Cumplimiento actual de archivos; las listas detalladas permanecen en Archivos.",
                )}
              </div>
            </div>
            <FileBarChart2 size={17} />
          </div>
          <div className="kpi-value" style={{ marginTop: 8 }}>
            {complianceRate}
          </div>
          <div className="kpi-sub">
            {data.compliance.unavailable
              ? tr("Unavailable until files exist.", "No disponible hasta que existan archivos.")
              : tr(
                  `${data.compliance.validFiles} valid · ${data.compliance.rejectedFiles} rejected`,
                  `${data.compliance.validFiles} válidos · ${data.compliance.rejectedFiles} rechazados`,
                )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <button className="btn btn-sm btn-outline" onClick={() => setLocation(data.compliance.links.source)}>
              <ExternalLink size={13} /> {tr("Open Files", "Abrir Archivos")}
            </button>
            <button className="btn btn-sm btn-outline" onClick={() => setLocation(data.compliance.links.report)}>
              <Download size={13} /> {tr("Compliance report", "Informe de cumplimiento")}
            </button>
          </div>
        </article>

        <article className="card-padded">
          <div className="section-header">
            <div>
              <div className="section-title">{tr("RFI aging", "Antigüedad de RFIs")}</div>
              <div className="section-sub">
                {tr("Current status performance; history is not fabricated.", "Desempeño actual; no se fabrica historial.")}
              </div>
            </div>
            <Clock size={17} />
          </div>
          <div className="kpi-value" style={{ marginTop: 8 }}>
            {data.rfiPerformance.averageOpenAgeDays == null
              ? "—"
              : `${data.rfiPerformance.averageOpenAgeDays}d`}
          </div>
          <div className="kpi-sub">
            {tr(
              `${data.rfiPerformance.open} open · ${data.rfiPerformance.agingOver7Days} over 7 days`,
              `${data.rfiPerformance.open} abiertos · ${data.rfiPerformance.agingOver7Days} de más de 7 días`,
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <button className="btn btn-sm btn-outline" onClick={() => setLocation(data.rfiPerformance.links.open)}>
              <ExternalLink size={13} /> {tr("Open RFI actions", "Abrir acciones RFI")}
            </button>
            <button className="btn btn-sm btn-outline" onClick={() => setLocation(data.rfiPerformance.links.report)}>
              <Download size={13} /> {tr("RFI aging report", "Informe de antigüedad RFI")}
            </button>
          </div>
        </article>

        <article className="card-padded">
          <div className="section-header">
            <div>
              <div className="section-title">
                {tr("Company performance", "Desempeño por empresa")}
              </div>
              <div className="section-sub">
                {tr("Naming rejection concentration by company.", "Concentración de rechazos por empresa.")}
              </div>
            </div>
            <BarChart3 size={17} />
          </div>
          {data.compliance.companies.length ? (
            <div style={{ marginTop: 8 }}>
              {data.compliance.companies.map((row) => (
                <div key={row.company} className="bar-chart-row">
                  <div className="bar-chart-label" title={row.company}>
                    {row.company}
                  </div>
                  <div className="bar-chart-track">
                    <div
                      className="bar-chart-fill"
                      style={{
                        width: `${(row.rejected / maxCompany) * 100}%`,
                        background: "#D97706",
                      }}
                    />
                  </div>
                  <div className="bar-chart-val">{row.rejected}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: "20px 0" }}>
              <div className="empty-title">
                {tr("No company rejections", "Sin rechazos por empresa")}
              </div>
              <div className="empty-desc">
                {tr("Company performance will appear when authoritative data exists.", "El desempeño aparecerá cuando existan datos autorizados.")}
              </div>
            </div>
          )}
        </article>
      </div>

      <div className="col-2" style={{ marginBottom: 18 }}>
        <article className="card-padded">
          <div className="section-title">{tr("RFI status performance", "Desempeño por estado RFI")}</div>
          <div className="section-sub">
            {tr("Status distribution from canonical RFIs.", "Distribución de estados desde RFIs canónicos.")}
          </div>
          {rfiStatuses.length ? (
            <div style={{ marginTop: 12 }}>
              {rfiStatuses.map(([status, count]) => (
                <div key={status} className="bar-chart-row">
                  <div className="bar-chart-label">{statusLabel(status)}</div>
                  <div className="bar-chart-track">
                    <div
                      className="bar-chart-fill"
                      style={{
                        width: `${data.rfiPerformance.total ? (count / data.rfiPerformance.total) * 100 : 0}%`,
                        background: status === "closed" ? "#16A34A" : "#2563EB",
                      }}
                    />
                  </div>
                  <div className="bar-chart-val">{count}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: "20px 0" }}>
              <div className="empty-title">{tr("No RFIs yet", "Aún no hay RFIs")}</div>
            </div>
          )}
        </article>

        <article className="card-padded">
          <div className="section-title">
            {tr("Unavailable analytics", "Analítica no disponible")}
          </div>
          <div className="section-sub">
            {tr(
              "These are intentionally honest empty states, not zero-result fallbacks.",
              "Estos son estados vacíos honestos, no reemplazos con cero resultados.",
            )}
          </div>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {data.unavailable.map((entry) => (
              <div key={entry.key} className="ccc-active-summary">
                <strong>{statusLabel(entry.key)}</strong>
                <span>{lang === "es" ? entry.reasonEs : entry.reason}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="card-padded">
        <div className="section-title">
          {tr("Surface boundaries", "Límites de superficie")}
        </div>
        <div className="section-sub" style={{ marginBottom: 12 }}>
          {tr(
            "Recent Activity remains in Activity Log. Recent Files remains in Files. Operational selections and actions remain in Coordinator Command Center. Links do not grant authority.",
            "La Actividad Reciente permanece en Registro de Actividad. Los Archivos Recientes permanecen en Archivos. Las selecciones y acciones operativas permanecen en el Centro de Control. Los enlaces no otorgan autoridad.",
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-sm btn-outline" onClick={() => setLocation(`/projects/${projectId}/command-center`)}>
            <ExternalLink size={13} /> {tr("Act in Command Center", "Actuar en Centro de Control")}
          </button>
          <button className="btn btn-sm btn-outline" onClick={() => setLocation(`/projects/${projectId}/reports`)}>
            <Download size={13} /> {tr("Open governed exports", "Abrir exportaciones gobernadas")}
          </button>
        </div>
      </div>
    </section>
  );
}
