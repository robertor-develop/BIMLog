import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, ArrowRight, FileText, ClipboardList, FileWarning, CheckCircle2, LoaderCircle, RefreshCw } from "lucide-react";

type ItemType = "rfis" | "submittals" | "files";

interface BaseRow {
  id: number;
  project_id: number;
  project_name: string;
  project_code: string;
  status?: string;
  due_date?: string | null;
}
interface RfiRow extends BaseRow { rfi_number: string; title: string; }
interface SubmittalRow extends BaseRow { submittal_number: string; title: string; }
interface FileRow extends BaseRow { file_name: string; compliance_status: boolean | null; cvr_workflow_status?: string | null; }

const API = "/api/v1";

const TYPE_META: Record<ItemType, { label: { en: string; es: string }; tab: string; icon: typeof FileText; color: string; bg: string; border: string }> = {
  rfis:       { label: { en: "Open RFIs", es: "RFI abiertos" }, tab: "rfis", icon: FileText, color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  submittals: { label: { en: "Pending Submittals", es: "Submittals pendientes" }, tab: "submittals", icon: ClipboardList, color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
  files:      { label: { en: "Files Needing Attention", es: "Archivos que requieren atención" }, tab: "files", icon: FileWarning, color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
};

// Stable color per project code (matches project card hue style)
function projectBadgeStyle(code: string): React.CSSProperties {
  const palette = [
    { color: "#1D4ED8", bg: "#DBEAFE" },
    { color: "#7C3AED", bg: "#EDE9FE" },
    { color: "#16A34A", bg: "#DCFCE7" },
    { color: "#DC2626", bg: "#FEE2E2" },
    { color: "#D97706", bg: "#FEF3C7" },
    { color: "#0891B2", bg: "#CFFAFE" },
    { color: "#DB2777", bg: "#FCE7F3" },
  ];
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  const p = palette[h % palette.length];
  return {
    fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
    color: p.color, background: p.bg, padding: "2px 7px", borderRadius: 4,
    border: `1px solid ${p.color}33`,
  };
}

function statusBadge(status: string) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 20,
      background: "#F3F4F6", color: "#374151", fontSize: 10, fontWeight: 600,
      textTransform: "uppercase",
    }}>{status.replace(/_/g, " ")}</span>
  );
}

export function PendingItems() {
  const [, setLocation] = useLocation();
  const { token } = useAuthStore();
  const { lang } = useI18n();
  const tt = (en: string, es: string) => lang === "es" ? es : en;
  const sp = new URLSearchParams(window.location.search);
  const requestedType = sp.get("type");
  const type: ItemType = requestedType && requestedType in TYPE_META ? requestedType as ItemType : "rfis";
  const meta = TYPE_META[type];
  const Icon = meta.icon;

  const [rows, setRows] = useState<(RfiRow | SubmittalRow | FileRow)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(""); setRows([]);
    (async () => {
      try {
        const r = await fetch(`${API}/dashboard/pending/${type}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          if (!cancelled) setError(d.error || tt(`Request failed (${r.status})`, `La solicitud falló (${r.status})`));
          return;
        }
        const data = await r.json();
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : tt("Network error", "Error de red"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [type, token, lang, loadAttempt]);

  const itemNumber = (r: RfiRow | SubmittalRow | FileRow): string => {
    if (type === "rfis") return (r as RfiRow).rfi_number;
    if (type === "submittals") return (r as SubmittalRow).submittal_number;
    return "";
  };
  const itemTitle = (r: RfiRow | SubmittalRow | FileRow): string => {
    if (type === "files") return (r as FileRow).file_name;
    return (r as RfiRow | SubmittalRow).title;
  };
  const itemStatus = (r: RfiRow | SubmittalRow | FileRow): string => {
    if (type === "files") {
      const f = r as FileRow;
      if (f.cvr_workflow_status === "pending_review") return "pending_review";
      return f.compliance_status === false ? "non_compliant" : (r.status ?? "");
    }
    return r.status ?? "";
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px" }}>
      <button
        onClick={() => setLocation("/dashboard")}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "transparent", border: "1px solid hsl(var(--border))",
          padding: "6px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
          color: "hsl(var(--foreground))", marginBottom: 16,
        }}
      >
        <ArrowLeft style={{ width: 13, height: 13 }} /> {tt("Back to Headquarters", "Volver a la Sede")}
      </button>

      <nav className="pending-type-tabs" aria-label={tt("Attention queues", "Colas de atención")}>
        {(Object.keys(TYPE_META) as ItemType[]).map(queueType => {
          const queue = TYPE_META[queueType];
          const QueueIcon = queue.icon;
          return (
            <button
              key={queueType}
              type="button"
              aria-current={type === queueType ? "page" : undefined}
              onClick={() => setLocation(`/pending?type=${queueType}`)}
            >
              <QueueIcon aria-hidden="true" />
              {queue.label[lang]}
            </button>
          );
        })}
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: meta.bg, border: `1px solid ${meta.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon style={{ width: 18, height: 18, color: meta.color }} />
        </div>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, margin: 0 }}>
            {meta.label[lang]}
          </h1>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginTop: 2 }}>
            {loading
              ? tt("Loading…", "Cargando…")
              : tt(`${rows.length} item${rows.length === 1 ? "" : "s"} across all projects`, `${rows.length} elemento${rows.length === 1 ? "" : "s"} en todos los proyectos`)}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 12, marginBottom: 16, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, color: "#DC2626", fontSize: 13 }}>
          <span>{error}</span>
          <button type="button" className="pending-retry-action" onClick={() => setLoadAttempt(value => value + 1)}>
            <RefreshCw aria-hidden="true" /> {tt("Try again", "Intentar de nuevo")}
          </button>
        </div>
      )}

      {loading && (
        <div className="pending-loading-state" role="status" aria-live="polite">
          <LoaderCircle aria-hidden="true" />
          <span>{tt("Loading this attention queue…", "Cargando esta cola de atención…")}</span>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          padding: "48px 20px", background: "#F0FDF4", border: "1px solid #BBF7D0",
          borderRadius: 8, color: "#16A34A",
        }}>
          <CheckCircle2 style={{ width: 28, height: 28 }} />
          <div style={{ fontWeight: 700 }}>{tt("No pending items", "No hay elementos pendientes")}</div>
          <div style={{ fontSize: 12, color: "#15803D" }}>{tt("You're all caught up.", "Todo está al día.")}</div>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map(r => (
            <button
              key={`${r.project_id}-${r.id}`}
              type="button"
              className="pending-item-action"
              aria-label={tt(`Open ${itemTitle(r)} in ${r.project_name}`, `Abrir ${itemTitle(r)} en ${r.project_name}`)}
              onClick={() => setLocation(`/projects/${r.project_id}/${meta.tab}`)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", background: "white",
                border: "1px solid hsl(var(--border))", borderRadius: 8,
                cursor: "pointer", width: "100%", textAlign: "left", font: "inherit",
              }}
            >
              <span style={projectBadgeStyle(r.project_code)} title={r.project_name}>{r.project_code}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  {itemNumber(r) && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#1D4ED8" }}>{itemNumber(r)}</span>
                  )}
                  {itemStatus(r) && statusBadge(itemStatus(r))}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {itemTitle(r)}
                </div>
                <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 2 }}>
                  {r.project_name}
                  {r.due_date && ` · ${tt("Due", "Vence")} ${new Date(r.due_date).toLocaleDateString(lang === "es" ? "es-BO" : "en-US")}`}
                </div>
              </div>
              <ArrowRight style={{ width: 16, height: 16, color: meta.color, flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default PendingItems;
